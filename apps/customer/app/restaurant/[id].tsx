import { useMemo } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useCart } from '@/context/CartContext';
import { getRestaurant, getRestaurantMenu, type ApiMenuItem } from '@/lib/api';

export default function RestaurantDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();

  const { data: restaurant, isLoading: loadingRestaurant } = useQuery({
    queryKey: ['restaurant', id],
    queryFn: () => getRestaurant(id!),
    enabled: !!id,
  });

  const { data: menu, isLoading: loadingMenu } = useQuery({
    queryKey: ['restaurant', id, 'menu'],
    queryFn: () => getRestaurantMenu(id!),
    enabled: !!id,
  });

  const grouped = useMemo(() => {
    if (!menu) return [];
    const byCategory = new Map<string, ApiMenuItem[]>();
    for (const item of menu) {
      const list = byCategory.get(item.category) ?? [];
      list.push(item);
      byCategory.set(item.category, list);
    }
    return Array.from(byCategory.entries());
  }, [menu]);

  if (loadingRestaurant || loadingMenu) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="chevron-back" size={20} color={colors.navy} />
        <Text style={{ color: colors.navy, fontWeight: '600' }}>Back</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={[styles.name, { color: colors.navy }]}>{restaurant?.name}</Text>
        <Text style={[styles.meta, { color: colors.mutedForeground }]}>
          {restaurant?.cuisine} · {restaurant?.neighborhood}
        </Text>
      </View>

      {grouped.length === 0 ? (
        <Text style={[styles.emptyMenu, { color: colors.mutedForeground }]}>
          Menu coming soon
        </Text>
      ) : (
        grouped.map(([category, items]) => (
          <View key={category} style={styles.categoryBlock}>
            <Text style={[styles.categoryTitle, { color: colors.foreground }]}>{category}</Text>
            {items.map((item) => (
              <MenuItemRow key={item.id} item={item} restaurantName={restaurant?.name ?? ''} />
            ))}
          </View>
        ))
      )}
    </ScrollView>
  );
}

function MenuItemRow({ item, restaurantName }: { item: ApiMenuItem; restaurantName: string }) {
  const colors = useColors();
  const { addItem } = useCart();
  const price = Number.parseFloat(item.price);

  return (
    <View style={[styles.menuItem, { borderColor: colors.border }]}>
      <View style={styles.menuItemText}>
        <Text style={[styles.menuItemName, { color: colors.foreground }]}>{item.name}</Text>
        {!!item.description && (
          <Text style={[styles.menuItemDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
            {item.description}
          </Text>
        )}
        <Text style={[styles.menuItemPrice, { color: colors.foreground }]}>${price.toFixed(2)}</Text>
      </View>
      <TouchableOpacity
        onPress={() => addItem(item, restaurantName)}
        style={[styles.addButton, { backgroundColor: colors.primary }]}
        hitSlop={8}
      >
        <Ionicons name="add" size={20} color={colors.primaryForeground} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16 },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  name: { fontSize: 24, fontWeight: '700' },
  meta: { fontSize: 14, marginTop: 4 },
  emptyMenu: { textAlign: 'center', marginTop: 40 },
  categoryBlock: { paddingHorizontal: 20, marginTop: 20 },
  categoryTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  menuItemText: { flex: 1, paddingRight: 12 },
  menuItemName: { fontSize: 15, fontWeight: '600' },
  menuItemDesc: { fontSize: 13, marginTop: 2 },
  menuItemPrice: { fontSize: 15, fontWeight: '600' },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
});
