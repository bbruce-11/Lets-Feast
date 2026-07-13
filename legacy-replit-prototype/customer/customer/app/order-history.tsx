import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  SectionList,
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
import { RatingStars } from '@/components/OrderRating';
import type { ApiOrder } from '@/lib/api';

const FINISHED_ORDER_STATUSES = new Set(['delivered', 'cancelled']);

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  placed: { label: 'Confirmed', color: '#A57D2D', icon: 'checkmark-circle' },
  confirmed: { label: 'Confirmed', color: '#A57D2D', icon: 'checkmark-circle' },
  preparing: { label: 'Preparing', color: '#3B82F6', icon: 'restaurant' },
  driver_assigned: { label: 'Driver Assigned', color: '#8B5CF6', icon: 'person' },
  ready: { label: 'On the Way', color: '#F59E0B', icon: 'bicycle' },
  on_the_way: { label: 'On the Way', color: '#F59E0B', icon: 'bicycle' },
  delivered: { label: 'Delivered', color: '#1E9E5A', icon: 'checkmark-done' },
  cancelled: { label: 'Cancelled', color: '#89181A', icon: 'close-circle' },
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTotal(subtotal: string) {
  const n = parseFloat(subtotal);
  return isNaN(n) ? subtotal : `$${n.toFixed(2)}`;
}

function estimatedArrival(order: ApiOrder) {
  if (order.status === 'on_the_way' || order.status === 'ready') {
    return order.etaMinutes != null ? `~${Math.max(order.etaMinutes, 1)} min` : '~15 min';
  }
  if (order.etaMinutes != null) return `~${Math.max(order.etaMinutes, 1)} min`;
  return '30–45 min';
}

function ActiveOrderCard({ order, onTrack }: { order: ApiOrder; onTrack: () => void }) {
  const colors = useColors();
  const status = STATUS_CONFIG[order.status] ?? { label: order.status, color: colors.primary, icon: 'ellipse' };

  return (
    <View style={[styles.activeCard, { backgroundColor: colors.card, borderColor: colors.primary + '40' }]}>
      <View style={styles.activeTopRow}>
        <View style={styles.liveWrap}>
          <View style={styles.liveDot} />
          <Text style={[styles.liveText, { color: '#1E9E5A' }]}>Live</Text>
        </View>
        <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
          {formatDate(order.createdAt)}
        </Text>
      </View>

      <Text style={[styles.restaurantName, { color: colors.foreground }]} numberOfLines={1}>
        {order.restaurantName ?? 'Restaurant'}
      </Text>

      <View style={styles.activeInfoRow}>
        <View style={[styles.statusPill, { backgroundColor: status.color + '15' }]}>
          <Ionicons name={status.icon as any} size={14} color={status.color} />
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
        <View style={styles.etaWrap}>
          <Ionicons name="time-outline" size={14} color={colors.mutedForeground} />
          <Text style={[styles.etaText, { color: colors.mutedForeground }]}>{estimatedArrival(order)}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.trackBtn, { backgroundColor: colors.primary }]}
        onPress={onTrack}
        activeOpacity={0.85}
      >
        <Ionicons name="navigate" size={18} color={colors.primaryForeground} />
        <Text style={[styles.trackText, { color: colors.primaryForeground }]}>Track Order</Text>
      </TouchableOpacity>
    </View>
  );
}

