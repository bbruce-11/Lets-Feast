import { useState } from 'react';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CardField, useStripe } from '@stripe/stripe-react-native';
import { useColors } from '@/hooks/useColors';
import { useCart } from '@/context/CartContext';
import { AddressPicker } from '@/components/AddressPicker';
import type { GeocodeResult } from '@/lib/geocoding';
import { createPaymentIntent, confirmPayment, placeOrder, getFeastWindow } from '@/lib/api';

const TIP_PRESETS_CENTS = [0, 300, 500, 800];

export default function CheckoutScreen() {
  const colors = useColors();
  const { createPaymentMethod } = useStripe();
  const { restaurantId, restaurantName, feastWindowId, items, subtotalCents, clear } = useCart();

  const { data: feastWindow } = useQuery({
    queryKey: ['feast-window', feastWindowId],
    queryFn: () => getFeastWindow(feastWindowId!),
    enabled: !!feastWindowId,
  });

  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>('delivery');
  const [selectedAddress, setSelectedAddress] = useState<GeocodeResult | null>(null);
  const [tipCents, setTipCents] = useState(500);
  const [cardComplete, setCardComplete] = useState(false);
  const [isPlacing, setIsPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveTip = deliveryType === 'delivery' ? tipCents : 0;
  const canSubmit =
    cardComplete && !isPlacing && (deliveryType === 'pickup' || selectedAddress != null);

  async function handlePlaceOrder() {
    if (!restaurantId || items.length === 0) return;
    setError(null);
    setIsPlacing(true);

    try {
      const requestedItems = items.map((i) => ({ menuItemId: i.menuItem.id, quantity: i.quantity }));

      // 1. Create the PaymentIntent server-side (this is where the real
      // total, including commission-engine-derived amounts, is computed -
      // the client never decides the charge amount).
      const intent = await createPaymentIntent({
        restaurantId,
        deliveryType,
        items: requestedItems,
        feastWindowId: feastWindowId ?? undefined,
      });

      // 2. Tokenize the card into a PaymentMethod. Raw card details never
      // leave the device / reach our server - only this opaque ID does.
      const { paymentMethod, error: pmError } = await createPaymentMethod({
        paymentMethodType: 'Card',
      });
      if (pmError || !paymentMethod) {
        throw new Error(pmError?.message ?? 'Could not process card details');
      }

      // 3. Server confirms the charge using the PaymentMethod ID.
      const confirmResult = await confirmPayment(intent.paymentIntentId, paymentMethod.id);
      if (confirmResult.status !== 'succeeded') {
        throw new Error('Payment was not completed. Please try again.');
      }

      // 4. Only after a confirmed charge do we place the order.
      const order = await placeOrder({
        restaurantId,
        deliveryType,
        deliveryAddress: deliveryType === 'delivery' ? selectedAddress?.displayName : null,
        deliveryLat: deliveryType === 'delivery' ? selectedAddress?.lat : null,
        deliveryLng: deliveryType === 'delivery' ? selectedAddress?.lng : null,
        items: requestedItems,
        paymentIntentId: intent.paymentIntentId,
        tipCents: effectiveTip,
        feastWindowId: feastWindowId ?? undefined,
      });

      clear();
      router.replace({ pathname: '/order/[id]', params: { id: String(order.id) } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong placing your order');
    } finally {
      setIsPlacing(false);
    }
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.navy }]}>Checkout</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{restaurantName}</Text>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Delivery method</Text>
        <View style={styles.toggleRow}>
          {(['delivery', 'pickup'] as const).map((type) => (
            <TouchableOpacity
              key={type}
              onPress={() => setDeliveryType(type)}
              style={[
                styles.toggleButton,
                {
                  borderColor: deliveryType === type ? colors.primary : colors.border,
                  backgroundColor: deliveryType === type ? colors.primary : 'transparent',
                },
              ]}
            >
              <Text
                style={{
                  color: deliveryType === type ? colors.primaryForeground : colors.foreground,
                  fontWeight: '600',
                  textTransform: 'capitalize',
                }}
              >
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {deliveryType === 'delivery' && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Delivery address</Text>
          <AddressPicker
            value={selectedAddress?.displayName ?? ''}
            onSelect={setSelectedAddress}
          />
        </View>
      )}

      {deliveryType === 'delivery' && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.foreground }]}>
            Courier tip{' '}
            <Text style={{ fontWeight: '400', color: colors.mutedForeground }}>
              (100% goes to your courier)
            </Text>
          </Text>
          <View style={styles.toggleRow}>
            {TIP_PRESETS_CENTS.map((preset) => (
              <TouchableOpacity
                key={preset}
                onPress={() => setTipCents(preset)}
                style={[
                  styles.tipButton,
                  {
                    borderColor: tipCents === preset ? colors.primary : colors.border,
                    backgroundColor: tipCents === preset ? colors.primary : 'transparent',
                  },
                ]}
              >
                <Text
                  style={{
                    color: tipCents === preset ? colors.primaryForeground : colors.foreground,
                    fontWeight: '600',
                  }}
                >
                  {preset === 0 ? 'No tip' : `$${(preset / 100).toFixed(0)}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Card details</Text>
        <CardField
          postalCodeEnabled
          placeholders={{ number: '4242 4242 4242 4242' }}
          style={styles.cardField}
          onCardChange={(details) => setCardComplete(details.complete)}
        />
      </View>

      <View style={styles.section}>
        <View style={styles.totalRow}>
          <Text style={{ color: colors.mutedForeground }}>Subtotal</Text>
          <Text style={{ color: colors.foreground }}>${(subtotalCents / 100).toFixed(2)}</Text>
        </View>
        {deliveryType === 'delivery' && (
          <View style={styles.totalRow}>
            <Text style={{ color: colors.mutedForeground }}>Tip</Text>
            <Text style={{ color: colors.foreground }}>${(effectiveTip / 100).toFixed(2)}</Text>
          </View>
        )}
        {feastWindow && (
          <View style={styles.totalRow}>
            <Text style={{ color: colors.accent }}>Feast Window discount</Text>
            <Text style={{ color: colors.accent, fontWeight: '600' }}>
              -${Number.parseFloat(feastWindow.discount).toFixed(2)}
            </Text>
          </View>
        )}
        <Text style={[styles.feeNote, { color: colors.mutedForeground }]}>
          Delivery fee and service fee are calculated at payment.
        </Text>
      </View>

      {error && <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>}

      <TouchableOpacity
        onPress={handlePlaceOrder}
        disabled={!canSubmit}
        style={[styles.submitButton, { backgroundColor: colors.primary, opacity: canSubmit ? 1 : 0.5 }]}
      >
        {isPlacing ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <Text style={{ color: colors.primaryForeground, fontSize: 16, fontWeight: '700' }}>
            Place Order
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  title: { fontSize: 24, fontWeight: '700', marginTop: 16 },
  subtitle: { fontSize: 14, marginTop: 4, marginBottom: 8 },
  section: { marginTop: 20 },
  sectionLabel: { fontSize: 14, fontWeight: '600', marginBottom: 10 },
  toggleRow: { flexDirection: 'row', gap: 10 },
  toggleButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipButton: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardField: { width: '100%', height: 50 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  feeNote: { fontSize: 12, marginTop: 6 },
  error: { textAlign: 'center', marginTop: 16 },
  submitButton: {
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 40,
  },
});
