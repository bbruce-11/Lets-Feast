import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { FeastWindowCard } from '@/components/FeastWindowCard';
import { getRestaurants, getFeastWindows, getJoinedFeastWindowIds, joinFeastWindow, type ApiRestaurant } from '@/lib/api';

export default function HomeScreen() {
  const colors = useColors();
  const { data: restaurants, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['restaurants'],
    queryFn: getRestaurants,
  });
  const { data: feastWindows } = useQuery({
    queryKey: ['feast-windows'],
    queryFn: getFeastWindows,
  });
  const { data: joinedIds, refetch: refetchJoined } = useQuery({
    queryKey: ['feast-windows', 'joined'],
    queryFn: getJoinedFeastWindowIds,
  });

  const restaurantNameById = new Map((restaurants ?? []).map((r) => [r.id, r.name]));

  async function handleJoinWindow(windowId: string) {
    await joinFeastWindow(windowId);
    await refetchJoined();
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.navy }]}>Let's Feast</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {restaurants?.length ?? 0} restaurant{restaurants?.length === 1 ? '' : 's'} nearby
        </Text>
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.centered} color={colors.primary} />
      ) : error ? (
        <View style={styles.centered}>
          <Text style={{ color: colors.destructive }}>Couldn't load restaurants</Text>
          <TouchableOpacity onPress={() => refetch()} style={{ marginTop: 12 }}>
            <Text style={{ color: colors.primary, fontWeight: '600' }}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={restaurants}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onRefresh={refetch}
          refreshing={isRefetching}
          ListHeaderComponent={
            feastWindows && feastWindows.length > 0 ? (
              <View style={styles.feastWindowsSection}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Feast Windows</Text>
                <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>
                  Join with others ordering nearby to unlock a discount
                </Text>
                {feastWindows.map((win) => (
                  <View key={win.id} style={{ marginTop: 10 }}>
                    <FeastWindowCard
                      window={win}
                      isJoined={joinedIds?.includes(win.id) ?? false}
                      onJoin={handleJoinWindow}
                      restaurantName={restaurantNameById.get(win.restaurantId)}
                    />
                  </View>
                ))}
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={{ color: colors.mutedForeground }}>
                No restaurants yet — check back soon.
              </Text>
            </View>
          }
          renderItem={({ item }) => <RestaurantCard restaurant={item} />}
        />
      )}
    </View>
  );
}

function RestaurantCard({ restaurant }: { restaurant: ApiRestaurant }) {
  const colors = useColors();
  const rating = restaurant.rating != null ? Number.parseFloat(restaurant.rating) : null;

  return (
    <TouchableOpacity
      onPress={() => router.push(`/restaurant/${restaurant.id}`)}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      activeOpacity={0.8}
    >
      <View style={styles.cardHeader}>
        <Text style={[styles.cardName, { color: colors.foreground }]} numberOfLines={1}>
          {restaurant.name}
        </Text>
        {!restaurant.isOpen && (
          <View style={[styles.closedBadge, { backgroundColor: colors.muted }]}>
            <Text style={[styles.closedText, { color: colors.mutedForeground }]}>Closed</Text>
          </View>
        )}
      </View>
      <Text style={[styles.cardMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
        {restaurant.cuisine} · {restaurant.neighborhood}
      </Text>
      {rating != null && (
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={13} color={colors.accent} />
          <Text style={[styles.ratingText, { color: colors.mutedForeground }]}>
            {rating.toFixed(1)} ({restaurant.numRatings})
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: '700' },
  subtitle: { fontSize: 14, marginTop: 4 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  feastWindowsSection: { marginBottom: 20, paddingHorizontal: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  sectionSubtitle: { fontSize: 13, marginTop: 2, marginBottom: 4 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardName: { fontSize: 17, fontWeight: '700', flex: 1 },
  closedBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  closedText: { fontSize: 11, fontWeight: '600' },
  cardMeta: { fontSize: 13, marginTop: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  ratingText: { fontSize: 13 },
});