function OrderCard({ order, onPress, onReorder, reordering }: { order: ApiOrder; onPress: () => void; onReorder: () => void; reordering: boolean }) {
  const colors = useColors();
  const status = STATUS_CONFIG[order.status] ?? { label: order.status, color: colors.mutedForeground, icon: 'ellipse' };
  const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0);
  const itemLabel = itemCount === 1 ? '1 item' : `${itemCount} items`;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <Text style={[styles.restaurantName, { color: colors.foreground }]} numberOfLines={1}>
            {order.restaurantName ?? 'Restaurant'}
          </Text>
          <Text style={[styles.total, { color: colors.foreground }]}>{formatTotal(order.subtotal)}</Text>
        </View>
        <View style={styles.cardMeta}>
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
            {formatDate(order.createdAt)} · {itemLabel}
          </Text>
          <View style={[styles.statusPill, { backgroundColor: status.color + '15' }]}>
            <Ionicons name={status.icon as any} size={14} color={status.color} />
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.itemsPreview, { borderTopColor: colors.border }]}>
        {order.items.slice(0, 2).map((item, idx) => (
          <Text key={idx} style={[styles.itemLine, { color: colors.mutedForeground }]} numberOfLines={1}>
            <Text style={{ fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>{item.quantity}×</Text> {item.name}
          </Text>
        ))}
        {order.items.length > 2 && (
          <Text style={[styles.itemLine, { color: colors.mutedForeground }]}>
            +{order.items.length - 2} more
          </Text>
        )}
      </View>

      {order.deliveryType !== 'pickup' && order.deliveryAddress ? (
        <View style={[styles.addressRow, { borderTopColor: colors.border }]}>
          <Ionicons name="location-outline" size={14} color={colors.mutedForeground} />
          <Text style={[styles.addressText, { color: colors.mutedForeground }]} numberOfLines={1}>
            {order.deliveryAddress}
          </Text>
        </View>
      ) : null}

      {order.status === 'delivered' && (
        <View style={[styles.ratingRow, { borderTopColor: colors.border }]}>
          {order.rating != null ? (
            <>
              <Text style={[styles.ratingLabel, { color: colors.mutedForeground }]}>
                Your rating
              </Text>
              <RatingStars rating={order.rating} size={16} />
            </>
          ) : (
            <>
              <Ionicons name="star-outline" size={16} color={colors.primary} />
              <Text style={[styles.ratePrompt, { color: colors.primary }]}>
                Rate this order
              </Text>
            </>
          )}
        </View>
      )}

      <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
        <Text style={[styles.deliveryType, { color: colors.mutedForeground }]}>
          {order.deliveryType === 'pickup' ? 'Pickup' : 'Delivery'}
          {order.feastWindowId ? ' · Feast Window' : ''}
        </Text>
        <TouchableOpacity
          style={[styles.reorderBtn, { borderColor: colors.primary }]}
          onPress={onReorder}
          disabled={reordering}
          activeOpacity={0.7}
        >
          {reordering ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <Ionicons name="refresh" size={16} color={colors.primary} />
              <Text style={[styles.reorderText, { color: colors.primary }]}>Reorder</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

function EmptyState() {
  const colors = useColors();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
        <Ionicons name="receipt" size={40} color={colors.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No orders yet</Text>
      <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
        Your Feast orders will show up here once you place one.
      </Text>
    </View>
  );
}

export default function OrderHistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { orders, isLoading, error, refetch } = useOrders();
  const { restaurants } = useRestaurants();
  const { reorder } = useCart();
  const [reorderingId, setReorderingId] = useState<number | null>(null);
  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const handleReorder = async (order: ApiOrder) => {
    if (reorderingId != null) return;
    setReorderingId(order.id);
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
      setReorderingId(null);
    }
  };

  const handleTrack = (order: ApiOrder) => {
    const restaurant = restaurants.find((r) => r.id === order.restaurantId);
    router.push({
      pathname: '/confirmation',
      params: {
        orderId: String(order.id),
        track: '1',
        ...(restaurant?.lat != null ? { restLat: String(restaurant.lat) } : {}),
        ...(restaurant?.lng != null ? { restLng: String(restaurant.lng) } : {}),
        ...(order.deliveryAddress ? { address: order.deliveryAddress } : {}),
        ...(order.deliveryLat != null ? { destLat: order.deliveryLat } : {}),
        ...(order.deliveryLng != null ? { destLng: order.deliveryLng } : {}),
      },
    } as any);
  };

  const sections = useMemo(() => {
    const byNewest = (a: ApiOrder, b: ApiOrder) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    const active = orders.filter((o) => !FINISHED_ORDER_STATUSES.has(o.status)).sort(byNewest);
    const past = orders.filter((o) => FINISHED_ORDER_STATUSES.has(o.status)).sort(byNewest);
    const result: { title: string; kind: 'active' | 'past'; data: ApiOrder[] }[] = [];
    if (active.length > 0) result.push({ title: 'Active Orders', kind: 'active', data: active });
    if (past.length > 0) result.push({ title: 'Past Orders', kind: 'past', data: past });
    return result;
  }, [orders]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.background }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Orders</Text>
        <View style={styles.backBtn} />
      </View>

      {isLoading && orders.length === 0 ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.empty}>
          <Ionicons name="alert-circle" size={48} color={colors.destructive} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Couldn't load orders</Text>
          <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={refetch}>
            <Text style={[styles.retryText, { color: colors.primaryForeground }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          renderSectionHeader={({ section }) => (
            <Text style={[styles.sectionHeader, { color: colors.foreground, backgroundColor: colors.background }]}>
              {section.title}
            </Text>
          )}
          renderItem={({ item, section }) =>
            section.kind === 'active' ? (
              <ActiveOrderCard order={item} onTrack={() => handleTrack(item)} />
            ) : (
              <OrderCard
                order={item}
                onPress={() => router.push({ pathname: '/order/[id]', params: { id: String(item.id) } } as any)}
                onReorder={() => handleReorder(item)}
                reordering={reorderingId === item.id}
              />
            )
          }
          ListEmptyComponent={<EmptyState />}
          contentContainerStyle={{ padding: 20, paddingBottom: 100, flexGrow: 1 }}
          SectionSeparatorComponent={() => <View style={{ height: 12 }} />}
          ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          onRefresh={refetch}
          refreshing={isLoading}
        />
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
  sectionHeader: { fontSize: 18, fontFamily: 'Inter_700Bold', paddingBottom: 12 },
  activeCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  activeTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  liveWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },
  liveText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  activeInfoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  etaWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  etaText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  trackBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 16 },
  trackText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: { padding: 16 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  restaurantName: { fontSize: 18, fontFamily: 'Inter_700Bold', flex: 1, marginRight: 8 },
  total: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  cardMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 },
  metaText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  itemsPreview: { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, gap: 4 },
  itemLine: { fontSize: 15, fontFamily: 'Inter_400Regular' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
  ratingLabel: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  ratePrompt: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    backgroundColor: '#F7F7F8',
  },
  deliveryType: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  addressText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular' },
  reorderBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, backgroundColor: '#fff' },
  reorderText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  emptySubtitle: { fontSize: 15, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22 },
  retryBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20 },
  retryText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
});
