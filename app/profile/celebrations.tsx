import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import ScreenHeader from '@/components/ScreenHeader';
import {
  loadCelebrationHistory,
  type CelebrationEntry,
} from '@/lib/celebrationHistory';

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return `Today at ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday at ${time}`;
  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at ${time}`;
}

export default function CelebrationsScreen() {
  const colors = useColors();
  const router = useRouter();
  const [entries, setEntries] = useState<CelebrationEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Reload on focus so a celebration that landed while browsing shows up.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadCelebrationHistory().then((list) => {
        if (!cancelled) {
          setEntries(list);
          setLoaded(true);
        }
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const openEntry = (entry: CelebrationEntry) => {
    if (entry.restaurantId) {
      router.push({ pathname: '/restaurant/[id]', params: { id: entry.restaurantId } } as any);
    } else {
      router.push('/(tabs)' as any);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Celebrations" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 12 }}
      >
        {loaded && entries.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.gold + '15' }]}>
              <Ionicons name="trophy-outline" size={30} color={colors.gold} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              No celebrations yet
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              When a Feast Window you've joined unlocks its group deal, that moment
              lands here so you can relive it anytime.
            </Text>
          </View>
        ) : null}

        {entries.map((entry) => (
          <TouchableOpacity
            key={`${entry.windowId}-${entry.unlockedAt}`}
            style={[styles.card, { backgroundColor: colors.card }]}
            onPress={() => openEntry(entry)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={
              entry.restaurantName
                ? `Group deal unlocked at ${entry.restaurantName}`
                : 'Group deal unlocked'
            }
          >
            <View style={[styles.iconWrap, { backgroundColor: colors.success }]}>
              <Ionicons name="trophy" size={18} color="#fff" />
            </View>
            <View style={styles.cardInfo}>
              <Text style={[styles.cardMessage, { color: colors.foreground }]}>
                {entry.message}
              </Text>
              <Text style={[styles.cardWhen, { color: colors.mutedForeground }]}>
                {formatWhen(entry.unlockedAt)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  emptyWrap: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24, gap: 12 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20, textAlign: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  iconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1, gap: 3 },
  cardMessage: { fontSize: 14, fontFamily: 'Inter_500Medium', lineHeight: 19 },
  cardWhen: { fontSize: 12, fontFamily: 'Inter_400Regular' },
});
