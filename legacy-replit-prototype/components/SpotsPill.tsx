import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Animated, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useSpotsPulse } from '@/hooks/useSpotsPulse';

interface Props {
  spotsLeft: number;
  size?: 'sm' | 'md';
}

export default function SpotsPill({ spotsLeft, size = 'md' }: Props) {
  const colors = useColors();
  const isFull = spotsLeft <= 0;
  const scale = useSpotsPulse(spotsLeft);
  const sm = size === 'sm';

  return (
    <Animated.View
      style={[
        sm ? styles.pillSm : styles.pill,
        { backgroundColor: colors.destructive, transform: [{ scale }] },
      ]}
    >
      <Ionicons name={isFull ? 'lock-closed' : 'people'} size={sm ? 11 : 12} color="#fff" />
      <Animated.Text style={sm ? styles.textSm : styles.text}>
        {isFull ? 'Full' : `${spotsLeft} left`}
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 },
  text: { color: '#fff', fontSize: 11, fontFamily: 'Inter_700Bold' },
  pillSm: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  textSm: { color: '#fff', fontSize: 10, fontFamily: 'Inter_700Bold' },
});
