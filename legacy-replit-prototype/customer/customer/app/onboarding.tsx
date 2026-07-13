import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';

const STEPS = [
  {
    id: 'cuisines', title: 'What kind of food do you like?', subtitle: 'Pick everything that sounds good to you.',
    options: ['Mexican', 'American', 'Italian', 'Chinese', 'Thai', 'Soul Food', 'Mediterranean', 'Burgers', 'Pizza', 'Seafood', 'Vegan', 'Coffee', 'Breakfast'],
  },
  {
    id: 'allergies', title: 'Any allergies we should know about?', subtitle: "We'll flag dishes that contain these.",
    options: ['Peanuts', 'Tree nuts', 'Dairy', 'Shellfish', 'Gluten', 'Soy', 'Eggs', 'Fish', 'Sesame', 'None'],
  },
  {
    id: 'dietary', title: 'Any dietary preferences?', subtitle: "We'll personalize your feed to match.",
    options: ['Vegetarian', 'Vegan', 'Halal', 'Kosher', 'Gluten-free', 'Low-carb', 'High-protein', 'No pork', 'No beef', 'No preference'],
  },
];

export default function OnboardingScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { completeOnboarding } = useApp();

  const [step, setStep] = useState(0);
  const [selections, setSelections] = useState<Record<string, string[]>>({
    cuisines: [], allergies: [], dietary: [], radius: [], lookingFor: [],
  });

  const current = STEPS[step];

  const toggle = (option: string) => {
    setSelections((prev) => {
      const list = prev[current.id];
      if (list.includes(option)) return { ...prev, [current.id]: list.filter((o) => o !== option) };
      return { ...prev, [current.id]: [...list, option] };
    });
  };

  const handleNext = async () => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      await completeOnboarding({
        cuisines: selections.cuisines,
        allergies: selections.allergies,
        dietary: selections.dietary,
        radius: 'Within 5 miles',
        lookingFor: [],
      });
      router.replace('/(tabs)' as any);
    }
  };

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const isLast = step === STEPS.length - 1;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Progress bar */}
      <View style={[styles.progressContainer, { paddingTop: topPad + 16 }]}>
        <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
          <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${((step + 1) / STEPS.length) * 100}%` }]} />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 120 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>{current.title}</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{current.subtitle}</Text>

        <View style={styles.optionsGrid}>
          {current.options.map((option) => {
            const selected = selections[current.id].includes(option);
            return (
              <TouchableOpacity
                key={option}
                style={[
                  styles.option, 
                  { 
                    backgroundColor: selected ? colors.primary : colors.card,
                    borderColor: selected ? colors.primary : colors.border,
                  }
                ]}
                onPress={() => toggle(option)}
                activeOpacity={0.8}
              >
                <Text style={[styles.optionText, { color: selected ? '#fff' : colors.foreground }]}>
                  {option}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16, borderTopColor: colors.border }]}>
        <TouchableOpacity style={[styles.nextBtn, { backgroundColor: colors.primary }]} onPress={handleNext} activeOpacity={0.85}>
          <Text style={styles.nextBtnText}>{isLast ? 'Complete Setup' : 'Continue'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  progressContainer: { paddingHorizontal: 24, paddingBottom: 16 },
  progressBarBg: { height: 6, borderRadius: 3, width: '100%' },
  progressFill: { height: '100%', borderRadius: 3 },
  scroll: { paddingHorizontal: 24, paddingTop: 16 },
  title: { fontSize: 28, fontFamily: 'Inter_700Bold', marginBottom: 8, lineHeight: 34 },
  subtitle: { fontSize: 16, fontFamily: 'Inter_400Regular', marginBottom: 32 },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  option: { 
    paddingHorizontal: 20, 
    paddingVertical: 12, 
    borderRadius: 24, 
    borderWidth: 1,
  },
  optionText: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 24, paddingTop: 16, borderTopWidth: 1 },
  nextBtn: { paddingVertical: 18, borderRadius: 16, alignItems: 'center' },
  nextBtnText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 17 },
});
