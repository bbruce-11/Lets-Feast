import { useMemo } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useCart } from '@/context/CartContext';
import { FeastWindowCard } from '@/components/FeastWindowCard';
import {
  getRestaurant,
  getRestaurantMenu,
  getFeastWindows,
  getJoinedFeastWindowIds,
  joinFeastWindow,
  type ApiMenuItem,
} from '@/lib/api';

export default function RestaurantDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();

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

  const { data: allWindows } = useQuery({
    queryKey: ['feast-windows'],
    queryFn: getFeastWindows,
  });
  const { data: joinedIds, refetch: refetchJoined } = useQuery({
    queryKey: ['feast-windows', 'joined'],
    queryFn: getJoinedFeastWindowIds,
  });
  const restaurantWindow = allWindows?.find((w) => w.restaurantId === id);
  const { setFeastWindow } = useCart();

  async function handleJoinWindow(windowId: string) {
    await joinFeastWindow(windowId);
    await refetchJoined();
    setFeastWindow(windowId);
  }

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
      <TouchableOpacity
        onPress={() => router.back()}
        style={[styles.backButton, { paddingTop: insets.top + 12 }]}
        hitSlop={12}
      >
        <Ionicons name="chevron-back" size={20} color={colors.foreground} />
        <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>Back</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={[styles.name, { color: colors.foreground }]}>{restaurant?.name}</Text>
        <Text style={[styles.meta, { color: colors.mutedForeground }]}>
          {restaurant?.cuisine} · {restaurant?.neighborhood}
        </Text>
      </View>

      {restaurantWindow && (
        <View style={styles.feastWindowSection}>
          <FeastWindowCard
            window={restaurantWindow}
            isJoined={joinedIds?.includes(restaurantWindow.id) ?? false}
            onJoin={handleJoinWindow}
          />
        </View>
      )}

      {grouped.length === 0 ? (
        <Text style={[styles.emptyMenu, { color: colors.mutedForeground }]}>
          Menu coming soon
        </Text>
      ) : (
        grouped.map(([category, items]) => (
          <View key={category} style={styles.categoryBlock}>
            <Text style={[styles.categoryTitle, { color: colors.foreground }]}>{category}</Text>
            {items.map((item) => (
              <MenuItemCard key={item.id} item={item} restaurantName={restaurant?.name ?? ''} />
            ))}
          </View>
        ))
      )}
    </ScrollView>
  );
}

function MenuItemCard({ item, restaurantName }: { item: ApiMenuItem; restaurantName: string }) {
  const colors = useColors();
  const { items, addItem, updateQuantity } = useCart();
  const price = Number.parseFloat(item.price);
  const cartEntry = items.find((i) => i.menuItem.id === item.id);
  const quantity = cartEntry?.quantity ?? 0;

  function handleAdd() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addItem(item, restaurantName);
  }

  function handleRemove() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateQuantity(item.id, quantity - 1);
  }

  return (
    <View style={[styles.menuCard, { backgroundColor: colors.card }]}>
      <View style={styles.menuCardContent}>
        <Text style={[styles.menuItemName, { color: colors.foreground }]}>{item.name}</Text>
        {!!item.description && (
          <Text style={[styles.menuItemDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
            {item.description}
          </Text>
        )}
        {item.dietaryTags.length > 0 && (
          <View style={styles.tags}>
            {item.dietaryTags.slice(0, 2).map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
        <Text style={[styles.menuItemPrice, { color: colors.foreground }]}>${price.toFixed(2)}</Text>
      </View>
      <View style={styles.actionArea}>
        {quantity > 0 ? (
          <View style={[styles.quantityControl, { backgroundColor: colors.muted }]}>
            <TouchableOpacity onPress={handleRemove} style={styles.qtyBtn} activeOpacity={0.75} hitSlop={4}>
              <Ionicons name="remove" size={18} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[styles.qty, { color: colors.foreground }]}>{quantity}</Text>
            <TouchableOpacity onPress={handleAdd} style={styles.qtyBtn} activeOpacity={0.75} hitSlop={4}>
              <Ionicons name="add" size={18} color={colors.foreground} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            onPress={handleAdd}
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            activeOpacity={0.8}
            hitSlop={8}
          >
            <Ionicons name="add" size={20} color={colors.primaryForeground} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 16, paddingBottom: 8 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  name: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  meta: { fontSize: 14, marginTop: 4, fontFamily: 'Inter_400Regular' },
  feastWindowSection: { paddingHorizontal: 20, marginTop: 16 },
  emptyMenu: { textAlign: 'center', marginTop: 40 },
  categoryBlock: { paddingHorizontal: 20, marginTop: 20 },
  categoryTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', marginBottom: 10 },
  menuCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  menuCardContent: { flex: 1, paddingRight: 16 },
  menuItemName: { fontSize: 16, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  menuItemDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19, marginBottom: 8 },
  tags: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  tag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: '#DCFCE7' },
  tagText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#166534' },
  menuItemPrice: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  actionArea: { justifyContent: 'flex-end', alignItems: 'flex-end' },
  addBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  quantityControl: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingHorizontal: 4, paddingVertical: 4 },
  qtyBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  qty: { fontSize: 15, fontFamily: 'Inter_600SemiBold', minWidth: 24, textAlign: 'center' },
});
