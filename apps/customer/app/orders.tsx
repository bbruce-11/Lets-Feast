import { useState } from 'react';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { getMyOrders, rateOrder, type ApiOrder } from '@/lib/api';

const STATUS_LABELS: Record<string, string> = {
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  driver_assigned: 'Driver assigned',
  on_the_way: 'On the way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export default function OrderHistoryScreen() {
  const colors = useColors();
  const { data: orders, isLoading } = useQuery({ queryKey: ['orders', 'me'], queryFn: getMyOrders });

  const sorted = [...(orders ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.navy} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.navy }]}>Your Orders</Text>
        <View style={{ width: 22 }} />
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.mutedForeground }]}>No orders yet</Text>
          }
          renderItem={({ item }) => <OrderRow order={item} />}
        />
      )}
    </View>
  );
}

function OrderRow({ order }: { order: ApiOrder }) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const [isRating, setIsRating] = useState(false);

  const date = new Date(order.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

  async function handleRate(stars: number) {
    setIsRating(true);
    try {
      await rateOrder(order.id, stars);
      queryClient.invalidateQueries({ queryKey: ['orders', 'me'] });
    } finally {
      setIsRating(false);
    }
  }

  return (
    <TouchableOpacity
      onPress={() => router.push({ pathname: '/order/[id]', params: { id: String(order.id) } })}
      style={[styles.row, { borderColor: colors.border, backgroundColor: colors.card }]}
      activeOpacity={0.8}
    >
      <View style={styles.rowHeader}>
        <Text style={[styles.rowName, { color: colors.foreground }]} numberOfLines={1}>
          {order.restaurantName ?? `Order #${order.id}`}
        </Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{date}</Text>
      </View>

      <View style={styles.rowMeta}>
        <Text
          style={[
            styles.statusBadge,
            {
              color: order.status === 'cancelled' ? colors.destructive : colors.primary,
              backgroundColor: order.status === 'cancelled' ? colors.destructive + '1A' : colors.primary + '1A',
            },
          ]}
        >
          {STATUS_LABELS[order.status] ?? order.status}
        </Text>
        <Text style={{ color: colors.foreground, fontWeight: '600' }}>
          ${Number.parseFloat(order.total).toFixed(2)}
        </Text>
      </View>

      {order.status === 'delivered' && (
        <View style={styles.ratingRow}>
          {order.rating != null ? (
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Ionicons
                  key={n}
                  name={n <= order.rating! ? 'star' : 'star-outline'}
                  size={16}
                  color={colors.accent}
                />
              ))}
            </View>
          ) : isRating ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <View style={styles.stars}>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, marginRight: 4 }}>Rate:</Text>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity key={n} onPress={() => handleRate(n)} hitSlop={4}>
                  <Ionicons name="star-outline" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: { fontSize: 18, fontWeight: '700' },
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 10 },
  empty: { textAlign: 'center', marginTop: 60 },
  row: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 8 },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowName: { fontSize: 15, fontWeight: '700', flex: 1, marginRight: 8 },
  rowMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusBadge: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  ratingRow: { marginTop: 2 },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
