import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useCart } from '@/context/CartContext';
import { useApp } from '@/context/AppContext';
import { useFeastWindows } from '@/context/FeastWindowContext';
import FeastWindowBanner from '@/components/FeastWindowBanner';
import CountdownTimer from '@/components/CountdownTimer';

export default function CartScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useApp();
  const { restaurant, items, deliveryType, feastWindowId, reorderNotice, dismissReorderNotice, cartNotice, checkoutBlocked, dismissCartNotice, updateQuantity, setDeliveryType, joinFeastWindow, leaveFeastWindow, subtotal } = useCart();
  const { feastWindows, joinedWindowIds } = useFeastWindows();
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [joinError, setJoinError] = useState('');

  const goToSignIn = () => {
    router.push({ pathname: '/signin', params: { redirect: '/checkout' } } as any);
  };

  const handleJoinFeastWindow = async (id: string) => {
    setJoinError('');
    if (!user) {
      if (Platform.OS === 'web') {
        goToSignIn();
      } else {
        Alert.alert(
          'Sign in to join',
          'Create an account or sign in to lock in this Feast Window deal. Your cart will be waiting.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Sign In', onPress: goToSignIn },
          ],
        );
      }
      return;
    }
    try {
      await joinFeastWindow(id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setJoinError(err?.message ?? 'Could not join Feast Window. Please try again.');
    }
  };

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const tabBarHeight = Platform.OS === 'web' ? 84 : 49 + insets.bottom;

  const unavailableNoticeText = (() => {
    const names = reorderNotice?.unavailable ?? [];
    if (names.length === 0) return null;
    if (names.length === 1) {
      return `"${names[0]}" is no longer on the menu, so it wasn't added to your cart.`;
    }
    return `${names.length} items are no longer on the menu, so they weren't added: ${names.join(', ')}.`;
  })();

  const priceChangeNoticeText = (() => {
    const changes = reorderNotice?.priceChanges ?? [];
    if (changes.length === 0) return null;
    if (changes.length === 1) {
      const c = changes[0];
      const direction = c.newPrice > c.oldPrice ? 'gone up' : 'gone down';
      return `Heads up: "${c.name}" has ${direction} since your last order ($${c.oldPrice.toFixed(2)} → $${c.newPrice.toFixed(2)}). Your cart reflects the current price.`;
    }
    const lines = changes
      .map((c) => `• ${c.name}: $${c.oldPrice.toFixed(2)} → $${c.newPrice.toFixed(2)}`)
      .join('\n');
    return `Heads up: prices changed on ${changes.length} items since your last order. Your cart reflects the current prices:\n${lines}`;
  })();

  const hasNotice = !!unavailableNoticeText || !!priceChangeNoticeText;

  // Per-item "price updated" hints from the reorder, keyed by item name so each
  // affected cart line can show its own inline badge (not just the summary).
  const reorderPriceChangeByName = React.useMemo(() => {
    const map: Record<string, { oldPrice: number; newPrice: number }> = {};
    for (const c of reorderNotice?.priceChanges ?? []) {
      map[c.name] = { oldPrice: c.oldPrice, newPrice: c.newPrice };
    }
    return map;
  }, [reorderNotice]);

  const restaurantClosed = cartNotice?.restaurantClosed ?? false;

  const cartUnavailableText = (() => {
    const names = cartNotice?.unavailable ?? [];
    if (names.length === 0) return null;
    if (names.length === 1) {
      return `"${names[0]}" is no longer on the menu and was removed from your cart.`;
    }
    return `${names.length} items are no longer on the menu and were removed: ${names.join(', ')}.`;
  })();

  const cartPriceChangeText = (() => {
    const changes = cartNotice?.priceChanges ?? [];
    if (changes.length === 0) return null;
    if (changes.length === 1) {
      const c = changes[0];
      const direction = c.newPrice > c.oldPrice ? 'gone up' : 'gone down';
      return `Heads up: "${c.name}" has ${direction} since you added it ($${c.oldPrice.toFixed(2)} → $${c.newPrice.toFixed(2)}). Your cart shows the current price.`;
    }
    return `Heads up: prices changed on ${changes.length} items since you added them. Your cart shows the current prices.`;
  })();

  const hasCartNotice = restaurantClosed || !!cartUnavailableText || !!cartPriceChangeText;

  const CartRestoreNotice = () =>
    hasCartNotice ? (
      <View style={styles.reorderNoticeWrap}>
        {restaurantClosed ? (
          <View style={[styles.reorderNotice, { backgroundColor: colors.destructive + '12', borderColor: colors.destructive + '40' }]}>
            <Ionicons name="time" size={20} color={colors.destructive} style={{ marginTop: 1 }} />
            <View style={{ flex: 1, gap: 8 }}>
              <Text style={[styles.reorderNoticeText, { color: colors.foreground }]}>
                {restaurant ? `${restaurant.name} is now closed, so you can't check out with this order. Pick another spot to keep going.` : `This restaurant is now closed, so you can't check out with this order. Pick another spot to keep going.`}
              </Text>
              <TouchableOpacity
                style={[styles.noticeAction, { backgroundColor: colors.destructive }]}
                onPress={() => router.push('/delivery' as any)}
                activeOpacity={0.85}
              >
                <Text style={styles.noticeActionText}>Browse Restaurants</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
        {cartUnavailableText ? (
          <View style={[styles.reorderNotice, { backgroundColor: colors.destructive + '12', borderColor: colors.destructive + '40' }]}>
            <Ionicons name="alert-circle" size={20} color={colors.destructive} style={{ marginTop: 1 }} />
            <Text style={[styles.reorderNoticeText, { color: colors.foreground }]}>{cartUnavailableText}</Text>
            <TouchableOpacity onPress={dismissCartNotice} hitSlop={8} accessibilityLabel="Dismiss notice">
              <Ionicons name="close" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        ) : null}
        {cartPriceChangeText ? (
          <View style={[styles.reorderNotice, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Ionicons name="pricetag" size={18} color={colors.mutedForeground} style={{ marginTop: 1 }} />
            <Text style={[styles.reorderNoticeText, { color: colors.foreground }]}>{cartPriceChangeText}</Text>
            <TouchableOpacity onPress={dismissCartNotice} hitSlop={8} accessibilityLabel="Dismiss notice">
              <Ionicons name="close" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    ) : null;

  const ReorderNotice = () =>
    hasNotice ? (
      <View style={styles.reorderNoticeWrap}>
        {unavailableNoticeText ? (
          <View style={[styles.reorderNotice, { backgroundColor: colors.destructive + '12', borderColor: colors.destructive + '40' }]}>
            <Ionicons name="alert-circle" size={20} color={colors.destructive} style={{ marginTop: 1 }} />
            <Text style={[styles.reorderNoticeText, { color: colors.foreground }]}>{unavailableNoticeText}</Text>
            <TouchableOpacity onPress={dismissReorderNotice} hitSlop={8} accessibilityLabel="Dismiss notice">
              <Ionicons name="close" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        ) : null}
        {priceChangeNoticeText ? (
          <View style={[styles.reorderNotice, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Ionicons name="pricetag" size={18} color={colors.mutedForeground} style={{ marginTop: 1 }} />
            <Text style={[styles.reorderNoticeText, { color: colors.foreground }]}>{priceChangeNoticeText}</Text>
            <TouchableOpacity onPress={dismissReorderNotice} hitSlop={8} accessibilityLabel="Dismiss notice">
              <Ionicons name="close" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    ) : null;

  const fwMap = Object.fromEntries(feastWindows.map((fw) => [fw.id, fw]));
  const activeFeastWindow = feastWindowId ? fwMap[feastWindowId] ?? null : null;
  const restaurantFeastWindow = restaurant?.feastWindowId ? fwMap[restaurant.feastWindowId] : undefined;
  const discount = activeFeastWindow ? activeFeastWindow.discount : 0;
  const deliveryFee = deliveryType === 'delivery' ? 2.99 : 0;
  const serviceFee = subtotal * 0.05;
  const total = subtotal + deliveryFee + serviceFee - discount;

  if (items.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.background, paddingTop: topPad }]}>
        {(hasNotice || hasCartNotice) && (
          <View style={styles.emptyNoticeWrap}>
            <CartRestoreNotice />
            <ReorderNotice />
          </View>
        )}
        <View style={[styles.emptyIconBg, { backgroundColor: colors.muted }]}>
          <Ionicons name="cart-outline" size={48} color={colors.mutedForeground} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Your cart is empty</Text>
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Browse local spots and start an order.</Text>
        <TouchableOpacity style={[styles.browseBtn, { backgroundColor: colors.primary }]} onPress={() => router.push('/delivery' as any)} activeOpacity={0.85}>
          <Text style={styles.browseBtnText}>Browse Restaurants</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Cart</Text>
        {restaurant && <Text style={[styles.restaurantName, { color: colors.mutedForeground }]}>{restaurant.name}</Text>}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: tabBarHeight + (user ? 120 : 180) }}>
        <View style={styles.content}>

          {/* Restored-cart warnings (closed restaurant / menu changes) */}
          <CartRestoreNotice />

          {/* Reorder availability warning */}
          <ReorderNotice />

          {/* Feast Window logic */}
          {restaurantFeastWindow && !feastWindowId && (
            <View style={styles.section}>
              <FeastWindowBanner
                feastWindow={restaurantFeastWindow}
                onJoin={() => handleJoinFeastWindow(restaurantFeastWindow.id)}
                alreadyJoined={joinedWindowIds.includes(restaurantFeastWindow.id)}
              />
              {joinError ? <Text style={[styles.joinError, { color: colors.destructive }]}>{joinError}</Text> : null}
            </View>
          )}

          {activeFeastWindow && (
            <View style={[styles.activeWindowBanner, { backgroundColor: '#FFFDF5', borderColor: colors.gold }]}>
              <View style={styles.activeWindowRow}>
                <Ionicons name="flash" size={18} color={colors.gold} />
                <Text style={[styles.activeWindowText, { color: colors.foreground }]}>Feast Window Active</Text>
              </View>
              <View style={styles.timerRow}>
                <Text style={[styles.timerLabel, { color: colors.mutedForeground }]}>Expires in </Text>
                <CountdownTimer endTime={activeFeastWindow.endTime} onExpire={leaveFeastWindow} compact />
              </View>
            </View>
          )}

          {/* Cart Items */}
          <View style={styles.section}>
            {items.map((item) => {
              const priceChange = reorderPriceChangeByName[item.menuItem.name];
              return (
              <View key={item.menuItem.id} style={[styles.cartItem, { borderColor: colors.border }]}>
                <View style={styles.itemInfo}>
                  <Text style={[styles.itemName, { color: colors.foreground }]}>{item.menuItem.name}</Text>
                  <View style={styles.priceLine}>
                    {priceChange ? (
                      <Text style={[styles.oldPrice, { color: colors.mutedForeground }]}>
                        ${priceChange.oldPrice.toFixed(2)}
                      </Text>
                    ) : null}
                    <Text style={[styles.itemPrice, { color: colors.foreground }]}>${item.menuItem.price.toFixed(2)}</Text>
                    {priceChange ? (
                      <View style={[styles.updatedBadge, { backgroundColor: colors.gold + '22', borderColor: colors.gold + '55' }]}>
                        <Ionicons name="pricetag" size={10} color={colors.gold} />
                        <Text style={[styles.updatedBadgeText, { color: colors.gold }]}>Price updated</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <View style={styles.qtyControls}>
                  <TouchableOpacity onPress={() => updateQuantity(item.menuItem.id, item.quantity - 1)} style={[styles.qtyBtn, { backgroundColor: colors.muted }]} activeOpacity={0.75}>
                    <Ionicons name={item.quantity === 1 ? 'trash-outline' : 'remove'} size={18} color={item.quantity === 1 ? colors.destructive : colors.foreground} />
                  </TouchableOpacity>
                  <Text style={[styles.qty, { color: colors.foreground }]}>{item.quantity}</Text>
                  <TouchableOpacity onPress={() => updateQuantity(item.menuItem.id, item.quantity + 1)} style={[styles.qtyBtn, { backgroundColor: colors.muted }]} activeOpacity={0.75}>
                    <Ionicons name="add" size={18} color={colors.foreground} />
                  </TouchableOpacity>
                </View>
              </View>
              );
            })}
          </View>

          {/* Delivery Method */}
          <View style={styles.section}>
            <View style={[styles.toggle, { backgroundColor: colors.muted }]}>
              {(['delivery', 'pickup'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.toggleOption, deliveryType === type && { backgroundColor: colors.card, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 }]}
                  onPress={() => setDeliveryType(type)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.toggleText, { color: deliveryType === type ? colors.foreground : colors.mutedForeground }]}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Special Instructions */}
          <View style={styles.section}>
            <TextInput
              style={[styles.instructionsInput, { backgroundColor: colors.muted, color: colors.foreground }]}
              placeholder="Add a note (e.g. extra napkins)..."
              placeholderTextColor={colors.mutedForeground}
              value={specialInstructions}
              onChangeText={setSpecialInstructions}
              multiline
              numberOfLines={2}
            />
          </View>

          {/* Summary */}
          <View style={styles.summaryBox}>
            <View style={styles.priceRow}>
              <Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>Subtotal</Text>
              <Text style={[styles.priceValue, { color: colors.foreground }]}>${subtotal.toFixed(2)}</Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>{deliveryType === 'delivery' ? 'Delivery Fee' : 'Pickup'}</Text>
              <Text style={[styles.priceValue, { color: colors.foreground }]}>${deliveryFee.toFixed(2)}</Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>Taxes & Fees</Text>
              <Text style={[styles.priceValue, { color: colors.foreground }]}>${serviceFee.toFixed(2)}</Text>
            </View>
            {discount > 0 && (
              <View style={styles.priceRow}>
                <Text style={[styles.priceLabel, { color: colors.gold }]}>Feast Deal Savings</Text>
                <Text style={[styles.priceValue, { color: colors.gold }]}>-${discount.toFixed(2)}</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Sticky Checkout Footer */}
      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border, bottom: tabBarHeight }]}>
        {!user && (
          <View style={[styles.guestNudge, { backgroundColor: colors.muted }]}>
            <Ionicons name="person-circle-outline" size={20} color={colors.primary} />
            <Text style={[styles.guestNudgeText, { color: colors.foreground }]}>
              <Text style={{ fontFamily: 'Inter_700Bold' }} onPress={goToSignIn}>Sign in</Text> to place your order.
            </Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.checkoutBtn, { backgroundColor: checkoutBlocked ? colors.mutedForeground : colors.primary }]}
          onPress={() => {
            if (checkoutBlocked) return;
            if (!user) goToSignIn();
            else router.push('/checkout' as any);
          }}
          disabled={checkoutBlocked}
          activeOpacity={0.85}
        >
          <Text style={styles.checkoutBtnText}>{checkoutBlocked ? 'Restaurant Closed' : 'Checkout'}</Text>
          {!checkoutBlocked && <Text style={styles.checkoutTotal}>${total.toFixed(2)}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  headerTitle: { fontSize: 32, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  restaurantName: { fontSize: 16, fontFamily: 'Inter_400Regular' },
  content: { padding: 20, gap: 24 },
  reorderNoticeWrap: { gap: 10 },
  reorderNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1 },
  reorderNoticeText: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium', lineHeight: 20 },
  noticeAction: { alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  noticeActionText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_700Bold' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyNoticeWrap: { position: 'absolute', top: 0, left: 20, right: 20 },
  emptyIconBg: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  emptyTitle: { fontSize: 24, fontFamily: 'Inter_700Bold', marginBottom: 8 },
  emptyText: { fontSize: 16, fontFamily: 'Inter_400Regular', textAlign: 'center', marginBottom: 32 },
  browseBtn: { paddingHorizontal: 32, paddingVertical: 16, borderRadius: 16 },
  browseBtnText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 16 },
  activeWindowBanner: { borderRadius: 16, borderWidth: 1, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  activeWindowRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  activeWindowText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  timerRow: { flexDirection: 'row', alignItems: 'center' },
  timerLabel: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  section: { gap: 16 },
  cartItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  itemInfo: { flex: 1, gap: 4 },
  itemName: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  priceLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  itemPrice: { fontSize: 15, fontFamily: 'Inter_400Regular' },
  oldPrice: { fontSize: 13, fontFamily: 'Inter_400Regular', textDecorationLine: 'line-through' },
  updatedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, borderWidth: 1 },
  updatedBadgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qtyBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  qty: { fontSize: 16, fontFamily: 'Inter_600SemiBold', minWidth: 20, textAlign: 'center' },
  toggle: { flexDirection: 'row', borderRadius: 16, padding: 4 },
  toggleOption: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  toggleText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  instructionsInput: { borderRadius: 16, padding: 16, fontSize: 15, fontFamily: 'Inter_400Regular', minHeight: 80, textAlignVertical: 'top' },
  summaryBox: { gap: 12, marginTop: 8 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { fontSize: 15, fontFamily: 'Inter_400Regular' },
  priceValue: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  joinError: { fontSize: 13, fontFamily: 'Inter_500Medium', marginTop: 8, textAlign: 'center' },
  footer: { position: 'absolute', left: 0, right: 0, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, borderTopWidth: 1, gap: 12 },
  guestNudge: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16 },
  guestNudgeText: { fontSize: 14, fontFamily: 'Inter_400Regular', flex: 1 },
  checkoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 18, borderRadius: 16 },
  checkoutBtnText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 17 },
  checkoutTotal: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 17 },
});
