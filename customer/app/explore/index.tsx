import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ExploreBottomNav, { EXPLORE_NAV_HEIGHT } from '@/components/ExploreBottomNav';
import ExploreMap from '@/components/ExploreMap';
import { useColors } from '@/hooks/useColors';

export default function ExploreWelcome() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const bottomClear = EXPLORE_NAV_HEIGHT + (Platform.OS === 'web' ? 8 : Math.max(insets.bottom, 8)) + 24;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: topPad + 12, paddingHorizontal: 24, paddingBottom: bottomClear }}
      >
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backBtn}>
          <Ionicons name="close" size={28} color={colors.foreground} />
        </TouchableOpacity>

        <Image
          source={require('@/assets/images/logo-horizontal.png')}
          style={styles.brandLogo}
          resizeMode="contain"
          accessibilityLabel="Let's Feast"
        />

        <Text style={[styles.title, { color: colors.foreground }]}>Let's Explore</Text>
        <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
          Find restaurants, bars, and food spots built around your taste.
        </Text>

        <View style={styles.mapWrap}>
          <ExploreMap count={5} variant="food" height={240} />
        </View>

        <View style={[styles.infoCard, { backgroundColor: colors.muted }]}>
          <View style={[styles.infoIcon, { backgroundColor: colors.primary + '15' }]}>
            <Ionicons name="sparkles" size={20} color={colors.primary} />
          </View>
          <Text style={[styles.infoText, { color: colors.foreground }]}>
            Answer a few quick questions and we'll match you with spots tuned to your
            cravings, location, and preferences.
          </Text>
        </View>

        <View style={styles.contentSection}>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
            activeOpacity={0.88}
            onPress={() => router.push('/explore/results' as any)}
          >
            <Ionicons name="compass" size={20} color="#fff" />
            <Text style={styles.primaryBtnText}>Show me new places</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryBtn, { backgroundColor: colors.card, borderColor: colors.primary }]}
            activeOpacity={0.85}
            onPress={() => router.push('/explore/questions' as any)}
          >
            <Text style={[styles.secondaryBtnText, { color: colors.primary }]}>
              I'm new, let's explore
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <ExploreBottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backBtn: { marginBottom: 8, alignSelf: 'flex-end' },
  brandLogo: { width: 180, height: 94, marginBottom: 20 },
  title: { fontSize: 36, fontFamily: 'Inter_700Bold' },
  tagline: { fontSize: 16, fontFamily: 'Inter_400Regular', marginTop: 8, marginBottom: 28, lineHeight: 24 },
  mapWrap: { marginBottom: 24 },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 18,
    marginBottom: 28,
  },
  infoIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  infoText: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  contentSection: { gap: 16 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
    borderRadius: 16,
  },
  primaryBtnText: { color: '#fff', fontSize: 17, fontFamily: 'Inter_700Bold' },
  secondaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  secondaryBtnText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
});
