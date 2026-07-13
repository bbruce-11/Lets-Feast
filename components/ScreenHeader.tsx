import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

interface Props {
  title: string;
  onBack?: () => void;
}

export default function ScreenHeader({ title, onBack }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;

  const handleBack = () => {
    if (onBack) onBack();
    else if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/profile' as any);
  };

  return (
    <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={handleBack}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="arrow-back" size={24} color={colors.foreground} />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.backBtn} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', flex: 1, textAlign: 'center' },
});
