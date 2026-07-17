import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { discountUnlockThreshold, isDiscountUnlocked } from '@/lib/feastWindows';
import type { ApiFeastWindow } from '@/lib/api';

interface Props {
  window: ApiFeastWindow;
  isJoined: boolean;
  onJoin: (id: string) => Promise<void>;
  restaurantName?: string;
}

export function FeastWindowCard({ window: win, isJoined, onJoin, restaurantName }: Props) {
  const colors = useColors();
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unlocked = isDiscountUnlocked(win);
  const isFull = win.spotsFilled >= win.spotsTotal;
  const spotsToUnlock = Math.max(0, discountUnlockThreshold(win.spotsTotal) - win.spotsFilled);
  const progress = Math.min(1, win.spotsFilled / win.spotsTotal);

  async function handleJoin() {
    setError(null);
    setIsJoining(true);
    try {
      await onJoin(win.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join');
    } finally {
      setIsJoining(false);
    }
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: unlocked ? colors.accent : colors.border }]}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          {restaurantName && (
            <Text style={[styles.restaurantName, { color: colors.mutedForeground }]}>{restaurantName}</Text>
          )}
          <Text style={[styles.title, { color: colors.foreground }]}>
            {win.deliveryStart} – {win.deliveryEnd} delivery
          </Text>
        </View>
        {unlocked && (
          <View style={[styles.unlockedBadge, { backgroundColor: colors.accent }]}>
            <Ionicons name="flash" size={12} color="#fff" />
            <Text style={styles.unlockedText}>${Number.parseFloat(win.discount).toFixed(0)} off unlocked</Text>
          </View>
        )}
      </View>

      <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
        <View
          style={[
            styles.progressFill,
            { width: `${progress * 100}%`, backgroundColor: unlocked ? colors.accent : colors.primary },
          ]}
        />
      </View>

      <Text style={[styles.spotsText, { color: colors.mutedForeground }]}>
        {isFull
          ? 'Full'
          : unlocked
            ? `${win.spotsFilled}/${win.spotsTotal} joined — discount active`
            : `${spotsToUnlock} more to unlock $${Number.parseFloat(win.discount).toFixed(0)} off`}
      </Text>

      {error && <Text style={{ color: colors.destructive, fontSize: 12, marginTop: 4 }}>{error}</Text>}

      {isJoined ? (
        <View style={styles.joinedRow}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={{ color: colors.success, fontWeight: '600', fontSize: 13 }}>You're in</Text>
        </View>
      ) : (
        <TouchableOpacity
          onPress={handleJoin}
          disabled={isJoining || isFull}
          style={[styles.joinButton, { backgroundColor: colors.primary, opacity: isFull ? 0.5 : 1 }]}
        >
          {isJoining ? (
            <ActivityIndicator color={colors.primaryForeground} size="small" />
          ) : (
            <Text style={{ color: colors.primaryForeground, fontWeight: '600', fontSize: 13 }}>
              {isFull ? 'Full' : 'Join this Feast Window'}
            </Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 8 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerText: { flex: 1, paddingRight: 8 },
  restaurantName: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  title: { fontSize: 15, fontWeight: '700', marginTop: 2 },
  unlockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  unlockedText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  spotsText: { fontSize: 12 },
  joinedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  joinButton: { height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
});
