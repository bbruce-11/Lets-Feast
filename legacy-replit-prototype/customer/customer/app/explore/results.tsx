import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ExploreBottomNav, { EXPLORE_NAV_HEIGHT } from '@/components/ExploreBottomNav';
import ExploreMap from '@/components/ExploreMap';
import ExploreResultCard from '@/components/ExploreResultCard';
import { useColors } from '@/hooks/useColors';
import { useExplore } from '@/context/ExploreContext';
import { useFeastWindows } from '@/context/FeastWindowContext';
import { useRestaurants } from '@/hooks/useRestaurants';
import { type FeastWindow } from '@/data/mockData';
import { hasAnyPreference, rankRestaurants } from '@/lib/exploreRecommend';

export default function ExploreResults() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { preferences } = useExplore();
  const { restaurants, isLoading } = useRestaurants();
  const { feastWindows } = useFeastWindows();
  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const bottomClear = EXPLORE_NAV_HEIGHT + (Platform.OS === 'web' ? 8 : Math.max(insets.bottom, 8)) + 24;

  const personalized = hasAnyPreference(preferences);
  const ranked = useMemo(
    () => rankRestaurants(restaurants, preferences, 7),
    [restaurants, preferences]
  );

  const windowsByRestaurant = useMemo(() => {
    const map = new Map<string, FeastWindow>();
    for (const fw of feastWindows) {
      map.set(fw.restaurantId, fw);
    }
    return map;
  }, [feastWindows]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: topPad + 12, paddingHorizontal: 20, paddingBottom: bottomClear }}
      >
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={[styles.backBtn, { backgroundColor: colors.card }]}>
            <Ionicons name="arrow-back" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() =>
              router.push(personalized ? '/explore/edit' : '/explore/questions')
            }
            activeOpacity={0.7}
            style={[styles.adjustBtn, { backgroundColor: colors.muted }]}
          >
            <Ionicons name="options-outline" size={16} color={colors.foreground} />
            <Text style={[styles.adjustText, { color: colors.foreground }]}>
              {personalized ? 'Edit tastes' : 'Personalize'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.title, { color: colors.foreground }]}>Recommended for You</Text>
        <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
          Based on your taste, location, and preferences.
        </Text>

        <View style={styles.mapWrap}>
          <ExploreMap count={ranked.length} variant="numbered" height={240} />
        </View>

        <Text style={[styles.sectionLabel, { color: colors.foreground }]}>
          {ranked.length} spot{ranked.length === 1 ? '' : 's'} recommended
        </Text>

        {ranked.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={[styles.empty, { color: colors.mutedForeground }]}>
              {isLoading ? 'Finding restaurants near you…' : 'No restaurants available right now.'}
            </Text>
          </View>
        ) : (
          ranked.map((item) => (
            <ExploreResultCard
              key={item.restaurant.id}
              ranked={item}
              feastWindow={windowsByRestaurant.get(item.restaurant.id)}
            />
          ))
        )}
      </ScrollView>

      <ExploreBottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  adjustBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  adjustText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  title: { fontSize: 32, fontFamily: 'Inter_700Bold' },
  tagline: { fontSize: 16, fontFamily: 'Inter_400Regular', marginTop: 8, marginBottom: 24, lineHeight: 24 },
  mapWrap: { marginBottom: 32 },
  sectionLabel: { fontSize: 20, fontFamily: 'Inter_700Bold', marginBottom: 20 },
  emptyWrap: { paddingVertical: 40, alignItems: 'center' },
  empty: { fontSize: 16, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});
