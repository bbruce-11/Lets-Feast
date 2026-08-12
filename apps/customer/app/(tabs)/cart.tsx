import { router } from 'expo-router';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useCart, type CartItem } from '@/context/CartContext';

export default function CartScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { items, restaurantName, subtotalCents, updateQuantity } = useCart();

  if (items.length === 0) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={[styles.emptyIconWrap, { backgroundColor: colors.muted }]}>
          <Ionicons name="cart-outline" size={32} color={colors.mutedForeground} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Your cart is empty</Text>
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          Add items from a restaurant to get started
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Your Cart</Text>
        <Text style={[styles.restaurantName, { color: colors.mutedForeground }]}>{restaurantName}</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.menuItem.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <CartRow item={item} onChangeQuantity={updateQuantity} />}
      />

      <View style={[styles.footer, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <View style={styles.subtotalRow}>
          <Text style={[styles.subtotalLabel, { color: colors.mutedForeground }]}>Subtotal</Text>
          <Text style={[styles.subtotalValue, { color: colors.foreground }]}>
            ${(subtotalCents / 100).toFixed(2)}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push('/checkout');
          }}
          style={[styles.checkoutButton, { backgroundColor: colors.primary }]}
          activeOpacity={0.85}
        >
          <Text style={styles.checkoutText}>Checkout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function CartRow({
  item,
  onChangeQuantity,
}: {
  item: CartItem;
  onChangeQuantity: (menuItemId: string, quantity: number) => void;
}) {
  const colors = useColors();
  const lineTotal = (Number.parseFloat(item.menuItem.price) * item.quantity).toFixed(2);

  function bump(delta: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChangeQuantity(item.menuItem.id, item.quantity + delta);
  }

  return (
    <View style={[styles.row, { backgroundColor: colors.card }]}>
      <View style={styles.rowText}>
        <Text style={[styles.rowName, { color: colors.foreground }]} numberOfLines={1}>
          {item.menuItem.name}
        </Text>
        <Text style={[styles.rowPrice, { color: colors.mutedForeground }]}>${lineTotal}</Text>
      </View>
      <View style={[styles.stepper, { backgroundColor: colors.muted }]}>
        <TouchableOpacity onPress={() => bump(-1)} style={styles.stepperButton} hitSlop={8} activeOpacity={0.75}>
          <Ionicons name="remove" size={16} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.quantity, { color: colors.foreground }]}>{item.quantity}</Text>
        <TouchableOpacity onPress={() => bump(1)} style={styles.stepperButton} hitSlop={8} activeOpacity={0.75}>
          <Ionicons name="add" size={16} color={colors.foreground} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  title: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  restaurantName: { fontSize: 15, fontFamily: 'Inter_500Medium', marginTop: 4 },
  list: { paddingHorizontal: 20, gap: 10, paddingBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  rowText: { flex: 1, paddingRight: 12 },
  rowName: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  rowPrice: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 3 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 20, paddingHorizontal: 6, paddingVertical: 6 },
  stepperButton: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  quantity: { fontSize: 15, fontFamily: 'Inter_600SemiBold', minWidth: 16, textAlign: 'center' },
  footer: { padding: 20, borderTopWidth: 1, gap: 14 },
  subtotalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  subtotalLabel: { fontSize: 15, fontFamily: 'Inter_400Regular' },
  subtotalValue: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  checkoutButton: { height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  checkoutText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff' },
});
