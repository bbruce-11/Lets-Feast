import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import {
  menuItems,
  oneDrinkVenues,
  reservaRestaurants,
  cateringPackages,
  groceryProducts,
  feast360Events,
} from '@/data/mockData';
import { useRestaurants } from '@/hooks/useRestaurants';

const CATEGORIES = [
  { label: 'Restaurants', icon: 'storefront-outline' },
  { label: 'Menu Items', icon: 'fast-food-outline' },
  { label: 'Drinks', icon: 'wine-outline' },
  { label: 'Reserva', icon: 'calendar-outline' },
  { label: 'Events', icon: 'musical-notes-outline' },
  { label: 'Catering', icon: 'people-outline' },
  { label: 'Groceries', icon: 'leaf-outline' },
];

const RECENT = ['Tacos', 'Ramen', 'Pizza', 'BBQ', 'Vegan'];

function ResultRow({
  icon,
  iconBg,
  iconColor,
  initial,
  name,
  sub,
  badge,
  onPress,
  colors,
}: {
  icon?: string;
  iconBg: string;
  iconColor: string;
  initial?: string;
  name: string;
  sub: string;
  badge?: string;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <TouchableOpacity
      style={[styles.resultItem, { backgroundColor: colors.card }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={[styles.resultIcon, { backgroundColor: iconBg }]}>
        {initial ? (
          <Text style={styles.resultInitial}>{initial}</Text>
        ) : (
          <Ionicons name={icon as any} size={20} color={iconColor} />
        )}
      </View>
      <View style={styles.resultInfo}>
        <Text style={[styles.resultName, { color: colors.foreground }]}>{name}</Text>
        <Text style={[styles.resultSub, { color: colors.mutedForeground }]}>{sub}</Text>
      </View>
      {badge && (
        <View style={[styles.badge, { backgroundColor: colors.muted }]}>
          <Text style={[styles.badgeText, { color: colors.foreground }]}>{badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function SearchScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const { restaurants } = useRestaurants();

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const q = query.toLowerCase().trim();

  const filteredRestaurants = q
    ? restaurants.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.cuisine.toLowerCase().includes(q) ||
          r.neighborhood.toLowerCase().includes(q)
      )
    : [];

  const filteredItems = q
    ? menuItems.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q) ||
          m.category.toLowerCase().includes(q)
      )
    : [];

  const filteredDrinks = q
    ? oneDrinkVenues.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.type.toLowerCase().includes(q) ||
          v.neighborhood.toLowerCase().includes(q) ||
          v.deal.toLowerCase().includes(q)
      )
    : [];

  const filteredEvents = q
    ? feast360Events.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          e.neighborhood.toLowerCase().includes(q) ||
          e.venue.toLowerCase().includes(q)
      )
    : [];

  const filteredCatering = q
    ? cateringPackages.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.cuisine.toLowerCase().includes(q)
      )
    : [];

  const filteredGroceries = q
    ? groceryProducts.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          g.category.toLowerCase().includes(q)
      )
    : [];

  const filteredReserva = q
    ? reservaRestaurants.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.cuisine.toLowerCase().includes(q) ||
          r.neighborhood.toLowerCase().includes(q)
      )
    : [];

  const hasResults =
    filteredRestaurants.length > 0 ||
    filteredItems.length > 0 ||
    filteredDrinks.length > 0 ||
    filteredReserva.length > 0 ||
    filteredEvents.length > 0 ||
    filteredCatering.length > 0 ||
    filteredGroceries.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 12, backgroundColor: colors.background, borderBottomColor: colors.border },
        ]}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>Search</Text>
        <View style={[styles.searchBar, { backgroundColor: colors.muted }]}>
          <Ionicons name="search" size={20} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search restaurants, dishes, events..."
            placeholderTextColor={colors.mutedForeground}
            value={query}
            onChangeText={setQuery}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} activeOpacity={0.7} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {q.length === 0 ? (
          <View style={styles.content}>
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent Searches</Text>
              <View style={styles.recentGrid}>
                {RECENT.map((term) => (
                  <TouchableOpacity
                    key={term}
                    style={[styles.recentPill, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => setQuery(term)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="time-outline" size={14} color={colors.mutedForeground} />
                    <Text style={[styles.recentText, { color: colors.foreground }]}>{term}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Browse Categories</Text>
              <View style={styles.categoriesGrid}>
                {CATEGORIES.map(({ label, icon }) => (
                  <TouchableOpacity
                    key={label}
                    style={[styles.categoryCard, { backgroundColor: colors.card }]}
                    onPress={() => setQuery(label)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={icon as any} size={28} color={colors.primary} />
                    <Text style={[styles.categoryLabel, { color: colors.foreground }]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        ) : !hasResults ? (
          <View style={styles.noResultsWrap}>
            <View style={[styles.noResultsIcon, { backgroundColor: colors.muted }]}>
              <Ionicons name="search-outline" size={40} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.noResultsTitle, { color: colors.foreground }]}>No results found</Text>
            <Text style={[styles.noResultsSub, { color: colors.mutedForeground }]}>
              Try adjusting your search terms
            </Text>
          </View>
        ) : (
          <View style={styles.content}>
            {filteredRestaurants.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Restaurants</Text>
                {filteredRestaurants.map((r) => (
                  <ResultRow
                    key={r.id}
                    iconBg={r.bgColor}
                    iconColor="#fff"
                    initial={r.name.charAt(0)}
                    name={r.name}
                    sub={`${r.cuisine} · ${r.distance}`}
                    badge={r.deliveryTime}
                    onPress={() => router.push(`/restaurant/${r.id}` as any)}
                    colors={colors}
                  />
                ))}
              </View>
            )}

            {filteredItems.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Menu Items</Text>
                {filteredItems.slice(0, 5).map((item) => {
                  const rest = restaurants.find((r) => r.id === item.restaurantId);
                  return (
                    <ResultRow
                      key={item.id}
                      iconBg={colors.primary + '15'}
                      iconColor={colors.primary}
                      icon="fast-food"
                      name={item.name}
                      sub={`${rest?.name ?? ''} · $${item.price.toFixed(2)}`}
                      onPress={() => router.push(`/restaurant/${item.restaurantId}` as any)}
                      colors={colors}
                    />
                  );
                })}
              </View>
            )}

            {filteredDrinks.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>One Drink</Text>
                {filteredDrinks.map((v) => (
                  <ResultRow
                    key={v.id}
                    iconBg={colors.primary + '15'}
                    iconColor={colors.primary}
                    icon="wine"
                    name={v.name}
                    sub={`${v.type} · ${v.neighborhood}`}
                    badge={v.deal}
                    onPress={() => router.push('/stub' as any)}
                    colors={colors}
                  />
                ))}
              </View>
            )}

            {filteredReserva.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Reserva</Text>
                {filteredReserva.map((r) => (
                  <ResultRow
                    key={r.id}
                    iconBg={colors.primary + '15'}
                    iconColor={colors.primary}
                    icon="calendar"
                    name={r.name}
                    sub={`${r.cuisine} · ${r.neighborhood}`}
                    badge={r.nextAvailable}
                    onPress={() => router.push('/stub' as any)}
                    colors={colors}
                  />
                ))}
              </View>
            )}

            {filteredEvents.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Feast 360</Text>
                {filteredEvents.map((e) => (
                  <ResultRow
                    key={e.id}
                    iconBg={colors.primary + '15'}
                    iconColor={colors.primary}
                    icon="musical-notes"
                    name={e.name}
                    sub={`${e.venue} · ${e.date}`}
                    badge={`$${e.price}`}
                    onPress={() => router.push('/stub' as any)}
                    colors={colors}
                  />
                ))}
              </View>
            )}

            {filteredCatering.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Catering</Text>
                {filteredCatering.map((c) => (
                  <ResultRow
                    key={c.id}
                    iconBg={colors.primary + '15'}
                    iconColor={colors.primary}
                    icon="people"
                    name={c.name}
                    sub={`${c.cuisine} · Serves ${c.serves}`}
                    badge={`$${c.price}`}
                    onPress={() => router.push('/stub' as any)}
                    colors={colors}
                  />
                ))}
              </View>
            )}

            {filteredGroceries.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Groceries</Text>
                {filteredGroceries.map((g) => (
                  <ResultRow
                    key={g.id}
                    iconBg={colors.primary + '15'}
                    iconColor={colors.primary}
                    icon="leaf"
                    name={g.name}
                    sub={`${g.category} · ${g.unit}`}
                    badge={`$${g.price.toFixed(2)}`}
                    onPress={() => router.push('/stub' as any)}
                    colors={colors}
                  />
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  title: { fontSize: 32, fontFamily: 'Inter_700Bold', marginBottom: 16 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  searchInput: { flex: 1, fontSize: 16, fontFamily: 'Inter_400Regular' },
  clearBtn: { padding: 4 },
  content: { padding: 20, gap: 32 },
  section: { gap: 16 },
  sectionTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  recentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  recentPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1 },
  recentText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  categoriesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  categoryCard: { width: '48%', borderRadius: 16, padding: 20, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  categoryLabel: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2
  },
  resultIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  resultInitial: { color: '#fff', fontSize: 20, fontFamily: 'Inter_700Bold' },
  resultInfo: { flex: 1, gap: 4 },
  resultName: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  resultSub: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  noResultsWrap: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 16, paddingHorizontal: 32 },
  noResultsIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  noResultsTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  noResultsSub: { fontSize: 15, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});
