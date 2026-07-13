import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import ScreenHeader from '@/components/ScreenHeader';
import ExplorePill from '@/components/ExplorePill';
import { STORAGE_KEYS } from '@/constants/profile';
import {
  CUISINE_OPTIONS,
  DIETARY_OPTIONS,
  FOOD_OPTIONS,
  MEAL_TYPE_OPTIONS,
  PRICE_OPTIONS,
  RATING_OPTIONS,
} from '@/data/exploreOptions';

const ALLERGY_OPTIONS = [
  'Peanuts', 'Tree Nuts', 'Dairy', 'Eggs', 'Shellfish', 'Fish',
  'Soy', 'Wheat / Gluten', 'Sesame',
];

interface FoodPrefs {
  cuisines: string[];
  foods: string[];
  dietary: string[];
  allergies: string[];
  mealTypes: string[];
  price: string[];
  rating: string[];
}

const EMPTY: FoodPrefs = {
  cuisines: [],
  foods: [],
  dietary: [],
  allergies: [],
  mealTypes: [],
  price: [],
  rating: [],
};

type SectionKey = keyof FoodPrefs;

const SECTIONS: { key: SectionKey; label: string; options: string[]; single?: boolean }[] = [
  { key: 'cuisines', label: 'Favorite cuisines', options: CUISINE_OPTIONS },
  { key: 'foods', label: 'Foods I frequently order', options: FOOD_OPTIONS },
  { key: 'dietary', label: 'Dietary restrictions', options: DIETARY_OPTIONS },
  { key: 'allergies', label: 'Allergies', options: ALLERGY_OPTIONS },
  { key: 'mealTypes', label: 'Meal types', options: MEAL_TYPE_OPTIONS },
  { key: 'price', label: 'Price range', options: PRICE_OPTIONS, single: true },
  { key: 'rating', label: 'Rating preference', options: RATING_OPTIONS, single: true },
];

export default function FoodPreferencesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<FoodPrefs>(EMPTY);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEYS.foodPrefs);
        if (!raw) return;
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        // Guard against corrupt/stale storage: keep only string arrays per key.
        const safe: FoodPrefs = { ...EMPTY };
        (Object.keys(EMPTY) as SectionKey[]).forEach((key) => {
          const value = parsed[key];
          if (Array.isArray(value)) safe[key] = value.filter((v): v is string => typeof v === 'string');
        });
        setDraft(safe);
      } catch {
        // start from empty on read failure
      }
    })();
  }, []);

  const toggle = (key: SectionKey, value: string, single?: boolean) => {
    setSaved(false);
    setError('');
    setDraft((prev) => {
      const current = prev[key];
      if (single) {
        return { ...prev, [key]: current.includes(value) ? [] : [value] };
      }
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [key]: next };
    });
  };

  const handleSave = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.foodPrefs, JSON.stringify(draft));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSaved(true);
    } catch {
      setError('Could not save your preferences. Please try again.');
    }
  };

  const bottomPad = (Platform.OS === 'web' ? 16 : Math.max(insets.bottom, 16)) + 96;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Food Preferences" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, paddingBottom: bottomPad }}
      >
        <Text style={[styles.intro, { color: colors.mutedForeground }]}>
          Tell us what you love and what to avoid. We'll use this to tailor your Feast.
        </Text>

        {SECTIONS.map((section) => (
          <View key={section.key} style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>{section.label}</Text>
            <View style={styles.pillWrap}>
              {section.options.map((opt) => (
                <ExplorePill
                  key={opt}
                  label={opt}
                  selected={draft[section.key].includes(opt)}
                  onPress={() => toggle(section.key, opt, section.single)}
                />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <View
        style={[
          styles.footer,
          { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: Platform.OS === 'web' ? 16 : Math.max(insets.bottom, 16) },
        ]}
      >
        {saved ? (
          <View style={styles.savedRow}>
            <Text style={[styles.savedText, { color: colors.success }]}>Preferences saved</Text>
          </View>
        ) : null}
        {error ? (
          <View style={styles.savedRow}>
            <Text style={[styles.savedText, { color: colors.destructive }]}>{error}</Text>
          </View>
        ) : null}
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.primary }]}
          onPress={handleSave}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <Text style={styles.saveBtnText}>Save Preferences</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  intro: { fontSize: 15, fontFamily: 'Inter_400Regular', lineHeight: 22, marginBottom: 24 },
  section: { marginBottom: 28 },
  sectionLabel: { fontSize: 17, fontFamily: 'Inter_700Bold', marginBottom: 14 },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  savedRow: { alignItems: 'center', paddingBottom: 8 },
  savedText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  saveBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 14 },
  saveBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
});
