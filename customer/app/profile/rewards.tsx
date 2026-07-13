import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import ScreenHeader from '@/components/ScreenHeader';
import { REWARDS, REWARDS_POINTS, REWARDS_TIER, STORAGE_KEYS } from '@/constants/profile';

export default function RewardsScreen() {
  const colors = useColors();
  const [redeemed, setRedeemed] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEYS.redeemedRewards);
        if (raw) {
          const parsed = JSON.parse(raw) as string[];
          if (Array.isArray(parsed)) setRedeemed(parsed);
        }
      } catch {
        // ignore read failure
      }
    })();
  }, []);

  // Progress toward the next reward the customer can't yet afford.
  const nextReward = useMemo(
    () => REWARDS.filter((r) => r.points > REWARDS_POINTS).sort((a, b) => a.points - b.points)[0],
    [],
  );
  const progress = nextReward ? Math.min(REWARDS_POINTS / nextReward.points, 1) : 1;

  const redeem = async (id: string, points: number) => {
    if (REWARDS_POINTS < points || redeemed.includes(id)) return;
    const next = [...redeemed, id];
    setRedeemed(next);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.redeemedRewards, JSON.stringify(next));
    } catch {
      // non-fatal for a mock store
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Feast Rewards" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 20 }}>
        {/* Points hero */}
        <LinearGradient colors={[colors.gold, '#7A5C20']} style={styles.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={styles.heroTopRow}>
            <View style={styles.tierBadge}>
              <Ionicons name="star" size={13} color="#fff" />
              <Text style={styles.tierText}>{REWARDS_TIER}</Text>
            </View>
            <Ionicons name="gift" size={24} color="rgba(255,255,255,0.9)" />
          </View>
          <Text style={styles.points}>{REWARDS_POINTS}</Text>
          <Text style={styles.pointsLabel}>Feast Reward points</Text>

          {nextReward ? (
            <View style={styles.progressWrap}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
              </View>
              <Text style={styles.progressText}>
                {nextReward.points - REWARDS_POINTS} pts to {nextReward.name}
              </Text>
            </View>
          ) : (
            <Text style={styles.progressText}>You've unlocked every reward!</Text>
          )}
        </LinearGradient>

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Available rewards</Text>

        {REWARDS.map((reward) => {
          const isRedeemed = redeemed.includes(reward.id);
          const affordable = REWARDS_POINTS >= reward.points;
          return (
            <View key={reward.id} style={[styles.rewardCard, { backgroundColor: colors.card }]}>
              <View style={[styles.rewardIcon, { backgroundColor: colors.gold + '15' }]}>
                <Ionicons name={reward.icon as any} size={22} color={colors.gold} />
              </View>
              <View style={styles.rewardInfo}>
                <Text style={[styles.rewardName, { color: colors.foreground }]}>{reward.name}</Text>
                <Text style={[styles.rewardDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
                  {reward.desc}
                </Text>
                <Text style={[styles.rewardPoints, { color: colors.gold }]}>{reward.points} pts</Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.redeemBtn,
                  isRedeemed
                    ? { backgroundColor: colors.success + '15' }
                    : affordable
                      ? { backgroundColor: colors.primary }
                      : { backgroundColor: colors.muted },
                ]}
                onPress={() => redeem(reward.id, reward.points)}
                disabled={isRedeemed || !affordable}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`Redeem ${reward.name}`}
              >
                {isRedeemed ? (
                  <Ionicons name="checkmark" size={16} color={colors.success} />
                ) : null}
                <Text
                  style={[
                    styles.redeemText,
                    {
                      color: isRedeemed
                        ? colors.success
                        : affordable
                          ? '#fff'
                          : colors.mutedForeground,
                    },
                  ]}
                >
                  {isRedeemed ? 'Saved' : affordable ? 'Redeem' : 'Locked'}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}

        {redeemed.length > 0 ? (
          <View style={[styles.savedBanner, { backgroundColor: colors.success + '12' }]}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={[styles.savedBannerText, { color: colors.foreground }]}>
              Reward saved to your account.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: { borderRadius: 24, padding: 24 },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  tierText: { color: '#fff', fontSize: 12, fontFamily: 'Inter_700Bold' },
  points: { color: '#fff', fontSize: 48, fontFamily: 'Inter_700Bold' },
  pointsLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 15, fontFamily: 'Inter_500Medium', marginBottom: 18 },
  progressWrap: { gap: 8 },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: '#fff' },
  progressText: { color: 'rgba(255,255,255,0.95)', fontSize: 13, fontFamily: 'Inter_500Medium' },
  sectionTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  rewardCard: {
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
  rewardIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rewardInfo: { flex: 1, gap: 3 },
  rewardName: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  rewardDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  rewardPoints: { fontSize: 13, fontFamily: 'Inter_700Bold', marginTop: 2 },
  redeemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 84,
    justifyContent: 'center',
  },
  redeemText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  savedBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderRadius: 16 },
  savedBannerText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
});
