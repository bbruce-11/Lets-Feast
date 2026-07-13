import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

interface Props {
  count: number;
  variant?: 'numbered' | 'food';
  height?: number;
}

const PIN_POSITIONS = [
  { top: '16%', left: '18%' },
  { top: '30%', left: '64%' },
  { top: '50%', left: '36%' },
  { top: '58%', left: '80%' },
  { top: '70%', left: '16%' },
  { top: '38%', left: '88%' },
  { top: '78%', left: '54%' },
] as const;

export default function ExploreMap({ count, variant = 'numbered', height = 240 }: Props) {
  const colors = useColors();
  const pins = Math.min(Math.max(count, 0), PIN_POSITIONS.length);

  return (
    <View style={[styles.map, { height, borderColor: colors.border }]}>
      {/* Clean elegant map backdrop */}
      <View style={[styles.water, { backgroundColor: '#E2F1F8' }]} />
      <View style={[styles.park, { backgroundColor: '#EBF4E5', top: '12%', left: '8%' }]} />
      <View style={[styles.park, { backgroundColor: '#EBF4E5', bottom: '10%', right: '12%' }]} />
      
      {Array.from({ length: pins }).map((_, i) => {
        const pos = PIN_POSITIONS[i];
        return (
          <View key={i} style={[styles.pinWrap, { top: pos.top as any, left: pos.left as any }]}>
            <View style={[styles.pin, { backgroundColor: colors.foreground }]}>
              {variant === 'numbered' ? (
                <Text style={styles.pinText}>{i + 1}</Text>
              ) : (
                <Ionicons name="restaurant" size={14} color="#fff" />
              )}
            </View>
            <View style={[styles.pinTail, { borderTopColor: colors.foreground }]} />
          </View>
        );
      })}

      <View style={[styles.youWrap, { bottom: '24%', left: '46%' }]}>
        <View style={[styles.youPulse, { backgroundColor: colors.primary + '40' }]} />
        <View style={[styles.youDot, { borderColor: colors.background }]}>
          <View style={[styles.youInner, { backgroundColor: colors.primary }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    width: '100%',
    borderRadius: 24,
    borderWidth: 1,
    backgroundColor: '#F7F9FA',
    overflow: 'hidden',
    position: 'relative',
  },
  water: { position: 'absolute', top: 0, right: 0, width: '40%', height: '50%', borderBottomLeftRadius: 60 },
  park: { position: 'absolute', width: 90, height: 80, borderRadius: 20 },
  pinWrap: { position: 'absolute', alignItems: 'center', marginLeft: -16, marginTop: -32 },
  pin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  pinText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_700Bold' },
  pinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -2,
  },
  youWrap: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  youPulse: { position: 'absolute', width: 40, height: 40, borderRadius: 20 },
  youDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  youInner: { width: 10, height: 10, borderRadius: 5 },
});
