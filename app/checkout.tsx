import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useCart } from '@/context/CartContext';
import { useApp } from '@/context/AppContext';
import { useFeastWindows } from '@/context/FeastWindowContext';
import CountdownTimer from '@/components/CountdownTimer';
import { type LatLng } from '@/lib/geo';
import { paymentsApi, type SavedPaymentMethod } from '@/lib/api';
import { TEST_CARDS, tokenForCardNumber, prettyBrand } from '@/lib/payments';

export default function CheckoutScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useApp();
  const { restaurant, items, deliveryType, feastWindowId, subtotal, placeOrder, checkoutBlocked, cartNotice, dismissCartNotice } = useCart();
  const { feastWindows } = useFeastWindows();
  const savedAddresses = user?.savedAddresses ?? [];
  const [notes, setNotes] = useState('');
  const [address, setAddress] = useState(savedAddresses[0]?.label ?? '');
  // The precise drop-off coordinates from the selected saved address (if it has a
  // pin). Cleared when the user types a custom address that has no saved pin.
  const [coord, setCoord] = useState<LatLng | null>(() => {
    const first = savedAddresses[0];
    return first?.lat != null && first?.lng != null
      ? { latitude: first.lat, longitude: first.lng }
      : null;
  });
  const [isPlacing, setIsPlacing] = useState(false);
  const [orderError, setOrderError] = useState('');

  // Payment state. `selectedMethod` is either a saved Stripe PaymentMethod id or
  // the literal 'new' (enter a card below). Card fields hold a test card; the raw
  // number is mapped to a Stripe test token and never sent to our server.
  const [savedMethods, setSavedMethods] = useState<SavedPaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string>('new');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExp, setCardExp] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [saveCard, setSaveCard] = useState(false);

  // Load the user's saved cards and pre-select their default. Falls back silently
  // to the new-card form if the lookup fails or there are no saved cards.
  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      try {
        const methods = await paymentsApi.listMethods();
        if (!active) return;
        setSavedMethods(methods);
        const def = methods.find((m) => m.isDefault) ?? methods[0];
        if (def) setSelectedMethod(def.id);
      } catch {
        // Non-fatal — keep the new-card form.
      }
    })();
    return () => {
      active = false;
    };
  }, [user]);

  const selectSavedAddress = (a: { label: string; lat?: number | null; lng?: number | null }) => {
    setAddress(a.label);
    setCoord(a.lat != null && a.lng != null ? { latitude: a.lat, longitude: a.lng } : null);
  };

  const fwMap = Object.fromEntries(feastWindows.map((fw) => [fw.id, fw]));
  const feastWindow = feastWindowId ? fwMap[feastWindowId] : null;
  const discount = feastWindow ? feastWindow.discount : 0;
  const deliveryFee = deliveryType === 'delivery' ? 2.99 : 0;
  const serviceFee = subtotal * 0.05;
  const total = subtotal + deliveryFee + serviceFee - discount;

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;

  // Validates the manually-entered card fields. Returns an error message, or null
  // when the fields look usable (a known test card or any well-formed number).
  const validateNewCard = (): string | null => {
    if (cardNumber.replace(/\D/g, '').length < 13) return 'Enter a valid card number.';
    if (!/^\d{2}\s*\/\s*\d{2}$/.test(cardExp.trim())) return 'Enter the expiry as MM/YY.';
    if (cardCvc.replace(/\D/g, '').length < 3) return 'Enter a valid CVC.';
    return null;
  };

  const handlePlaceOrder = async () => {
    if (!user) {
      router.push({ pathname: '/signin', params: { redirect: '/checkout' } } as any);
      return;
    }
    if (checkoutBlocked) {
      setOrderError(`${restaurant?.name ?? 'This restaurant'} is now closed. Pick another spot to place your order.`);
      return;
    }
    if (!restaurant || items.length === 0) {
      setOrderError('Your cart is empty.');
      return;
    }

    const usingNewCard = selectedMethod === 'new';
    if (usingNewCard) {
      const cardError = validateNewCard();
      if (cardError) {
        setOrderError(cardError);
        return;
      }
    }

    setIsPlacing(true);
    setOrderError('');
    try {
      // 1. Open a PaymentIntent for the SERVER-computed total of this cart.
      const intent = await paymentsApi.createIntent({
        restaurantId: restaurant.id,
        feastWindowId: feastWindowId ?? null,
        deliveryType,
        items: items.map((i) => ({
          menuItemId: i.menuItem.id,
          quantity: i.quantity,
          specialInstructions: i.specialInstructions,
        })),
      });
      // 2. Confirm the charge with the chosen card. A decline throws here, so we
      //    never reach placeOrder — no order is created for a failed payment.
      const paymentMethod = usingNewCard ? tokenForCardNumber(cardNumber) : selectedMethod;
      const confirmed = await paymentsApi.confirm(intent.paymentIntentId, paymentMethod, usingNewCard && saveCard);
      if (confirmed.status !== 'succeeded') {
        throw new Error('Your payment could not be completed. Please try another card.');
      }

      // 3. Payment succeeded — now create the order, passing the verified PI.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const restLat = restaurant?.lat;
      const restLng = restaurant?.lng;
      const order = await placeOrder(
        intent.paymentIntentId,
        deliveryType === 'delivery'
          ? { address: address.trim(), lat: coord?.latitude ?? null, lng: coord?.longitude ?? null }
          : undefined,
      );
      const passCoord = deliveryType === 'delivery' && coord != null;
      router.replace({
        pathname: '/confirmation',
        params: {
          orderId: String(order.id),
          address: deliveryType === 'delivery' ? address.trim() : '',
          ...(restLat != null ? { restLat: String(restLat) } : {}),
          ...(restLng != null ? { restLng: String(restLng) } : {}),
          ...(passCoord ? { destLat: String(coord!.latitude), destLng: String(coord!.longitude) } : {}),
        },
      } as any);
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setOrderError(err?.message ?? 'Failed to place order. Please try again.');
      setIsPlacing(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Checkout</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={styles.content}>
          {/* Guest sign-in nudge */}
          {!user && (
            <TouchableOpacity
              style={[styles.guestBanner, { backgroundColor: colors.muted }]}
              onPress={() => router.push({ pathname: '/signin', params: { redirect: '/checkout' } } as any)}
              activeOpacity={0.8}
            >
              <Ionicons name="person-circle-outline" size={24} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.guestBannerTitle, { color: colors.foreground }]}>Sign in to place your order</Text>
                <Text style={[styles.guestBannerSub, { color: colors.mutedForeground }]}>Your cart will be saved. Tap to sign in →</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Restaurant closed block */}
          {checkoutBlocked && (
            <View style={[styles.closedBanner, { backgroundColor: colors.destructive + '12', borderColor: colors.destructive + '40' }]}>
              <Ionicons name="time" size={20} color={colors.destructive} style={{ marginTop: 1 }} />
              <View style={{ flex: 1, gap: 8 }}>
                <Text style={[styles.closedBannerText, { color: colors.foreground }]}>
                  {restaurant?.name ?? 'This restaurant'} is now closed, so this order can't be placed. Pick another spot to keep going.
                </Text>
                <TouchableOpacity
                  style={[styles.closedBannerAction, { backgroundColor: colors.destructive }]}
                  onPress={() => router.replace('/delivery' as any)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.closedBannerActionText}>Browse Restaurants</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Feast Window deal expired while away */}
          {cartNotice?.feastWindowExpired && (
            <View style={[styles.expiredWindowBanner, { backgroundColor: colors.gold + '12', borderColor: colors.gold + '55' }]}>
              <Ionicons name="flash-off" size={18} color={colors.gold} style={{ marginTop: 1 }} />
              <Text style={[styles.expiredWindowText, { color: colors.foreground }]}>
                The Feast Window deal on your saved cart ended while you were away, so the discount no longer applies. Your total reflects standard prices.
              </Text>
              <TouchableOpacity onPress={dismissCartNotice} hitSlop={8} accessibilityLabel="Dismiss notice">
                <Ionicons name="close" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          )}

          {/* Feast Window Timer */}
          {feastWindow && feastWindow.endTime > Date.now() && (
            <View style={[styles.windowTimer, { backgroundColor: '#FFFDF5', borderColor: colors.gold }]}>
              <Ionicons name="flash" size={18} color={colors.gold} />
              <Text style={[styles.windowTimerText, { color: colors.foreground }]}>Feast Window closes in </Text>
              <CountdownTimer endTime={feastWindow.endTime} compact />
            </View>
          )}

          {/* Delivery/Pickup */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              {deliveryType === 'delivery' ? 'Delivery Details' : 'Pickup Details'}
            </Text>
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              {deliveryType === 'delivery' ? (
                <View>
                  <View style={styles.addressRow}>
                    <View style={[styles.iconWrap, { backgroundColor: colors.muted }]}>
                      <Ionicons name="location" size={20} color={colors.foreground} />
                    </View>
                    <TextInput
                      style={[styles.addressInput, { color: colors.foreground }]}
                      value={address}
                      onChangeText={(t) => {
                        setAddress(t);
                        // Typing a custom address drops the saved pin until one is re-selected.
                        setCoord(null);
                      }}
                      placeholder="Enter delivery address"
                      placeholderTextColor={colors.mutedForeground}
                    />
                  </View>

                  {coord ? (
                    <View style={styles.pinnedRow}>
                      <Ionicons name="pin" size={13} color="#16A34A" />
                      <Text style={[styles.pinnedText, { color: colors.mutedForeground }]}>
                        Exact drop-off pin set
                      </Text>
                    </View>
                  ) : null}

                  {savedAddresses.length > 0 && (
                    <View style={styles.savedWrap}>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.savedRow}>
                        {savedAddresses.map((a, i) => {
                          const active = a.label === address;
                          const pinned = a.lat != null && a.lng != null;
                          return (
                            <TouchableOpacity
                              key={`${a.label}-${i}`}
                              style={[
                                styles.savedChip,
                                {
                                  backgroundColor: active ? colors.primary + '18' : colors.muted,
                                  borderColor: active ? colors.primary : 'transparent',
                                },
                              ]}
                              onPress={() => selectSavedAddress(a)}
                              activeOpacity={0.8}
                            >
                              <Ionicons
                                name={pinned ? 'pin' : 'location-outline'}
                                size={13}
                                color={active ? colors.primary : colors.mutedForeground}
                              />
                              <Text
                                style={[styles.savedChipText, { color: active ? colors.primary : colors.foreground }]}
                                numberOfLines={1}
                              >
                                {a.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.manageRow}
                    onPress={() => router.push('/address' as any)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="map-outline" size={16} color={colors.primary} />
                    <Text style={[styles.manageText, { color: colors.primary }]}>
                      {savedAddresses.length > 0 ? 'Manage addresses & pins' : 'Add an address with a map pin'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.pickupRow}>
                  <View style={[styles.iconWrap, { backgroundColor: colors.muted }]}>
                    <Ionicons name="storefront" size={20} color={colors.foreground} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.pickupName, { color: colors.foreground }]}>{restaurant?.name}</Text>
                    <Text style={[styles.pickupTime, { color: colors.mutedForeground }]}>Ready in {restaurant?.pickupTime}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Order Notes */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Notes</Text>
            <TextInput
              style={[styles.notesInput, { backgroundColor: colors.muted, color: colors.foreground }]}
              placeholder="Any special instructions?"
              placeholderTextColor={colors.mutedForeground}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={2}
            />
          </View>

          {/* Payment Method */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Payment</Text>
            <View style={[styles.card, { backgroundColor: colors.card, padding: 8 }]}>
              {savedMethods.map((m) => {
                const active = selectedMethod === m.id;
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.payOption, active && { backgroundColor: colors.primary + '14' }]}
                    onPress={() => setSelectedMethod(m.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={active ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={active ? colors.primary : colors.mutedForeground}
                    />
                    <Ionicons name="card" size={20} color={colors.foreground} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.payOptLabel, { color: colors.foreground }]}>
                        {prettyBrand(m.brand)} •••• {m.last4}
                      </Text>
                      {m.isDefault ? (
                        <Text style={[styles.payOptSub, { color: colors.mutedForeground }]}>Default</Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                style={[styles.payOption, selectedMethod === 'new' && { backgroundColor: colors.primary + '14' }]}
                onPress={() => setSelectedMethod('new')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={selectedMethod === 'new' ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={selectedMethod === 'new' ? colors.primary : colors.mutedForeground}
                />
                <Ionicons name="add-circle-outline" size={20} color={colors.foreground} />
                <Text style={[styles.payOptLabel, { color: colors.foreground, flex: 1 }]}>Use a new card</Text>
              </TouchableOpacity>

              {selectedMethod === 'new' && (
                <View style={styles.cardForm}>
                  <TextInput
                    style={[styles.cardInput, { color: colors.foreground, backgroundColor: colors.muted }]}
                    value={cardNumber}
                    onChangeText={setCardNumber}
                    placeholder="Card number"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="number-pad"
                    maxLength={19}
                  />
                  <View style={styles.cardRow}>
                    <TextInput
                      style={[styles.cardInput, styles.cardHalf, { color: colors.foreground, backgroundColor: colors.muted }]}
                      value={cardExp}
                      onChangeText={setCardExp}
                      placeholder="MM/YY"
                      placeholderTextColor={colors.mutedForeground}
                      maxLength={5}
                    />
                    <TextInput
                      style={[styles.cardInput, styles.cardHalf, { color: colors.foreground, backgroundColor: colors.muted }]}
                      value={cardCvc}
                      onChangeText={setCardCvc}
                      placeholder="CVC"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="number-pad"
                      maxLength={4}
                    />
                  </View>
                  <TouchableOpacity style={styles.saveCardRow} onPress={() => setSaveCard((s) => !s)} activeOpacity={0.7}>
                    <Ionicons
                      name={saveCard ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={saveCard ? colors.primary : colors.mutedForeground}
                    />
                    <Text style={[styles.saveCardText, { color: colors.foreground }]}>Save this card for next time</Text>
                  </TouchableOpacity>
                  <View style={[styles.testHint, { backgroundColor: colors.muted }]}>
                    <Text style={[styles.testHintTitle, { color: colors.mutedForeground }]}>
                      Stripe test mode — tap a card to fill it:
                    </Text>
                    {TEST_CARDS.map((c) => (
                      <TouchableOpacity
                        key={c.digits}
                        onPress={() => {
                          setCardNumber(c.digits);
                          setCardExp('12/34');
                          setCardCvc('123');
                        }}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[styles.testHintLine, { color: c.declines ? colors.destructive : colors.foreground }]}
                        >
                          {c.digits.replace(/(.{4})/g, '$1 ').trim()} — {c.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Order Summary */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Summary</Text>
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              {items.map((item) => (
                <View key={item.menuItem.id} style={[styles.orderItem, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.orderQty, { color: colors.mutedForeground }]}>{item.quantity}x</Text>
                  <Text style={[styles.orderName, { color: colors.foreground }]} numberOfLines={1}>{item.menuItem.name}</Text>
                  <Text style={[styles.orderPrice, { color: colors.foreground }]}>${(item.menuItem.price * item.quantity).toFixed(2)}</Text>
                </View>
              ))}
              <View style={styles.summaryBottom}>
                <View style={styles.priceRow}>
                  <Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>Subtotal</Text>
                  <Text style={[styles.priceValue, { color: colors.foreground }]}>${subtotal.toFixed(2)}</Text>
                </View>
                <View style={styles.priceRow}>
                  <Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>{deliveryType === 'delivery' ? 'Delivery' : 'Pickup'}</Text>
                  <Text style={[styles.priceValue, { color: colors.foreground }]}>${deliveryFee.toFixed(2)}</Text>
                </View>
                <View style={styles.priceRow}>
                  <Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>Service Fee</Text>
                  <Text style={[styles.priceValue, { color: colors.foreground }]}>${serviceFee.toFixed(2)}</Text>
                </View>
                {discount > 0 && (
                  <View style={styles.priceRow}>
                    <Text style={[styles.priceLabel, { color: colors.gold }]}>Feast Window Savings</Text>
                    <Text style={[styles.priceValue, { color: colors.gold }]}>-${discount.toFixed(2)}</Text>
                  </View>
                )}
                <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
                  <Text style={[styles.totalLabel, { color: colors.foreground }]}>Total</Text>
                  <Text style={[styles.totalValue, { color: colors.foreground }]}>${total.toFixed(2)}</Text>
                </View>
              </View>
            </View>
          </View>

          {orderError ? (
            <Text style={[styles.errorText, { color: colors.destructive }]}>{orderError}</Text>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.background, paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          style={[styles.placeBtn, { backgroundColor: (isPlacing || checkoutBlocked) ? colors.mutedForeground : colors.primary }]}
          onPress={handlePlaceOrder}
          disabled={isPlacing || checkoutBlocked}
          activeOpacity={0.85}
        >
          <Text style={styles.placeBtnText}>{checkoutBlocked ? 'Restaurant Closed' : isPlacing ? 'Placing Order...' : `Place Order · $${total.toFixed(2)}`}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB' },
  backBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  content: { padding: 20, gap: 24 },
  guestBanner: { flexDirection: 'row', alignItems: 'center', gap: 16, borderRadius: 16, padding: 16 },
  guestBannerTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  guestBannerSub: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  closedBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 16, borderWidth: 1, padding: 16 },
  closedBannerText: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium', lineHeight: 20 },
  closedBannerAction: { alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  closedBannerActionText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_700Bold' },
  expiredWindowBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 16, borderWidth: 1, padding: 14 },
  expiredWindowText: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium', lineHeight: 20 },
  windowTimer: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 16, borderWidth: 1, padding: 16 },
  windowTimerText: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  section: { gap: 12 },
  sectionTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  card: { 
    borderRadius: 20, 
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8 },
  addressInput: { flex: 1, paddingVertical: 16, fontSize: 15, fontFamily: 'Inter_400Regular' },
  pinnedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingBottom: 8 },
  pinnedText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  savedWrap: { paddingBottom: 4 },
  savedRow: { paddingHorizontal: 16, paddingVertical: 4, gap: 8 },
  savedChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, maxWidth: 220 },
  savedChipText: { fontSize: 13, fontFamily: 'Inter_500Medium', flexShrink: 1 },
  manageRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E7EB' },
  manageText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  pickupRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 16 },
  pickupName: { fontSize: 16, fontFamily: 'Inter_600SemiBold', marginBottom: 4 },
  pickupTime: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  notesInput: { borderRadius: 16, padding: 16, fontSize: 15, fontFamily: 'Inter_400Regular', minHeight: 80, textAlignVertical: 'top' },
  payOption: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 8, borderRadius: 12 },
  payOptLabel: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  payOptSub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  cardForm: { gap: 12, padding: 8, paddingTop: 4 },
  cardInput: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, fontFamily: 'Inter_500Medium' },
  cardRow: { flexDirection: 'row', gap: 12 },
  cardHalf: { flex: 1 },
  saveCardRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  saveCardText: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  testHint: { borderRadius: 12, padding: 12, gap: 6 },
  testHintTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  testHintLine: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  orderItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  orderQty: { fontSize: 15, fontFamily: 'Inter_600SemiBold', width: 24 },
  orderName: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },
  orderPrice: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  summaryBottom: { padding: 20, gap: 12 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { fontSize: 15, fontFamily: 'Inter_400Regular' },
  priceValue: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 4 },
  totalLabel: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  totalValue: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E7EB' },
  placeBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 18, borderRadius: 16 },
  placeBtnText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 17 },
  errorText: { fontSize: 14, fontFamily: 'Inter_500Medium', textAlign: 'center' },
});
