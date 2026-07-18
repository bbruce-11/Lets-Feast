import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { getAvailableOrders, claimOrder, type CourierOrder } from '@/lib/api';

const POLL_MS = 8000;

export default function AvailableOrdersScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const { data: orders, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['courier', 'available'],
    queryFn: getAvailableOrders,
    refetchInterval: POLL_MS,
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.navy }]}>Available Deliveries</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {orders?.length ?? 0} ready for pickup
        </Text>
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.centered} color={colors.primary} />
      ) : error ? (
        <View style={styles.centered}>
          <Text style={{ color: colors.destructive }}>Couldn't load orders</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          onRefresh={refetch}
          refreshing={isRefetching}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={{ color: colors.mutedForeground }}>No deliveries available right now</Text>
            </View>
          }
          renderItem={({ item }) => (
            <AvailableOrderCard
              order={item}
              onClaimed={() => {
                queryClient.invalidateQueries({ queryKey: ['courier', 'available'] });
                queryClient.invalidateQueries({ queryKey: ['courier', 'mine'] });
              }}
            />
          )}
        />
      )}
    </View>
  );
}

function AvailableOrderCard({ order, onClaimed }: { order: CourierOrder; onClaimed: () => void }) {
  const colors = useColors();
  const [isClaiming, setIsClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClaim() {
    setIsClaiming(true);
    setError(null);
    try {
      await claimOrder(order.id);
      onClaimed();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not claim this order');
      setIsClaiming(false);
    }
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>{order.restaurantName}</Text>
        <Text style={{ color: colors.foreground, fontWeight: '700' }}>
          ${(order.tipCents / 100).toFixed(2)} tip
        </Text>
      </View>
      {order.deliveryAddress && (
        <View style={styles.addressRow}>
          <Ionicons name="location-outline" size={14} color={colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground, fontSize: 13, flex: 1 }} numberOfLines={2}>
            {order.deliveryAddress}
          </Text>
        </View>
      )}
      {error && <Text style={{ color: colors.destructive, fontSize: 12 }}>{error}</Text>}
      <TouchableOpacity
        onPress={handleClaim}
        disabled={isClaiming}
        style={[styles.claimButton, { backgroundColor: colors.primary }]}
      >
        {isClaiming ? (
          <ActivityIndicator color={colors.primaryForeground} size="small" />
        ) : (
          <Text style={{ color: colors.primaryForeground, fontWeight: '700' }}>Claim Delivery</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 14, marginTop: 4 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '700', flex: 1, marginRight: 8 },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  claimButton: { height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
