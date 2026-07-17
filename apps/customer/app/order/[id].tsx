import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { getOrder, type ApiOrder } from '@/lib/api';
import { useOrderTracking } from '@/lib/ws';

// Matches ORDER_STATUS_FLOW in apps/api/src/common/order-status.util.ts exactly.
const STATUS_STEPS = [
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'driver_assigned', label: 'Driver assigned' },
  { key: 'on_the_way', label: 'On the way' },
  { key: 'delivered', label: 'Delivered' },
] as const;

export default function OrderTrackingScreen() {
  const colors = useColors();
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const id = idParam ? Number.parseInt(idParam, 10) : null;

  const [order, setOrder] = useState<ApiOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getOrder(id)
      .then(setOrder)
      .finally(() => setIsLoading(false));
  }, [id]);

  const tracking = useOrderTracking(
    id,
    order ? { id: order.id, status: order.status, driverProgress: order.driverProgress, etaMinutes: order.etaMinutes } : null,
    async () => {
      const fresh = await getOrder(id!);
      return { id: fresh.id, status: fresh.status, driverProgress: fresh.driverProgress, etaMinutes: fresh.etaMinutes };
    },
  );

  if (isLoading || !order) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const status = tracking?.status ?? order.status;
  const etaMinutes = tracking?.etaMinutes ?? order.etaMinutes;
  const isCancelled = status === 'cancelled';
  const currentStepIndex = STATUS_STEPS.findIndex((s) => s.key === status);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.iconCircle, { backgroundColor: isCancelled ? colors.destructive : colors.success }]}>
        <Ionicons name={isCancelled ? 'close' : 'checkmark'} size={40} color="#fff" />
      </View>

      <Text style={[styles.title, { color: colors.navy }]}>
        {isCancelled ? 'Order cancelled' : 'Order placed!'}
      </Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        {order.restaurantName ?? 'Your order'} · #{order.id}
      </Text>

      {!isCancelled && (
        <>
          {status !== 'delivered' && (
            <Text style={[styles.eta, { color: colors.foreground }]}>
              Estimated arrival: {etaMinutes} min
            </Text>
          )}

          <View style={styles.steps}>
            {STATUS_STEPS.map((step, i) => {
              const isDone = i <= currentStepIndex;
              return (
                <View key={step.key} style={styles.stepRow}>
                  <View
                    style={[
                      styles.stepDot,
                      { backgroundColor: isDone ? colors.primary : colors.muted },
                    ]}
                  >
                    {isDone && <Ionicons name="checkmark" size={12} color="#fff" />}
                  </View>
                  <Text
                    style={{
                      color: isDone ? colors.foreground : colors.mutedForeground,
                      fontWeight: isDone ? '600' : '400',
                    }}
                  >
                    {step.label}
                  </Text>
                  {i < STATUS_STEPS.length - 1 && (
                    <View
                      style={[
                        styles.stepLine,
                        { backgroundColor: i < currentStepIndex ? colors.primary : colors.muted },
                      ]}
                    />
                  )}
                </View>
              );
            })}
          </View>
        </>
      )}

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
  container: { flex: 1, alignItems: 'center', paddingHorizontal: 32, paddingTop: 80 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 14, marginTop: 6 },
  eta: { fontSize: 16, fontWeight: '600', marginTop: 20 },
  steps: { width: '100%', marginTop: 32, marginBottom: 40 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12, position: 'relative', paddingVertical: 10 },
  stepDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  stepLine: { position: 'absolute', left: 11, top: 34, width: 2, height: 24 },
  button: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', width: '100%', marginTop: 'auto', marginBottom: 40 },
});
