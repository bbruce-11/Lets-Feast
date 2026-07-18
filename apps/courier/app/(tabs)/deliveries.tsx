import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, FlatList, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { getMyDeliveries, updateDeliveryStatus, type CourierOrder } from '@/lib/api';

const POLL_MS = 8000;

export default function MyDeliveriesScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const { data: orders, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['courier', 'mine'],
    queryFn: getMyDeliveries,
    refetchInterval: POLL_MS,
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.navy }]}>My Deliveries</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.centered} color={colors.primary} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          onRefresh={refetch}
          refreshing={isRefetching}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={{ color: colors.mutedForeground }}>
                No active deliveries — claim one from the Available tab
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <DeliveryCard
              order={item}
              onUpdated={() => queryClient.invalidateQueries({ queryKey: ['courier', 'mine'] })}
            />
          )}
        />
      )}
    </View>
  );
}

function DeliveryCard({ order, onUpdated }: { order: CourierOrder; onUpdated: () => void }) {
  const colors = useColors();
  const [isUpdating, setIsUpdating] = useState(false);

  const nextStatus = order.status === 'driver_assigned' ? 'on_the_way' : order.status === 'on_the_way' ? 'delivered' : null;
  const nextLabel = nextStatus === 'on_the_way' ? "I've Picked It Up" : nextStatus === 'delivered' ? 'Mark Delivered' : null;

  async function handleAdvance() {
    if (!nextStatus) return;
    setIsUpdating(true);
    try {
      await updateDeliveryStatus(order.id, nextStatus);
      onUpdated();
    } finally {
      setIsUpdating(false);
    }
  }

  function openMaps() {
    if (order.deliveryLat != null && order.deliveryLng != null) {
      Linking.openURL(`https://maps.apple.com/?daddr=${order.deliveryLat},${order.deliveryLng}`);
    } else if (order.deliveryAddress) {
      Linking.openURL(`https://maps.apple.com/?daddr=${encodeURIComponent(order.deliveryAddress)}`);
    }
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>{order.restaurantName}</Text>
        <View style={[styles.statusBadge, { backgroundColor: colors.primary + '1A' }]}>
          <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>
            {order.status === 'driver_assigned' ? 'Pick up' : 'Delivering'}
          </Text>
        </View>
      </View>

      {order.customerName && (
        <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>{order.customerName}</Text>
      )}

      {order.deliveryAddress && (
        <TouchableOpacity onPress={openMaps} style={styles.addressRow}>
          <Ionicons name="navigate-outline" size={14} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 13, flex: 1, textDecorationLine: 'underline' }} numberOfLines={2}>
            {order.deliveryAddress}
          </Text>
        </TouchableOpacity>
      )}

      {order.customerPhone && (
        <TouchableOpacity onPress={() => Linking.openURL(`tel:${order.customerPhone}`)} style={styles.addressRow}>
          <Ionicons name="call-outline" size={14} color={colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>{order.customerPhone}</Text>
        </TouchableOpacity>
      )}

      {nextLabel && (
        <TouchableOpacity
          onPress={handleAdvance}
          disabled={isUpdating}
          style={[styles.advanceButton, { backgroundColor: colors.primary }]}
        >
          {isUpdating ? (
            <ActivityIndicator color={colors.primaryForeground} size="small" />
          ) : (
            <Text style={{ color: colors.primaryForeground, fontWeight: '700' }}>{nextLabel}</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: '700' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingHorizontal: 40 },
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '700', flex: 1, marginRight: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  advanceButton: { height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
});
