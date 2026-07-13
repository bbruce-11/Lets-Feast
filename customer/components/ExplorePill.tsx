import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useColors } from '@/hooks/useColors';

interface Props {
  label: string;
  selected: boolean;
  onPress: () => void;
}

export default function ExplorePill({ label, selected, onPress }: Props) {
  const colors = useColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.pill,
        {
          backgroundColor: selected ? colors.primary : colors.card,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          { color: selected ? colors.primaryForeground : colors.primary },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
  },
  text: { fontSize: 15, fontFamily: 'Inter_500Medium' },
});
