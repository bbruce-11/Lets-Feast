import { router } from 'expo-router';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useCart, type CartItem } from '@/context/CartContext';

export default function CartScreen() {
  const colors = useColors();
  const { items, restaurantName, subtotalCents, updateQuantity } = useCart();

  if (items.length === 0) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Ionicons name="cart-outline" size={40} color={colors.mutedForeground} />
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Your cart is empty</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.restaurantName, { color: colors.navy }]}>{restaurantName}</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.menuItem.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <CartRow item={item} onChangeQuantity={updateQuantity} />}
      />

      <View style={[styles.footer, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <View style={styles.subtotalRow}>
          <Text style={{ color: colors.mutedForeground }}>Subtotal</Text>
          <Text style={{ color: colors.foreground, fontWeight: '600' }}>
            ${(subtotalCents / 100).toFixed(2)}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/checkout')}
          style={[styles.checkoutButton, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.checkoutText, { color: colors.primaryForeground }]}>
            Checkout
          </Text>
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

  return (
    <View style={[styles.row, { borderColor: colors.border }]}>
      <View style={styles.rowText}>
        <Text style={[styles.rowName, { color: colors.foreground }]} numberOfLines={1}>
          {item.menuItem.name}
        </Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>${lineTotal}</Text>
      </View>
      <View style={styles.stepper}>
        <TouchableOpacity
          onPress={() => onChangeQuantity(item.menuItem.id, item.quantity - 1)}
          style={[styles.stepperButton, { borderColor: colors.border }]}
          hitSlop={8}
        >
          <Ionicons name="remove" size={16} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.quantity, { color: colors.foreground }]}>{item.quantity}</Text>
        <TouchableOpacity
          onPress={() => onChangeQuantity(item.menuItem.id, item.quantity + 1)}
          style={[styles.stepperButton, { borderColor: colors.border }]}
          hitSlop={8}
        >
          <Ionicons name="add" size={16} color={colors.foreground} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 15 },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  restaurantName: { fontSize: 20, fontWeight: '700' },
  list: { paddingHorizontal: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  rowText: { flex: 1, paddingRight: 12 },
  rowName: { fontSize: 15, fontWeight: '600' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepperButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantity: { fontSize: 15, fontWeight: '600', minWidth: 18, textAlign: 'center' },
  footer: { padding: 20, borderTopWidth: 1, gap: 12 },
  subtotalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  checkoutButton: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  checkoutText: { fontSize: 16, fontWeight: '700' },
});
