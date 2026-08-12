import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { RestaurantCard } from '@/components/RestaurantCard';
import { FeastWindowCard } from '@/components/FeastWindowCard';
import { getRestaurants, getFeastWindows, getJoinedFeastWindowIds, joinFeastWindow, type ApiRestaurant } from '@/lib/api';

function RestaurantSection({
  title,
  restaurants,
}: {
  title: string;
  restaurants: ApiRestaurant[];
}) {
  const colors = useColors();
  if (restaurants.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
      </View>
      <FlatList
        data={restaurants}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.cardRow}
        renderItem={({ item }) => <RestaurantCard restaurant={item} />}
      />
    </View>
  );
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
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
  const openRestaurants = (restaurants ?? []).filter((r) => r.isOpen);
  const firstName = user?.fullName?.split(' ')[0] ?? 'there';

  async function handleJoinWindow(windowId: string) {
    await joinFeastWindow(windowId);
    await refetchJoined();
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: colors.border }]}>
        <View style={styles.topRow}>
          <View style={styles.logoRow}>
            <Image source={require('@/assets/images/logo.png')} style={styles.logoMark} resizeMode="contain" />
            <Text style={[styles.logoText, { color: colors.foreground }]} numberOfLines={1}>
              Let's Feast
            </Text>
          </View>
          <View style={styles.locationRow}>
            <View style={[styles.locationIconWrap, { backgroundColor: colors.muted }]}>
              <Ionicons name="location" size={14} color={colors.foreground} />
            </View>
            <Text style={[styles.locationText, { color: colors.foreground }]}>Chicago, IL</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/profile')}
            activeOpacity={0.8}
          >
            <View style={[styles.avatarCircle, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
            </View>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => router.push('/(tabs)/search')}
          style={[styles.searchBar, { backgroundColor: colors.muted }]}
        >
          <Ionicons name="search" size={20} color={colors.mutedForeground} />
          <Text style={[styles.searchText, { color: colors.mutedForeground }]}>Search restaurants...</Text>
        </TouchableOpacity>
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
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        >
          <View style={styles.greeting}>
            <Text style={[styles.greetingText, { color: colors.foreground }]}>
              What are you craving, {firstName}?
            </Text>
            <Text style={[styles.moodText, { color: colors.mutedForeground }]}>
              {restaurants?.length ?? 0} restaurant{restaurants?.length === 1 ? '' : 's'} nearby
            </Text>
          </View>

          {feastWindows && feastWindows.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Feast Windows</Text>
              </View>
              <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>
                Join with others ordering nearby to unlock a discount
              </Text>
              {feastWindows.map((win) => (
                <View key={win.id} style={{ marginTop: 10, paddingHorizontal: 20 }}>
                  <FeastWindowCard
                    window={win}
                    isJoined={joinedIds?.includes(win.id) ?? false}
                    onJoin={handleJoinWindow}
                    restaurantName={restaurantNameById.get(win.restaurantId)}
                  />
                </View>
              ))}
            </View>
          )}

          {restaurants && restaurants.length === 0 ? (
            <View style={styles.centered}>
              <Text style={{ color: colors.mutedForeground }}>No restaurants yet — check back soon.</Text>
            </View>
          ) : (
            <>
              <RestaurantSection title="Recommended For You" restaurants={openRestaurants.slice(0, 6)} />
              <RestaurantSection title="Popular Near You" restaurants={openRestaurants.slice(2, 8)} />
              <RestaurantSection title="All Restaurants" restaurants={openRestaurants} />
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  logoMark: { width: 28, height: 26 },
  logoText: { fontSize: 20, fontFamily: 'Inter_700Bold', flexShrink: 1 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0, marginHorizontal: 12 },
  locationIconWrap: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  locationText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  avatarCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14 },
  searchText: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  greeting: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 },
  greetingText: { fontSize: 26, fontFamily: 'Inter_700Bold', marginBottom: 6 },
  moodText: { fontSize: 15, fontFamily: 'Inter_400Regular' },
  section: { marginTop: 24, marginBottom: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle: { fontSize: 19, fontFamily: 'Inter_700Bold' },
  sectionSubtitle: { fontSize: 13, marginTop: -6, marginBottom: 10, paddingHorizontal: 20, fontFamily: 'Inter_400Regular' },
  cardRow: { paddingLeft: 20, paddingRight: 4 },
});
