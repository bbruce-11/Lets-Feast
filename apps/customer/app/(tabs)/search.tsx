import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { getRestaurants, type ApiRestaurant } from '@/lib/api';

export default function SearchScreen() {
  const colors = useColors();
  const [query, setQuery] = useState('');
  const { data: restaurants } = useQuery({ queryKey: ['restaurants'], queryFn: getRestaurants });

  const cuisines = useMemo(() => {
    const set = new Set((restaurants ?? []).map((r) => r.cuisine));
    return Array.from(set).slice(0, 6);
  }, [restaurants]);

  const results = useMemo(() => {
    if (!restaurants) return [];
    const q = query.trim().toLowerCase();
    if (!q) return restaurants;
    return restaurants.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.cuisine.toLowerCase().includes(q) ||
        r.neighborhood.toLowerCase().includes(q),
    );
  }, [restaurants, query]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.foreground }]}>Search</Text>

      <View style={[styles.searchBar, { backgroundColor: colors.muted }]}>
        <Ionicons name="search" size={18} color={colors.mutedForeground} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search restaurants, cuisines, neighborhoods"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.searchInput, { color: colors.foreground }]}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      {query.length === 0 && cuisines.length > 0 && (
        <View style={styles.chipRow}>
          {cuisines.map((cuisine) => (
            <TouchableOpacity
              key={cuisine}
              onPress={() => setQuery(cuisine)}
              style={[styles.chip, { backgroundColor: colors.muted }]}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, { color: colors.foreground }]}>{cuisine}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          query.length > 0 ? (
            <Text style={[styles.empty, { color: colors.mutedForeground }]}>
              No restaurants match "{query}"
            </Text>
          ) : null
        }
        renderItem={({ item }) => <ResultRow restaurant={item} />}
      />
    </View>
  );
}

function ResultRow({ restaurant }: { restaurant: ApiRestaurant }) {
  const colors = useColors();
  return (
    <TouchableOpacity
      onPress={() => router.push(`/restaurant/${restaurant.id}`)}
      style={[styles.row, { backgroundColor: colors.card }]}
      activeOpacity={0.85}
    >
      <View style={[styles.rowIcon, { backgroundColor: colors.muted }]}>
        <Text style={[styles.rowIconText, { color: colors.primary }]}>
          {restaurant.name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowName, { color: colors.foreground }]} numberOfLines={1}>
          {restaurant.name}
        </Text>
        <Text style={[styles.rowSub, { color: colors.mutedForeground }]} numberOfLines={1}>
          {restaurant.cuisine} · {restaurant.neighborhood}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 24, fontFamily: 'Inter_700Bold', paddingHorizontal: 20, paddingTop: 16 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 4,
    height: 48,
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  searchInput: { flex: 1, fontSize: 15, height: '100%', fontFamily: 'Inter_400Regular' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, marginTop: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  chipText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  list: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  rowIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  rowIconText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  rowName: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  rowSub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  empty: { textAlign: 'center', marginTop: 40, fontFamily: 'Inter_400Regular' },
});
