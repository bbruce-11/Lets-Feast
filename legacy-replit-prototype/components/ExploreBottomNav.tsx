import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

const TABS = [
  { label: 'Home', icon: 'home-outline' as const, route: '/(tabs)' },
  { label: 'Search', icon: 'search-outline' as const, route: '/(tabs)/search' },
  { label: 'Cart', icon: 'cart-outline' as const, route: '/(tabs)/cart' },
  { label: 'Profile', icon: 'person-outline' as const, route: '/(tabs)/profile' },
  { label: 'More', icon: 'grid-outline' as const, route: '/(tabs)/more' },
];

export const EXPLORE_NAV_HEIGHT = 60;

export default function ExploreBottomNav() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === 'web' ? 12 : Math.max(insets.bottom, 12);

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.background,
          paddingBottom: bottomPad,
          height: EXPLORE_NAV_HEIGHT + bottomPad,
        },
      ]}
    >
      {TABS.map((tab) => (
        <TouchableOpacity
          key={tab.label}
          style={styles.item}
          activeOpacity={0.7}
          onPress={() => router.push(tab.route as any)}
        >
          <Ionicons name={tab.icon} size={24} color={colors.mutedForeground} />
          <Text style={[styles.label, { color: colors.mutedForeground }]}>{tab.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  item: { alignItems: 'center', justifyContent: 'center', gap: 4, flex: 1 },
  label: { fontSize: 10, fontFamily: 'Inter_500Medium' },
});
