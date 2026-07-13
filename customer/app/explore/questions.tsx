import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useExplore } from '@/context/ExploreContext';
import { EMPTY_PREFERENCES, type ExplorePreferences } from '@/lib/exploreRecommend';
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

const TOTAL_STEPS = 5;

type PrefKey = keyof ExplorePreferences;

export default function ExploreQuestions() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { preferences, savePreferences, loaded } = useExplore();
  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const navTotal = EXPLORE_NAV_HEIGHT + (Platform.OS === 'web' ? 8 : Math.max(insets.bottom, 8));
  const bottomClear = navTotal + 120;

  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<ExplorePreferences>(() => ({
    ...EMPTY_PREFERENCES,
    ...preferences,
  }));

  const editedRef = useRef(false);
  useEffect(() => {
    if (loaded && !editedRef.current) {
      setDraft({ ...EMPTY_PREFERENCES, ...preferences });
    }
  }, [loaded, preferences]);

  const toggle = (key: PrefKey, value: string) => {
    editedRef.current = true;
    setDraft((prev) => {
      const current = prev[key];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [key]: next };
    });
  };

  const goBack = () => {
    if (step === 0) router.back();
    else setStep((s) => s - 1);
  };

  const goNext = async () => {
    if (step < TOTAL_STEPS - 1) {
      setStep((s) => s + 1);
      return;
    }
    await savePreferences(draft);
    router.replace('/explore/results' as any);
  };

  const isLast = step === TOTAL_STEPS - 1;

  const renderPills = (key: PrefKey, options: string[]) => (
    <View style={styles.pillWrap}>
      {options.map((opt) => (
        <ExplorePill
          key={opt}
          label={opt}
          selected={draft[key].includes(opt)}
          onPress={() => toggle(key, opt)}
        />
      ))}
    </View>
  );

  const STEPS: { title: string; subtitle: string; content: React.ReactNode }[] = [
    {
      title: "What's your vibe?",
      subtitle: 'Pick the atmospheres you enjoy.',
      content: renderPills('vibes', VIBE_OPTIONS),
    },
    {
      title: 'Which cuisines call to you?',
      subtitle: 'Choose as many as you like.',
      content: renderPills('cuisines', CUISINE_OPTIONS),
    },
    {
      title: 'What foods are you craving?',
      subtitle: 'Tell us what sounds good right now.',
      content: renderPills('foods', FOOD_OPTIONS),
    },
    {
      title: 'Any dietary preferences?',
      subtitle: "We'll keep these in mind for every pick.",
      content: renderPills('dietary', DIETARY_OPTIONS),
    },
    {
      title: 'Last few details',
      subtitle: 'Meal type, price, and minimum rating.',
      content: (
        <View>
          <Text style={[styles.groupLabel, { color: colors.foreground }]}>Meal Types</Text>
          {renderPills('mealTypes', MEAL_TYPE_OPTIONS)}
          <Text style={[styles.groupLabel, { color: colors.foreground, marginTop: 24 }]}>Price Range</Text>
          {renderPills('price', PRICE_OPTIONS)}
          <Text style={[styles.groupLabel, { color: colors.foreground, marginTop: 24 }]}>Ratings</Text>
          {renderPills('ratings', RATING_OPTIONS)}
        </View>
      ),
    },
  ];

  const active = STEPS[step];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={{ paddingTop: topPad + 16, paddingHorizontal: 24 }}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={goBack} activeOpacity={0.7} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
            <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${((step + 1) / TOTAL_STEPS) * 100}%` }]} />
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: bottomClear }}
      >
        <Text style={[styles.question, { color: colors.foreground }]}>{active.title}</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{active.subtitle}</Text>
        <View style={styles.contentWrap}>
          {active.content}
        </View>
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
          style={[styles.nextBtn, { backgroundColor: colors.primary }]}
          activeOpacity={0.88}
          onPress={goNext}
        >
          <Text style={styles.nextBtnText}>{isLast ? "See Recommendations" : 'Continue'}</Text>
        </TouchableOpacity>
      </View>

      <ExploreBottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  backBtn: { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  question: { fontSize: 32, fontFamily: 'Inter_700Bold', marginBottom: 8, lineHeight: 38 },
  subtitle: { fontSize: 16, fontFamily: 'Inter_400Regular', marginBottom: 32 },
  contentWrap: { paddingBottom: 24 },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  groupLabel: { fontSize: 18, fontFamily: 'Inter_700Bold', marginBottom: 16 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  nextBtn: {
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtnText: { color: '#fff', fontSize: 17, fontFamily: 'Inter_700Bold' },
});
