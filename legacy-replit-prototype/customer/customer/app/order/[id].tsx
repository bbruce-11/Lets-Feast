import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useOrders } from '@/hooks/useOrders';
import { useRestaurants } from '@/hooks/useRestaurants';
import { useCart } from '@/context/CartContext';
import { RatingCard } from '@/components/OrderRating';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string; step: number }> = {
  placed: { label: 'Confirmed', color: '#A57D2D', icon: 'checkmark-circle', step: 0 },
  confirmed: { label: 'Confirmed', color: '#A57D2D', icon: 'checkmark-circle', step: 0 },
  preparing: { label: 'Preparing', color: '#3B82F6', icon: 'restaurant', step: 1 },
  driver_assigned: { label: 'Driver Assigned', color: '#8B5CF6', icon: 'person', step: 2 },
  ready: { label: 'On the Way', color: '#F59E0B', icon: 'bicycle', step: 3 },
  on_the_way: { label: 'On the Way', color: '#F59E0B', icon: 'bicycle', step: 3 },
  delivered: { label: 'Delivered', color: '#1E9E5A', icon: 'checkmark-done', step: 4 },
  cancelled: { label: 'Cancelled', color: '#89181A', icon: 'close-circle', step: -1 },
};

const STATUS_STEPS = ['confirmed', 'preparing', 'driver_assigned', 'on_the_way', 'delivered'];

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatTotal(subtotal: string) {
  const n = parseFloat(subtotal);
  return isNaN(n) ? subtotal : `$${n.toFixed(2)}`;
}

