import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AddressPicker } from '@/components/AddressPicker';
import { useApp, type SavedAddress } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { type LatLng } from '@/lib/geo';

type EditTarget = number | 'new' | null;

export default function AddressScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, updateUser } = useApp();
  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;

  const addresses = user?.savedAddresses ?? [];

  const [editing, setEditing] = useState<EditTarget>(null);
  const [draftLabel, setDraftLabel] = useState('');
  const [draftCoord, setDraftCoord] = useState<LatLng | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const openNew = () => {
    setEditing('new');
    setDraftLabel('');
    setDraftCoord(null);
    setError('');
  };

  const openEdit = (index: number) => {
    const a = addresses[index];
    setEditing(index);
    setDraftLabel(a.label);
    setDraftCoord(a.lat != null && a.lng != null ? { latitude: a.lat, longitude: a.lng } : null);
    setError('');
  };

  const closeEditor = () => {
    setEditing(null);
    setError('');
  };

  const persist = async (next: SavedAddress[]) => {
    setSaving(true);
    setError('');
    try {
      await updateUser({ savedAddresses: next });
      closeEditor();
    } catch (e: any) {
      setError(e?.message ?? 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    const label = draftLabel.trim();
    if (!label) {
      setError('Please enter an address.');
      return;
    }
    const entry: SavedAddress = {
      label,
      lat: draftCoord?.latitude ?? null,
      lng: draftCoord?.longitude ?? null,
    };
    const next = [...addresses];
    if (editing === 'new') next.push(entry);
    else if (typeof editing === 'number') next[editing] = entry;
    await persist(next);
  };

  const handleDelete = async (index: number) => {
    const next = addresses.filter((_, i) => i !== index);
    await persist(next);
  };

  const handleMakeDefault = async (index: number) => {
    if (index === 0) return;
    const next = [...addresses];
    const [picked] = next.splice(index, 1);
    next.unshift(picked);
    await persist(next);
  };

  const isEditorOpen = editing !== null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Delivery Addresses</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 16 }}>
        {!user ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="lock-closed-outline" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Sign in to manage your delivery addresses.
            </Text>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/signin' as any)}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>Sign In</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Saved address list */}
            {addresses.length === 0 && !isEditorOpen && (
              <View style={styles.emptyWrap}>
                <Ionicons name="location-outline" size={32} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  No saved addresses yet. Add one and drop a pin for accurate drop-offs.
                </Text>
              </View>
            )}

            {addresses.map((a, index) => {
              const pinned = a.lat != null && a.lng != null;
              return (
                <View key={`${a.label}-${index}`} style={[styles.addrCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[styles.addrIcon, { backgroundColor: colors.muted }]}>
                    <Ionicons name="location" size={20} color={colors.foreground} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.addrLabel, { color: colors.foreground }]} numberOfLines={2}>
                      {a.label}
                    </Text>
                    <View style={styles.badgeRow}>
                      {index === 0 && (
                        <View style={[styles.tag, { backgroundColor: colors.primary + '18' }]}>
                          <Text style={[styles.tagText, { color: colors.primary }]}>Default</Text>
                        </View>
                      )}
                      <View style={[styles.tag, { backgroundColor: pinned ? '#22C55E18' : colors.muted }]}>
                        <Ionicons
                          name={pinned ? 'pin' : 'pin-outline'}
                          size={11}
                          color={pinned ? '#16A34A' : colors.mutedForeground}
                        />
                        <Text style={[styles.tagText, { color: pinned ? '#16A34A' : colors.mutedForeground }]}>
                          {pinned ? 'Pinned' : 'No pin'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.actionRow}>
                      {index !== 0 && (
                        <TouchableOpacity onPress={() => handleMakeDefault(index)} disabled={saving} hitSlop={8}>
                          <Text style={[styles.actionText, { color: colors.primary }]}>Set default</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity onPress={() => openEdit(index)} disabled={saving} hitSlop={8}>
                        <Text style={[styles.actionText, { color: colors.primary }]}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDelete(index)} disabled={saving} hitSlop={8}>
                        <Text style={[styles.actionText, { color: colors.destructive }]}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}

            {/* Add / Edit form */}
            {isEditorOpen ? (
              <View style={[styles.editorCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.editorTitle, { color: colors.foreground }]}>
                  {editing === 'new' ? 'Add address' : 'Edit address'}
                </Text>
                <TextInput
                  style={[styles.input, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]}
                  placeholder="Street address, apt, etc."
                  placeholderTextColor={colors.mutedForeground}
                  value={draftLabel}
                  onChangeText={setDraftLabel}
                  multiline
                />
                <Text style={[styles.pickerLabel, { color: colors.foreground }]}>Drop-off location</Text>
                <AddressPicker value={draftCoord} onChange={setDraftCoord} />
                {error ? <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text> : null}
                <View style={styles.editorActions}>
                  <TouchableOpacity
                    style={[styles.secondaryBtn, { borderColor: colors.border }]}
                    onPress={closeEditor}
                    disabled={saving}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.secondaryBtnText, { color: colors.foreground }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.primaryBtn, { flex: 1, backgroundColor: saving ? colors.mutedForeground : colors.primary }]}
                    onPress={handleSave}
                    disabled={saving}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.primaryBtnText}>{saving ? 'Saving…' : 'Save address'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.addBtn, { borderColor: colors.primary }]}
                onPress={openNew}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={20} color={colors.primary} />
                <Text style={[styles.addBtnText, { color: colors.primary }]}>Add address</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  emptyWrap: { alignItems: 'center', gap: 12, paddingVertical: 40, paddingHorizontal: 20 },
  emptyText: { fontSize: 15, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22 },
  addrCard: { flexDirection: 'row', gap: 12, borderRadius: 16, borderWidth: 1, padding: 16 },
  addrIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  addrLabel: { fontSize: 15, fontFamily: 'Inter_600SemiBold', marginBottom: 8 },
  badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  tagText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  actionRow: { flexDirection: 'row', gap: 18 },
  actionText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  editorCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  editorTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  input: { borderRadius: 12, borderWidth: 1, padding: 14, fontSize: 15, fontFamily: 'Inter_400Regular', minHeight: 52 },
  pickerLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  errorText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  editorActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  secondaryBtn: { borderWidth: 1, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  primaryBtn: { borderRadius: 14, paddingVertical: 16, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderRadius: 14, paddingVertical: 16, borderStyle: 'dashed' },
  addBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold' },
});
