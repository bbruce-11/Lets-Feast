import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

export default function SearchScreen() {
  const colors = useColors();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={{ color: colors.mutedForeground }}>Search — coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