function StatusTracker({ status }: { status: string }) {
  const colors = useColors();
  const cfg = STATUS_CONFIG[status];
  const currentStep = cfg?.step ?? 0;
  const isCancelled = status === 'cancelled';

  if (isCancelled) {
    return (
      <View style={[styles.cancelledBanner, { backgroundColor: '#89181A15' }]}>
        <Ionicons name="close-circle" size={24} color="#89181A" />
        <Text style={[styles.cancelledText, { color: '#89181A' }]}>This order was cancelled</Text>
      </View>
    );
  }

  return (
    <View style={styles.tracker}>
      {STATUS_STEPS.map((step, idx) => {
        const stepCfg = STATUS_CONFIG[step];
        const done = currentStep >= idx;
        const active = currentStep === idx;
        const dotColor = done ? stepCfg.color : colors.border;
        return (
          <React.Fragment key={step}>
            <View style={styles.trackerStep}>
              <View style={[styles.trackerDot, { backgroundColor: done ? dotColor : colors.card, borderColor: dotColor }]}>
                {done && <Ionicons name={active ? (stepCfg.icon as any) : 'checkmark'} size={14} color={active ? '#fff' : '#fff'} />}
              </View>
              <Text style={[styles.trackerLabel, { color: done ? colors.foreground : colors.mutedForeground, fontFamily: active ? 'Inter_600SemiBold' : 'Inter_400Regular' }]}>
                {stepCfg.label}
              </Text>
            </View>
            {idx < STATUS_STEPS.length - 1 && (
              <View style={[styles.trackerLine, { backgroundColor: currentStep > idx ? stepCfg.color : colors.border }]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

export default function OrderDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { orders, isLoading, refetch } = useOrders();
  const { restaurants } = useRestaurants();
  const { reorder } = useCart();
  const [reordering, setReordering] = useState(false);
  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;

  const order = useMemo(() => orders.find((o) => String(o.id) === id), [orders, id]);

  const canTrack = !!order && order.status !== 'delivered' && order.status !== 'cancelled';

  const handleTrack = () => {
    if (!order) return;
    const restaurant = restaurants.find((r) => r.id === order.restaurantId);
    router.push({
      pathname: '/confirmation',
      params: {
        orderId: String(order.id),
        track: '1',
        ...(restaurant?.lat != null ? { restLat: String(restaurant.lat) } : {}),
        ...(restaurant?.lng != null ? { restLng: String(restaurant.lng) } : {}),
        // Pass the order's persisted delivery address/pin through so the tracking
        // map shows the real destination instead of a generic offset.
        ...(order.deliveryAddress ? { address: order.deliveryAddress } : {}),
        ...(order.deliveryLat != null ? { destLat: order.deliveryLat } : {}),
        ...(order.deliveryLng != null ? { destLng: order.deliveryLng } : {}),
      },
    } as any);
  };

  const handleReorder = async () => {
    if (!order || reordering) return;
    setReordering(true);
    try {
      const result = await reorder(order);
      Haptics.notificationAsync(
        result.addedCount > 0
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning,
      );
      router.push('/(tabs)/cart' as any);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setReordering(false);
    }
  };

  const serviceFee = order ? parseFloat(order.subtotal) * 0.05 : 0;
  const total = order ? parseFloat(order.subtotal) + serviceFee : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.background }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Order Details</Text>
        <View style={styles.backBtn} />
      </View>

      {isLoading && !order ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !order ? (
        <View style={styles.notFound}>
          <Ionicons name="alert-circle" size={48} color={colors.destructive} />
          <Text style={[styles.notFoundText, { color: colors.foreground }]}>Order not found</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={[styles.backLink, { color: colors.primary }]}>Go back</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 100, gap: 16 }}>
          {/* Restaurant & Date */}
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={[styles.cardIconRow, { borderBottomColor: colors.border }]}>
              <View style={[styles.restaurantIcon, { backgroundColor: colors.muted }]}>
                <Ionicons name="restaurant" size={24} color={colors.foreground} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.restaurantName, { color: colors.foreground }]}>
                  {order.restaurantName ?? 'Restaurant'}
                </Text>
                <Text style={[styles.orderMeta, { color: colors.mutedForeground }]}>
                  Order #{order.id} · {order.deliveryType === 'pickup' ? 'Pickup' : 'Delivery'}
                  {order.feastWindowId ? ' · Feast Window' : ''}
                </Text>
              </View>
            </View>
            <View style={styles.dateRow}>
              <Ionicons name="calendar" size={16} color={colors.mutedForeground} />
              <Text style={[styles.dateText, { color: colors.mutedForeground }]}>
                {formatDate(order.createdAt)} at {formatTime(order.createdAt)}
              </Text>
            </View>
          </View>

          {/* Status tracker */}
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, borderBottomColor: colors.border }]}>Order Status</Text>
            <View style={{ padding: 20 }}>
              <StatusTracker status={order.status} />
            </View>
          </View>

          {/* Items */}
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, borderBottomColor: colors.border }]}>
              Items ({order.items.reduce((s, i) => s + i.quantity, 0)})
            </Text>
            {order.items.map((item, idx) => (
              <View key={idx} style={[styles.itemRow, { borderBottomColor: colors.border }, idx === order.items.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={[styles.qtyBadge, { backgroundColor: colors.muted }]}>
                  <Text style={[styles.qtyText, { color: colors.foreground }]}>{item.quantity}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemName, { color: colors.foreground }]}>{item.name}</Text>
                  {item.specialInstructions ? (
                    <Text style={[styles.itemNote, { color: colors.mutedForeground }]}>{item.specialInstructions}</Text>
                  ) : null}
                </View>
                <Text style={[styles.itemPrice, { color: colors.foreground }]}>
                  ${(item.price * item.quantity).toFixed(2)}
                </Text>
              </View>
            ))}
          </View>

          {/* Total */}
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, borderBottomColor: colors.border }]}>Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Subtotal</Text>
              <Text style={[styles.summaryValue, { color: colors.foreground }]}>{formatTotal(order.subtotal)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Service fee</Text>
              <Text style={[styles.summaryValue, { color: colors.foreground }]}>${serviceFee.toFixed(2)}</Text>
            </View>
            <View style={[styles.summaryRow, styles.totalRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.totalLabel, { color: colors.foreground }]}>Total</Text>
              <Text style={[styles.totalValue, { color: colors.foreground }]}>${total.toFixed(2)}</Text>
            </View>
          </View>

          {/* Rating (delivered orders only) */}
          {order.status === 'delivered' && (
            <RatingCard order={order} onRated={() => refetch()} />
          )}

          {/* Actions */}
          <View style={styles.actions}>
            {canTrack && (
              <TouchableOpacity
                style={[styles.trackBtn, { borderColor: colors.primary }]}
                onPress={handleTrack}
                activeOpacity={0.85}
              >
                <Ionicons name="navigate" size={18} color={colors.primary} />
                <Text style={[styles.trackText, { color: colors.primary }]}>Track Order</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.reorderBtn, { backgroundColor: colors.primary }]}
              onPress={handleReorder}
              disabled={reordering}
              activeOpacity={0.85}
            >
              {reordering ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="refresh" size={18} color="#fff" />
                  <Text style={styles.reorderText}>Reorder Items</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  notFoundText: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  backLink: { fontSize: 16, fontFamily: 'Inter_500Medium' },
  card: { 
    borderRadius: 20, 
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardIconRow: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  restaurantIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  restaurantName: { fontSize: 18, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  orderMeta: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16 },
  dateText: { fontSize: 15, fontFamily: 'Inter_400Regular' },
  sectionTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  tracker: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  trackerStep: { alignItems: 'center', flex: 1, gap: 8 },
  trackerDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  trackerLabel: { fontSize: 11, textAlign: 'center', lineHeight: 16 },
  trackerLine: { height: 2, flex: 0.5, marginTop: 15 },
  cancelledBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16 },
  cancelledText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  qtyBadge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  qtyText: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  itemName: { fontSize: 16, fontFamily: 'Inter_500Medium' },
  itemNote: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 4 },
  itemPrice: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  summaryLabel: { fontSize: 15, fontFamily: 'Inter_400Regular' },
  summaryValue: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  totalRow: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 8, paddingTop: 16, paddingBottom: 20 },
  totalLabel: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  totalValue: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  actions: { gap: 12, marginTop: 8 },
  trackBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 18, borderRadius: 16, borderWidth: 1 },
  trackText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  reorderBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 18, borderRadius: 16 },
  reorderText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
});