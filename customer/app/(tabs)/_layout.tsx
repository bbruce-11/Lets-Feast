import { BlurView } from "expo-blur";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
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
import { useOrders } from "@/hooks/useOrders";
import type { ApiOrder } from "@/lib/api";

const FINISHED_ORDER_STATUSES = new Set(["delivered", "cancelled"]);

const STATUS_LABELS: Record<string, string> = {
  placed: "Confirmed",
  confirmed: "Confirmed",
  preparing: "Preparing",
  driver_assigned: "Driver assigned",
  ready: "On the way",
  on_the_way: "On the way",
};

function hasAnyActiveOrder(orders: ApiOrder[]): boolean {
  return orders.some((order) => !FINISHED_ORDER_STATUSES.has(order.status));
}

function newestActiveOrder(orders: ApiOrder[]): ApiOrder | null {
  const active = orders.filter(
    (order) => !FINISHED_ORDER_STATUSES.has(order.status),
  );
  if (active.length === 0) return null;
  return active.reduce((latest, order) =>
    new Date(order.createdAt).getTime() > new Date(latest.createdAt).getTime()
      ? order
      : latest,
  );
}

function LiveOrderBanner({ order }: { order: ApiOrder }) {
  const colors = useColors();
  const router = useRouter();

  const statusLabel = STATUS_LABELS[order.status] ?? "In progress";
  const eta =
    order.etaMinutes != null ? `~${Math.max(order.etaMinutes, 1)} min` : null;
  const progress = Math.min(Math.max(order.driverProgress ?? 0, 0), 1);

  const handleTrack = () => {
    router.push({
      pathname: "/confirmation",
      params: {
        orderId: String(order.id),
        track: "1",
        ...(order.deliveryAddress ? { address: order.deliveryAddress } : {}),
        ...(order.deliveryLat != null ? { destLat: String(order.deliveryLat) } : {}),
        ...(order.deliveryLng != null ? { destLng: String(order.deliveryLng) } : {}),
      },
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
  const hasActiveOrder = hasAnyActiveOrder(orders);
  const activeOrder = newestActiveOrder(orders);
  const tabBarHeight = isWeb ? 84 : 49 + insets.bottom;

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
          <LiveOrderBanner order={activeOrder} />
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
