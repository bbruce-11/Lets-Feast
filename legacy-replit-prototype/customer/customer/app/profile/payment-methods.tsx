import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import ScreenHeader from '@/components/ScreenHeader';
import { paymentsApi, type SavedPaymentMethod } from '@/lib/api';
import { TEST_CARDS, tokenForCardNumber, prettyBrand } from '@/lib/payments';

export default function PaymentMethodsScreen() {
  const colors = useColors();
  const [cards, setCards] = useState<SavedPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [number, setNumber] = useState('');
  const [exp, setExp] = useState('');
  const [cvv, setCvv] = useState('');
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');

  const load = async () => {
    try {
      const methods = await paymentsApi.listMethods();
      setCards(methods);
      setListError('');
    } catch (err: any) {
      setListError(err?.message ?? 'Could not load your saved cards.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setNumber('');
    setExp('');
    setCvv('');
    setError('');
  };

  // Adds a real Stripe (test-mode) saved card. The entered number is mapped to a
  // predefined Stripe test token on-device; only that token reaches the server,
  // which attaches it to the user's Stripe customer and returns the safe brand/last4.
  const handleSave = async () => {
    const digits = number.replace(/\D/g, '');
    if (digits.length < 13) return setError('Enter a valid card number.');
    if (!/^\d{2}\s*\/\s*\d{2}$/.test(exp.trim())) return setError('Enter the expiry as MM/YY.');
    if (cvv.replace(/\D/g, '').length < 3) return setError('Enter a valid CVC.');

    setSaving(true);
    setError('');
    try {
      await paymentsApi.addMethod(tokenForCardNumber(number));
      await load();
      resetForm();
      setAdding(false);
    } catch (err: any) {
      setError(err?.message ?? 'Could not save this card.');
    } finally {
      setSaving(false);
    }
  };

  const makeDefault = async (id: string) => {
    setBusyId(id);
    try {
      await paymentsApi.setDefault(id);
      await load();
    } catch (err: any) {
      setListError(err?.message ?? 'Could not update your default card.');
    } finally {
      setBusyId(null);
    }
  };

  const removeCard = async (id: string) => {
    setBusyId(id);
    try {
      await paymentsApi.deleteMethod(id);
      await load();
    } catch (err: any) {
      setListError(err?.message ?? 'Could not remove this card.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Payment Methods" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
          ) : (
            <>
              {listError ? <Text style={[styles.error, { color: colors.destructive }]}>{listError}</Text> : null}

              {cards.map((card) => (
                <View key={card.id} style={[styles.card, { backgroundColor: colors.card }]}>
                  <View style={[styles.cardIcon, { backgroundColor: colors.muted }]}>
                    <Ionicons name="card" size={24} color={colors.foreground} />
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={[styles.cardLabel, { color: colors.foreground }]}>
                      {prettyBrand(card.brand)} ending in {card.last4}
                    </Text>
                    {card.expMonth && card.expYear ? (
                      <Text style={[styles.cardExp, { color: colors.mutedForeground }]}>
                        Expires {String(card.expMonth).padStart(2, '0')}/{String(card.expYear).slice(-2)}
                      </Text>
                    ) : null}
                    {card.isDefault ? (
                      <View style={[styles.defaultBadge, { backgroundColor: colors.primary + '15' }]}>
                        <Text style={[styles.defaultText, { color: colors.primary }]}>Default payment method</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={() => makeDefault(card.id)}
                        activeOpacity={0.7}
                        disabled={busyId === card.id}
                      >
                        <Text style={[styles.makeDefault, { color: colors.primary }]}>Set as default</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {busyId === card.id ? (
                    <ActivityIndicator color={colors.mutedForeground} />
                  ) : (
                    <TouchableOpacity
                      onPress={() => removeCard(card.id)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${prettyBrand(card.brand)} ending in ${card.last4}`}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="trash-outline" size={20} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              {cards.length === 0 && !listError && (
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  No saved payment methods yet.
                </Text>
              )}

              {adding ? (
                <View style={[styles.formCard, { backgroundColor: colors.card }]}>
                  <Text style={[styles.formTitle, { color: colors.foreground }]}>Add a card</Text>

                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Card number</Text>
                  <TextInput
                    style={[styles.input, { color: colors.foreground, backgroundColor: colors.input }]}
                    value={number}
                    onChangeText={setNumber}
                    placeholder="1234 5678 9012 3456"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="number-pad"
                    maxLength={19}
                  />

                  <View style={styles.row}>
                    <View style={styles.rowItem}>
                      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Expiration</Text>
                      <TextInput
                        style={[styles.input, { color: colors.foreground, backgroundColor: colors.input }]}
                        value={exp}
                        onChangeText={setExp}
                        placeholder="MM/YY"
                        placeholderTextColor={colors.mutedForeground}
                        maxLength={5}
                      />
                    </View>
                    <View style={styles.rowItem}>
                      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>CVC</Text>
                      <TextInput
                        style={[styles.input, { color: colors.foreground, backgroundColor: colors.input }]}
                        value={cvv}
                        onChangeText={setCvv}
                        placeholder="123"
                        placeholderTextColor={colors.mutedForeground}
                        keyboardType="number-pad"
                        maxLength={4}
                        secureTextEntry
                      />
                    </View>
                  </View>

                  {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}

                  <View style={[styles.testHint, { backgroundColor: colors.muted }]}>
                    <Text style={[styles.testHintTitle, { color: colors.mutedForeground }]}>
                      Stripe test mode — tap a card to fill it:
                    </Text>
                    {TEST_CARDS.filter((c) => !c.declines).map((c) => (
                      <TouchableOpacity
                        key={c.digits}
                        onPress={() => {
                          setNumber(c.digits);
                          setExp('12/34');
                          setCvv('123');
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.testHintLine, { color: colors.foreground }]}>
                          {c.digits.replace(/(.{4})/g, '$1 ').trim()} — {c.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryBtn, { backgroundColor: colors.primary }, saving && { opacity: 0.6 }]}
                    onPress={handleSave}
                    activeOpacity={0.85}
                    disabled={saving}
                    accessibilityRole="button"
                  >
                    {saving ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryBtnText}>Save Payment Method</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.linkBtn}
                    onPress={() => {
                      resetForm();
                      setAdding(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.linkText, { color: colors.mutedForeground }]}>Cancel</Text>
                  </TouchableOpacity>

                  <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>
                    Stripe test mode. Use a test card above — no real card is charged.
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.addBtn, { borderColor: colors.primary }]}
                  onPress={() => setAdding(true)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                >
                  <Ionicons name="add" size={20} color={colors.primary} />
                  <Text style={[styles.addText, { color: colors.primary }]}>Add Payment Method</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1, gap: 6 },
  cardLabel: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  cardExp: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  defaultBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  defaultText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  makeDefault: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  emptyText: { fontSize: 15, fontFamily: 'Inter_400Regular', textAlign: 'center', paddingVertical: 8 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  addText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  formCard: {
    borderRadius: 20,
    padding: 20,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  formTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  fieldLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', marginTop: 8, marginBottom: 6 },
  input: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, fontSize: 15, fontFamily: 'Inter_400Regular' },
  row: { flexDirection: 'row', gap: 12 },
  rowItem: { flex: 1 },
  error: { fontSize: 13, fontFamily: 'Inter_500Medium', marginTop: 10 },
  testHint: { borderRadius: 12, padding: 12, gap: 6, marginTop: 12 },
  testHintTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  testHintLine: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  primaryBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 14, marginTop: 16 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
  linkBtn: { alignItems: 'center', paddingVertical: 12 },
  linkText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  disclaimer: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 4 },
});
