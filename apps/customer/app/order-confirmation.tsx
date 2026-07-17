import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

export default function OrderConfirmationScreen() {
  const colors = useColors();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.iconCircle, { backgroundColor: colors.success }]}>
        <Ionicons name="checkmark" size={40} color={colors.successForeground} />
      </View>
      <Text style={[styles.title, { color: colors.navy }]}>Order placed!</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Order #{orderId} is on its way to the restaurant.
      </Text>
      {/* Live order tracking isn't built yet - apps/api already has a
          WebSocket gateway for this, nothing on the client consumes it. */}
      <TouchableOpacity
        onPress={() => router.replace('/(tabs)')}
        style={[styles.button, { backgroundColor: colors.primary }]}
      >
        <Text style={{ color: colors.primaryForeground, fontWeight: '700', fontSize: 16 }}>
          Back to Home
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 15, textAlign: 'center', marginTop: 8, marginBottom: 32 },
  button: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', width: '100%' },
});
