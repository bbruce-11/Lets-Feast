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
      <View style={[styles.searchBar, { backgroundColor: colors.input }]}>
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
      style={[styles.row, { borderColor: colors.border }]}
      activeOpacity={0.7}
    >
      <Text style={[styles.rowName, { color: colors.foreground }]}>{restaurant.name}</Text>
      <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
        {restaurant.cuisine} · {restaurant.neighborhood}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    height: 46,
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  searchInput: { flex: 1, fontSize: 15, height: '100%' },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  row: { paddingVertical: 14, borderBottomWidth: 1 },
  rowName: { fontSize: 15, fontWeight: '600' },
  empty: { textAlign: 'center', marginTop: 40 },
});
