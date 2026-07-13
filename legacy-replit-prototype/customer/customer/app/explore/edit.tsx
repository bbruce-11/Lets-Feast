import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useExplore } from '@/context/ExploreContext';
import { EMPTY_PREFERENCES, hasAnyPreference, type ExplorePreferences } from '@/lib/exploreRecommend';
import ExploreBottomNav, { EXPLORE_NAV_HEIGHT } from '@/components/ExploreBottomNav';
import ExplorePill from '@/components/ExplorePill';
import {
  CUISINE_OPTIONS,
  DIETARY_OPTIONS,
  FOOD_OPTIONS,
  MEAL_TYPE_OPTIONS,
  PRICE_OPTIONS,
  RATING_OPTIONS,
  VIBE_OPTIONS,
} from '@/data/exploreOptions';

type PrefKey = keyof ExplorePreferences;

const SECTIONS: { key: PrefKey; label: string; options: string[] }[] = [
  { key: 'vibes', label: 'Vibes', options: VIBE_OPTIONS },
  { key: 'cuisines', label: 'Cuisines', options: CUISINE_OPTIONS },
  { key: 'foods', label: 'Foods', options: FOOD_OPTIONS },
  { key: 'dietary', label: 'Dietary', options: DIETARY_OPTIONS },
  { key: 'mealTypes', label: 'Meal Types', options: MEAL_TYPE_OPTIONS },
  { key: 'price', label: 'Price Range', options: PRICE_OPTIONS },
  { key: 'ratings', label: 'Ratings', options: RATING_OPTIONS },
];

export default function ExploreEdit() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { preferences, savePreferences, resetPreferences } = useExplore();
  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const navTotal = EXPLORE_NAV_HEIGHT + (Platform.OS === 'web' ? 8 : Math.max(insets.bottom, 8));
  const bottomClear = navTotal + 120;

  const [draft, setDraft] = useState<ExplorePreferences>(() => ({
    ...EMPTY_PREFERENCES,
    ...preferences,
  }));

  const toggle = (key: PrefKey, value: string) => {
    setDraft((prev) => {
      const current = prev[key];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [key]: next };
    });
  };

  const onSave = async () => {
    await savePreferences(draft);
    if (router.canGoBack()) router.back();
    else router.replace('/explore/results');
  };

  const onClear = async () => {
    setDraft({ ...EMPTY_PREFERENCES });
    await resetPreferences();
  };

  const dirty = hasAnyPreference(draft);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={{ paddingTop: topPad + 16, paddingHorizontal: 24 }}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onClear}
            activeOpacity={0.7}
            disabled={!dirty}
            style={styles.clearBtn}
          >
            <Text
              style={[
                styles.clearText,
                { color: dirty ? colors.primary : colors.mutedForeground },
              ]}
            >
              Clear all
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: bottomClear }}
      >
        <Text style={[styles.heading, { color: colors.foreground }]}>Edit your tastes</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Tweak any of these and your picks re-rank instantly.
        </Text>

        {SECTIONS.map((section) => (
          <View key={section.key} style={styles.section}>
            <Text style={[styles.groupLabel, { color: colors.foreground }]}>{section.label}</Text>
            <View style={styles.pillWrap}>
              {section.options.map((opt) => (
                <ExplorePill
                  key={opt}
                  label={opt}
                  selected={draft[section.key].includes(opt)}
                  onPress={() => toggle(section.key, opt)}
                />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            bottom: navTotal,
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.primary }]}
          activeOpacity={0.88}
          onPress={onSave}
        >
          <Text style={styles.saveBtnText}>Save changes</Text>
        </TouchableOpacity>
      </View>

      <ExploreBottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
  clearBtn: { paddingVertical: 8, paddingHorizontal: 4 },
  clearText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  heading: { fontSize: 32, fontFamily: 'Inter_700Bold', marginBottom: 8, lineHeight: 38 },
  subtitle: { fontSize: 16, fontFamily: 'Inter_400Regular', marginBottom: 28 },
  section: { marginBottom: 28 },
  groupLabel: { fontSize: 18, fontFamily: 'Inter_700Bold', marginBottom: 16 },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  saveBtn: {
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 17, fontFamily: 'Inter_700Bold' },
});
