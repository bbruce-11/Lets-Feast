import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

export default function CartScreen() {
  const colors = useColors();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={{ color: colors.mutedForeground }}>Your cart is empty</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
