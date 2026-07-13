import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TrackingMap } from '@/components/TrackingMap';
import { useColors } from '@/hooks/useColors';
import { useRestaurants } from '@/hooks/useRestaurants';
import { useFeastWindowContext } from '@/context/FeastWindowContext';
import { ordersApi, type ApiOrder } from '@/lib/api';
import {
  buildWaypoints,
  deriveDestination,
  DEFAULT_RESTAURANT_COORD,
  type LatLng,
} from '@/lib/geo';

const FALLBACK_ORDER_ID = `#FE${Math.floor(10000 + Math.random() * 90000)}`;
// Safety-net poll cadence. Live updates arrive over the WebSocket; this slower
// poll keeps the screen working if the socket drops and doubles as the
// app-presence ping (must stay under the server's active-app suppression window
// so order-status pushes aren't duplicated by the OS while the screen is open).
const FALLBACK_POLL_MS = 8000;
// How long to animate the driver marker toward a freshly pushed position. Sized
// a touch above the server's ~1s tick so the marker glides continuously between
// pushes rather than stuttering.
const WS_ANIM_MS = 1200;
// If no WebSocket update has arrived within this window the socket is considered
// stale, so the fallback poll takes over driving the marker (animating over the
// full poll interval for a smooth glide).
const WS_STALE_MS = 4000;

type TrackingStep = {
  id: number;
  label: string;
  icon: string;
  notifTitle?: string;
  notifBody?: string;
};

const BASE_STEPS: TrackingStep[] = [
  { id: 1, label: 'Order Confirmed', icon: 'checkmark-circle' },
  {
    id: 2,
    label: 'Restaurant Preparing',
    icon: 'restaurant',
    notifTitle: '👨‍🍳 Your order is being prepared',
    notifBody: 'The kitchen has started cooking up your feast.',
  },
  {
    id: 3,
    label: 'Driver Assigned',
    icon: 'person',
    notifTitle: '🚗 Driver Assigned!',
    notifBody: 'Your driver is on the way to the restaurant.',
  },
  {
    id: 4,
    label: 'On the Way',
    icon: 'bicycle',
    notifTitle: '🍽️ Order Picked Up!',
    notifBody: 'Your feast has been picked up and is heading to you.',
  },
  {
    id: 5,
    label: 'Delivered',
    icon: 'home',
    notifTitle: '🎉 Order Delivered!',
    notifBody: 'Your feast has arrived. Enjoy!',
  },
];

// Maps the server-persisted order status to a tracking step id.
const STATUS_TO_STEP: Record<string, number> = {
  placed: 1,
  confirmed: 1,
  preparing: 2,
  driver_assigned: 3,
  on_the_way: 4,
  ready: 4,
  delivered: 5,
};

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function interpolateCoord(
  waypoints: LatLng[],
  progress: number
): { latitude: number; longitude: number } {
  if (progress <= 0) return waypoints[0];
  if (progress >= 1) return waypoints[waypoints.length - 1];
  const totalSegments = waypoints.length - 1;
  const scaledProgress = progress * totalSegments;
  const segmentIndex = Math.min(Math.floor(scaledProgress), totalSegments - 1);
  const segmentProgress = scaledProgress - segmentIndex;
  const from = waypoints[segmentIndex];
  const to = waypoints[segmentIndex + 1];
  return {
    latitude: lerp(from.latitude, to.latitude, segmentProgress),
    longitude: lerp(from.longitude, to.longitude, segmentProgress),
  };
}

async function sendLocalNotification(title: string, body: string) {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null,
    });
  } catch (_) {}
}

async function requestNotificationPermission() {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.requestPermissionsAsync();
  } catch (_) {}
}

