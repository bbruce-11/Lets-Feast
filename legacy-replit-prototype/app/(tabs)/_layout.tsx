import { BlurView } from "expo-blur";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useCart } from "@/context/CartContext";
import { useFeastWindowContext } from "@/context/FeastWindowContext";
import { useOrders } from "@/hooks/useOrders";
import type { ApiOrder } from "@/lib/api";
import {
  getActiveOrders,
  deriveBannerDisplay,
  buildTrackParams,
  type WsOrderTracking,
} from "@/lib/liveOrderBanner";

/** Clear wsTracking after this many ms with no push — polled values resume. */
const WS_STALE_MS = 5_000;

interface LiveOrderBannerProps {
  order: ApiOrder;
  totalOrders?: number;
  currentIndex?: number;
  onCycle?: () => void;
}

function LiveOrderBanner({ order, totalOrders = 1, currentIndex = 0, onCycle }: LiveOrderBannerProps) {
  const colors = useColors();
  const router = useRouter();
  const { subscribe } = useFeastWindowContext();

  // Live tracking fields pushed by the server every ~1 s via order_update.
  // null until the first WS push arrives; polled values serve as the fallback.
  const [wsTracking, setWsTracking] = useState<WsOrderTracking | null>(null);
  const staleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsub = subscribe((msg) => {
      if (msg.type !== "order_update") return;
      const data = msg.data as unknown as WsOrderTracking & { id: number };
      if (!data || data.id !== order.id) return;

      // Cancel any pending stale timer and start a fresh one.
      // If no push arrives within WS_STALE_MS the cache is cleared and
      // polled values take over automatically (graceful fallback).
      if (staleTimerRef.current) clearTimeout(staleTimerRef.current);
      staleTimerRef.current = setTimeout(() => {
        setWsTracking(null);
      }, WS_STALE_MS);

      setWsTracking({
        status: data.status,
        driverProgress: data.driverProgress,
        etaMinutes: data.etaMinutes,
      });
    });
    return () => {
      unsub();
      if (staleTimerRef.current) clearTimeout(staleTimerRef.current);
    };
  }, [subscribe, order.id]);

  // Reset cached WS tracking whenever the active order changes.
  useEffect(() => {
    setWsTracking(null);
    if (staleTimerRef.current) {
      clearTimeout(staleTimerRef.current);
      staleTimerRef.current = null;
    }
  }, [order.id]);

  const { statusLabel, eta, progress } = deriveBannerDisplay(order, wsTracking);

  const handleTrack = () => {
    router.push({
      pathname: "/confirmation",
      params: buildTrackParams(order),
    });
  };

  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.bannerRow}>
        <View style={styles.bannerInfo}>
          <Text
            style={[styles.bannerName, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {order.restaurantName ?? "Your order"}
          </Text>
          <View style={styles.bannerStatusRow}>
            <View style={styles.bannerLiveDot} />
            <Text
              style={[styles.bannerStatus, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              {statusLabel}
              {eta ? ` · ${eta}` : ""}
            </Text>
          </View>
        </View>
        {totalOrders > 1 && onCycle && (
          <TouchableOpacity
            style={[styles.cycleChip, { borderColor: colors.border }]}
            onPress={onCycle}
            activeOpacity={0.7}
            accessibilityLabel={`Order ${currentIndex + 1} of ${totalOrders}. Tap to see next order.`}
          >
            <Text style={[styles.cycleChipText, { color: colors.mutedForeground }]}>
              {currentIndex + 1} / {totalOrders}
            </Text>
            <Ionicons name="chevron-forward" size={10} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.bannerTrackBtn, { backgroundColor: colors.primary }]}
          onPress={handleTrack}
          activeOpacity={0.85}
        >
          <Ionicons name="navigate" size={14} color={colors.primaryForeground} />
          <Text
            style={[styles.bannerTrackText, { color: colors.primaryForeground }]}
          >
            Track
          </Text>
        </TouchableOpacity>
      </View>
      <View
        style={[styles.progressTrack, { backgroundColor: colors.border }]}
      >
        <View
          style={[
            styles.progressFill,
            { backgroundColor: colors.primary, width: `${progress * 100}%` },
          ]}
        />
      </View>
    </View>
  );
}

function CartBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count > 9 ? "9+" : String(count)}</Text>
    </View>
  );
}

function LiveBadge({ visible }: { visible: boolean }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, pulse]);

  if (!visible) return null;

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  return (
    <View style={styles.liveBadge} pointerEvents="none">
      <Animated.View
        style={[
          styles.liveRing,
          { transform: [{ scale: ringScale }], opacity: ringOpacity },
        ]}
      />
      <View style={styles.liveDot} />
    </View>
  );
}

export default function TabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const insets = useSafeAreaInsets();
  const { totalItems } = useCart();
  const { orders } = useOrders();
  const liveOrders = getActiveOrders(orders);
  const hasActiveOrder = liveOrders.length > 0;
  const [activeOrderIdx, setActiveOrderIdx] = useState(0);
  const tabBarHeight = isWeb ? 84 : 49 + insets.bottom;

  // Clamp the selected index whenever the active-orders list changes length.
  useEffect(() => {
    if (liveOrders.length === 0) return;
    setActiveOrderIdx((i) => Math.min(i, liveOrders.length - 1));
  }, [liveOrders.length]);

  const activeOrder = liveOrders[activeOrderIdx] ?? null;
  const cycleOrder = () =>
    setActiveOrderIdx((i) => (i + 1) % liveOrders.length);

  return (
    <View style={styles.container}>
      <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.background,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View
              style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]}
            />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarIcon: ({ color }) => <Ionicons name="search-outline" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Cart",
          tabBarIcon: ({ color }) => (
            <View>
              <Ionicons name="cart-outline" size={22} color={color} />
              <CartBadge count={totalItems} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <Ionicons name="person-outline" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: ({ color }) => (
            <View>
              <Ionicons name="apps-outline" size={22} color={color} />
              <LiveBadge visible={hasActiveOrder} />
            </View>
          ),
        }}
      />
    </Tabs>
      {activeOrder ? (
        <View
          style={[styles.bannerWrap, { bottom: tabBarHeight + 8 }]}
          pointerEvents="box-none"
        >
          <LiveOrderBanner
            order={activeOrder}
            totalOrders={liveOrders.length}
            currentIndex={activeOrderIdx}
            onCycle={liveOrders.length > 1 ? cycleOrder : undefined}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bannerWrap: {
    position: "absolute",
    left: 12,
    right: 12,
  },
  banner: {
    borderRadius: 14,
    borderWidth: 1,
    paddingTop: 10,
    paddingHorizontal: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  bannerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  bannerInfo: { flex: 1, minWidth: 0 },
  bannerName: { fontSize: 14, fontFamily: "Inter_700Bold" },
  bannerStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  bannerLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#22C55E",
  },
  bannerStatus: { fontSize: 12, fontFamily: "Inter_500Medium" },
  bannerTrackBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  bannerTrackText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  cycleChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  cycleChipText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  progressTrack: {
    height: 3,
    borderRadius: 1.5,
    marginBottom: 10,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 1.5,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -8,
    backgroundColor: "#89181A",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: { color: "#fff", fontSize: 9, fontFamily: "Inter_700Bold" },
  liveBadge: {
    position: "absolute",
    top: -3,
    right: -5,
    width: 10,
    height: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  liveRing: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#22C55E",
  },
  liveDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: "#22C55E",
    borderWidth: 1.5,
    borderColor: "#fff",
  },
});