export default function ConfirmationScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId?: string; address?: string; restLat?: string; restLng?: string; destLat?: string; destLng?: string; track?: string }>();
  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const { restaurants } = useRestaurants();

  const isTrackMode = params.track === '1';
  const [order, setOrder] = useState<ApiOrder | null>(null);
  // Subscribe to the shared app WebSocket for live driver/ETA pushes.
  const { subscribe } = useFeastWindowContext();

  // Live tracking fields (status, driver fraction, ETA) driven by WS pushes and
  // refreshed by the fallback poll. Kept separate from `order` (full record) so
  // a lightweight WS message can update the map without a full GET.
  const [tracking, setTracking] = useState<{
    status: string;
    driverProgress: number;
    etaMinutes: number | null;
  } | null>(null);

  // Prefer the address passed via route params (fresh checkout); fall back to the
  // address persisted on the order so tracking from history shows the real
  // destination instead of an empty string.
  const deliveryAddress =
    (typeof params.address === 'string' && params.address) ||
    order?.deliveryAddress ||
    '';

  const matchedRestaurant = useMemo(
    () => (order ? restaurants.find((r) => r.id === order.restaurantId) ?? null : null),
    [order, restaurants]
  );

  const restaurantName =
    order?.restaurantName ?? matchedRestaurant?.name ?? 'Restaurant';

  const restaurantCoord = useMemo<LatLng>(() => {
    const lat = params.restLat ? parseFloat(params.restLat) : NaN;
    const lng = params.restLng ? parseFloat(params.restLng) : NaN;
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      return { latitude: lat, longitude: lng };
    }
    if (matchedRestaurant?.lat != null && matchedRestaurant?.lng != null) {
      return { latitude: matchedRestaurant.lat, longitude: matchedRestaurant.lng };
    }
    return DEFAULT_RESTAURANT_COORD;
  }, [params.restLat, params.restLng, matchedRestaurant]);

  // Prefer the precise drop-off pin passed from checkout (real saved-address
  // coordinates). Fall back to the deterministic derived point only when no pin
  // was provided (e.g. legacy orders or a typed address with no saved pin).
  const destCoord = useMemo<LatLng>(() => {
    const lat = params.destLat ? parseFloat(params.destLat) : NaN;
    const lng = params.destLng ? parseFloat(params.destLng) : NaN;
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      return { latitude: lat, longitude: lng };
    }
    // No route-param pin (e.g. tracking from history): use the precise drop-off
    // coordinates persisted on the order when present.
    const storedLat = order?.deliveryLat != null ? parseFloat(order.deliveryLat) : NaN;
    const storedLng = order?.deliveryLng != null ? parseFloat(order.deliveryLng) : NaN;
    if (!Number.isNaN(storedLat) && !Number.isNaN(storedLng)) {
      return { latitude: storedLat, longitude: storedLng };
    }
    return deriveDestination(deliveryAddress, restaurantCoord);
  }, [params.destLat, params.destLng, order?.deliveryLat, order?.deliveryLng, deliveryAddress, restaurantCoord]);

  const waypoints = useMemo<LatLng[]>(
    () => buildWaypoints(restaurantCoord, destCoord),
    [restaurantCoord, destCoord]
  );

  const orderId = typeof params.orderId === 'string' ? params.orderId : '';
  const orderLabel = orderId ? `#FE${orderId}` : FALLBACK_ORDER_ID;

  const [currentStepId, setCurrentStepId] = useState(1);
  const [driverCoord, setDriverCoord] = useState<LatLng>(restaurantCoord);

  // Post-delivery rating state
  const [selectedRating, setSelectedRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingDone, setRatingDone] = useState(false);
  const [ratingError, setRatingError] = useState('');

  const steps = useMemo(
    () => BASE_STEPS.map((s) => ({ ...s, done: s.id <= currentStepId })),
    [currentStepId]
  );

  const driverProgress = useRef(new Animated.Value(0)).current;
  const driverProgressValueRef = useRef(0);
  const firstProgressRef = useRef(true);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const prevStepRef = useRef(0);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      try {
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });
      } catch (_) {}
    }

    requestNotificationPermission();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Drive tracking from the server. Live driver/ETA/status updates arrive over
  // the shared WebSocket so the map reacts instantly; a slow fallback poll keeps
  // things working if the socket drops, refreshes the full order record (items,
  // rating, address) and acts as the app-presence ping for push de-duplication.
  useEffect(() => {
    if (!orderId) {
      setCurrentStepId(2);
      return;
    }

    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let initialized = false;
    let stopped = false;
    const lastWsAt = { current: 0 };

    // Fire the in-app step notifications and advance the visible step. Driven by
    // whichever source delivers the freshest status (WS or poll); idempotent via
    // prevStepRef so a redundant call from the slower source does nothing.
    const advance = (status: string) => {
      const stepId = STATUS_TO_STEP[status] ?? 1;

      if (!initialized) {
        initialized = true;
        prevStepRef.current = stepId;
        setCurrentStepId(stepId);
        if (stepId <= 1) {
          sendLocalNotification(
            '✅ Order Confirmed!',
            `Your order ${orderLabel} has been confirmed and the restaurant is getting started.`
          );
        }
        return;
      }

      if (stepId > prevStepRef.current) {
        BASE_STEPS.forEach((s) => {
          if (s.id > prevStepRef.current && s.id <= stepId && s.notifTitle && s.notifBody) {
            sendLocalNotification(s.notifTitle, s.notifBody);
          }
        });
        prevStepRef.current = stepId;
        setCurrentStepId(stepId);
      }
    };

    // Animate the driver marker toward a new progress fraction. The very first
    // value is applied instantly so tracking resumes at the correct spot after a
    // reload; subsequent values glide over `durationMs`.
    const animateProgress = (progress: number, durationMs: number) => {
      const target = Math.max(0, Math.min(1, progress));
      if (firstProgressRef.current) {
        firstProgressRef.current = false;
        driverProgress.setValue(target);
        return;
      }
      Animated.timing(driverProgress, {
        toValue: target,
        duration: durationMs,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start();
    };

    const applyTracking = (
      status: string,
      progress: number | null | undefined,
      eta: number | null | undefined,
      durationMs: number
    ) => {
      setTracking({ status, driverProgress: progress ?? 0, etaMinutes: eta ?? null });
      advance(status);
      if (progress != null) animateProgress(progress, durationMs);
    };

    // Live push: update the marker/ETA the instant the server broadcasts.
    const unsubscribe = subscribe((msg) => {
      if (!active || msg.type !== 'order_update') return;
      const data = msg.data as unknown as
        | { id: number; status: string; driverProgress: number; etaMinutes: number }
        | undefined;
      if (!data || Number(data.id) !== Number(orderId)) return;
      lastWsAt.current = Date.now();
      applyTracking(data.status, data.driverProgress, data.etaMinutes, WS_ANIM_MS);
      if (data.status === 'delivered' || data.status === 'cancelled') {
        stopped = true;
        // Pull the full record once so the rating UI has the latest order data.
        ordersApi
          .get(Number(orderId))
          .then((fetched) => {
            if (!active) return;
            setOrder(fetched);
            if (fetched.rating != null) {
              setSelectedRating(fetched.rating);
              if (fetched.ratingComment) setRatingComment(fetched.ratingComment);
              setRatingDone(true);
            }
          })
          .catch(() => {});
      }
    });

    // Fallback poll + presence ping. Refreshes the full order; only drives the
    // marker itself when the WebSocket has gone quiet, so it never fights the
    // live pushes.
    const poll = async () => {
      try {
        const fetched = await ordersApi.get(Number(orderId));
        if (!active) return;
        setOrder(fetched);
        if (fetched.rating != null) {
          setSelectedRating(fetched.rating);
          if (fetched.ratingComment) setRatingComment(fetched.ratingComment);
          setRatingDone(true);
        }
        const wsHealthy = Date.now() - lastWsAt.current < WS_STALE_MS;
        if (wsHealthy) {
          // WS owns the marker; just keep the steps in sync.
          advance(fetched.status);
        } else {
          applyTracking(
            fetched.status,
            fetched.driverProgress,
            fetched.etaMinutes,
            FALLBACK_POLL_MS
          );
        }
        if (fetched.status === 'delivered' || fetched.status === 'cancelled') {
          stopped = true;
          return;
        }
      } catch (_) {
        if (!active) return;
      }
      if (active && !stopped) timer = setTimeout(poll, FALLBACK_POLL_MS);
    };

    poll();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [orderId, orderLabel, subscribe]);

  // Place the driver marker along the route from the current progress fraction.
  // Re-subscribes when the waypoints resolve (restaurant/address coords load) so
  // the marker snaps onto the real path. The fraction itself is driven by the
  // backend (WS/poll above), so position is authoritative and resumes after reloads.
  useEffect(() => {
    setDriverCoord(interpolateCoord(waypoints, driverProgressValueRef.current));
    const listener = driverProgress.addListener(({ value }) => {
      driverProgressValueRef.current = value;
      setDriverCoord(interpolateCoord(waypoints, value));
    });
    return () => {
      driverProgress.removeListener(listener);
    };
  }, [waypoints]);

  const isDelivered = currentStepId >= 5;
  const driverVisible = currentStepId >= 3 && !isDelivered;
  const liveEta = tracking?.etaMinutes ?? order?.etaMinutes;
  const estimatedTime = isDelivered
    ? 'Delivered!'
    : liveEta != null
    ? `~${Math.max(liveEta, 1)} min`
    : currentStepId >= 4
    ? '~15 min'
    : '30-45 min';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: topPad + 16, paddingBottom: insets.bottom + 32 }}
      >
        <View style={styles.content}>
          {/* Success header */}
          <View style={styles.successArea}>
            <Animated.View
              style={[
                styles.successRing,
                { borderColor: '#22C55E40', transform: [{ scale: pulseAnim }] },
              ]}
            />
            <LinearGradient colors={['#22C55E', '#16A34A']} style={styles.successCircle}>
              <Ionicons
                name={isDelivered ? 'checkmark' : isTrackMode ? 'navigate' : 'checkmark'}
                size={40}
                color="#fff"
              />
            </LinearGradient>
          </View>

          <Text style={[styles.heading, { color: colors.foreground }]}>
            {isDelivered ? 'Order Delivered!' : isTrackMode ? 'Tracking Your Order' : 'Order Placed!'}
          </Text>
          <Text style={[styles.subheading, { color: colors.mutedForeground }]}>
            {isDelivered
              ? 'Your feast has arrived. Enjoy!'
              : isTrackMode
              ? "Here's where your feast is right now."
              : 'Your feast is on its way. Sit tight!'}
          </Text>

          {/* Order info */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.orderRow}>
              <Text style={[styles.orderLabel, { color: colors.mutedForeground }]}>Restaurant</Text>
              <Text style={[styles.orderValue, { color: colors.foreground }]} numberOfLines={1}>
                {restaurantName}
              </Text>
            </View>
            <View style={[styles.orderRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
              <Text style={[styles.orderLabel, { color: colors.mutedForeground }]}>Order ID</Text>
              <Text style={[styles.orderValue, { color: colors.foreground }]}>{orderLabel}</Text>
            </View>
            <View style={[styles.orderRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
              <Text style={[styles.orderLabel, { color: colors.mutedForeground }]}>
                Estimated Time
              </Text>
              <View style={[styles.timeBadge, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons
                  name={isDelivered ? 'checkmark-circle' : 'time'}
                  size={14}
                  color={colors.primary}
                />
                <Text style={[styles.timeText, { color: colors.primary }]}>{estimatedTime}</Text>
              </View>
            </View>
          </View>

          {/* Order items summary */}
          {order && order.items.length > 0 && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.itemsHeader, { borderBottomColor: colors.border }]}>
                <Ionicons name="receipt-outline" size={16} color={colors.mutedForeground} />
                <Text style={[styles.itemsHeaderText, { color: colors.foreground }]}>
                  {order.items.reduce((s, i) => s + i.quantity, 0)} item
                  {order.items.reduce((s, i) => s + i.quantity, 0) === 1 ? '' : 's'}
                </Text>
              </View>
              {order.items.map((item, idx) => (
                <View
                  key={`${item.menuItemId}-${idx}`}
                  style={[
                    styles.summaryItemRow,
                    idx < order.items.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.summaryItemQty, { color: colors.primary }]}>
                    {item.quantity}×
                  </Text>
                  <Text
                    style={[styles.summaryItemName, { color: colors.foreground }]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  <Text style={[styles.summaryItemPrice, { color: colors.mutedForeground }]}>
                    ${(item.price * item.quantity).toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Live Map */}
          <TrackingMap
            waypoints={waypoints}
            restaurantCoord={restaurantCoord}
            destCoord={destCoord}
            driverCoord={driverCoord}
            driverVisible={driverVisible}
          />
          {deliveryAddress ? (
            <View style={styles.addressRow}>
              <Ionicons name="location" size={14} color={colors.primary} />
              <Text style={[styles.addressText, { color: colors.mutedForeground }]} numberOfLines={1}>
                Delivering to {deliveryAddress}
              </Text>
            </View>
          ) : null}

          {/* Tracking Steps */}
          <View style={styles.trackingSection}>
            <Text style={[styles.trackingTitle, { color: colors.foreground }]}>
              Order Tracking
            </Text>
            {steps.map((step, idx) => (
              <View key={step.id} style={styles.trackingStep}>
                <View style={styles.stepLeft}>
                  <View
                    style={[
                      styles.stepIcon,
                      { backgroundColor: step.done ? '#22C55E' : colors.muted },
                    ]}
                  >
                    <Ionicons
                      name={step.icon as any}
                      size={16}
                      color={step.done ? '#fff' : colors.mutedForeground}
                    />
                  </View>
                  {idx < steps.length - 1 && (
                    <View
                      style={[
                        styles.stepLine,
                        { backgroundColor: step.done ? '#22C55E' : colors.border },
                      ]}
                    />
                  )}
                </View>
                <View style={styles.stepInfo}>
                  <Text
                    style={[
                      styles.stepLabel,
                      {
                        color: step.done ? colors.foreground : colors.mutedForeground,
                        fontFamily: step.done ? 'Inter_600SemiBold' : 'Inter_400Regular',
                      },
                    ]}
                  >
                    {step.label}
                  </Text>
                  {step.id === 2 && (
                    <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
                      {currentStepId <= 2 ? 'Preparing your order now' : 'Order ready for pickup'}
                    </Text>
                  )}
                  {step.id === 4 && step.done && (
                    <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
                      Driver is heading your way
                    </Text>
                  )}
                  {step.id === 5 && !step.done && (
                    <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
                      {estimatedTime}
                    </Text>
                  )}
                </View>
                {step.id === currentStepId && !isDelivered && (
                  <View style={[styles.activeBadge, { backgroundColor: colors.primary + '18' }]}>
                    <Text style={[styles.activeBadgeText, { color: colors.primary }]}>Live</Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          {/* Post-delivery rating */}
          {isDelivered && (
            <View
              style={[styles.ratingCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              {ratingDone ? (
                <View style={styles.ratingThanks}>
                  <View style={[styles.thanksIcon, { backgroundColor: '#22C55E15' }]}>
                    <Ionicons name="heart" size={24} color="#22C55E" />
                  </View>
                  <Text style={[styles.ratingThanksTitle, { color: colors.foreground }]}>
                    Thanks for your feedback!
                  </Text>
                  <View style={styles.starsRow}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Ionicons
                        key={n}
                        name={n <= selectedRating ? 'star' : 'star-outline'}
                        size={24}
                        color={n <= selectedRating ? '#F59E0B' : colors.mutedForeground}
                      />
                    ))}
                  </View>
                  {ratingComment ? (
                    <Text style={[styles.ratingThanksSub, { color: colors.mutedForeground }]}>
                      “{ratingComment}”
                    </Text>
                  ) : null}
                </View>
              ) : (
                <>
                  <Text style={[styles.ratingTitle, { color: colors.foreground }]}>
                    How was your feast?
                  </Text>
                  <Text style={[styles.ratingSub, { color: colors.mutedForeground }]}>
                    Rate your order to help {orderLabel} and the restaurant.
                  </Text>
                  <View style={styles.starsRowInput}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <TouchableOpacity
                        key={n}
                        onPress={() => {
                          setSelectedRating(n);
                          setRatingError('');
                        }}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                      >
                        <Ionicons
                          name={n <= selectedRating ? 'star' : 'star-outline'}
                          size={36}
                          color={n <= selectedRating ? '#F59E0B' : colors.mutedForeground}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput
                    style={[
                      styles.ratingInput,
                      {
                        color: colors.foreground,
                        backgroundColor: colors.muted,
                        borderColor: colors.border,
                      },
                    ]}
                    placeholder="Add a comment (optional)"
                    placeholderTextColor={colors.mutedForeground}
                    value={ratingComment}
                    onChangeText={setRatingComment}
                    multiline
                    maxLength={500}
                  />
                  {ratingError ? (
                    <Text style={styles.ratingErrorText}>{ratingError}</Text>
                  ) : null}
                  <TouchableOpacity
                    style={[
                      styles.ratingSubmit,
                      {
                        backgroundColor: selectedRating > 0 ? colors.primary : colors.mutedForeground,
                      },
                    ]}
                    disabled={selectedRating === 0 || ratingSubmitting}
                    onPress={async () => {
                      if (selectedRating === 0 || !orderId) return;
                      setRatingSubmitting(true);
                      setRatingError('');
                      try {
                        await ordersApi.rate(
                          Number(orderId),
                          selectedRating,
                          ratingComment.trim() || undefined
                        );
                        setRatingDone(true);
                      } catch (e: any) {
                        setRatingError(e?.message ?? 'Could not submit rating. Try again.');
                      } finally {
                        setRatingSubmitting(false);
                      }
                    }}
                    activeOpacity={0.85}
                  >
                    {ratingSubmitting ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.ratingSubmitText}>Submit Rating</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.replace('/(tabs)' as any)}
              activeOpacity={0.85}
            >
              <Ionicons name="home" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>Back to Home</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.secondaryBtn,
                { borderColor: colors.primary, backgroundColor: colors.card },
              ]}
              onPress={() => router.push('/delivery' as any)}
              activeOpacity={0.8}
            >
              <Ionicons name="search" size={18} color={colors.primary} />
              <Text style={[styles.secondaryBtnText, { color: colors.primary }]}>
                Browse More Places
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 20 },
  successArea: { alignItems: 'center', marginVertical: 32 },
  successRing: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, position: 'absolute' },
  successCircle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  heading: { fontSize: 28, fontFamily: 'Inter_700Bold', textAlign: 'center', marginBottom: 8 },
  subheading: { fontSize: 16, fontFamily: 'Inter_400Regular', textAlign: 'center', marginBottom: 32 },
  card: { 
    borderRadius: 20, 
    borderWidth: StyleSheet.hairlineWidth, 
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  orderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  orderLabel: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  orderValue: { fontSize: 15, fontFamily: 'Inter_600SemiBold', flex: 1, textAlign: 'right' },
  timeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  timeText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  itemsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  itemsHeaderText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  summaryItemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  summaryItemQty: { fontSize: 15, fontFamily: 'Inter_600SemiBold', width: 24 },
  summaryItemName: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },
  summaryItemPrice: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', marginTop: 12, marginBottom: 32 },
  addressText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  trackingSection: { marginBottom: 32 },
  trackingTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', marginBottom: 20 },
  trackingStep: { flexDirection: 'row', alignItems: 'stretch' },
  stepLeft: { alignItems: 'center', width: 40, marginRight: 12 },
  stepIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  stepLine: { width: 2, flex: 1, marginVertical: -4, zIndex: 1 },
  stepInfo: { flex: 1, paddingBottom: 24, justifyContent: 'center' },
  stepLabel: { fontSize: 16 },
  stepSub: { fontSize: 14, fontFamily: 'Inter_400Regular', marginTop: 4 },
  activeBadge: { alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  activeBadgeText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  ratingCard: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 24, marginBottom: 32, alignItems: 'center' },
  ratingTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', marginBottom: 8 },
  ratingSub: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', marginBottom: 20 },
  starsRowInput: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  ratingInput: { width: '100%', height: 100, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 16, fontSize: 15, fontFamily: 'Inter_400Regular', textAlignVertical: 'top', marginBottom: 16 },
  ratingErrorText: { color: '#89181A', fontSize: 14, fontFamily: 'Inter_500Medium', marginBottom: 16 },
  ratingSubmit: { width: '100%', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  ratingSubmitText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
  ratingThanks: { alignItems: 'center', gap: 12 },
  thanksIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  ratingThanksTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  starsRow: { flexDirection: 'row', gap: 4 },
  ratingThanksSub: { fontSize: 15, fontFamily: 'Inter_400Regular', textAlign: 'center', fontStyle: 'italic', marginTop: 8 },
  actions: { gap: 12 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 18, borderRadius: 16 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 18, borderRadius: 16, borderWidth: 1 },
  secondaryBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
});