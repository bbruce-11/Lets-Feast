import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

export type LatLng = { latitude: number; longitude: number };

interface TrackingMapProps {
  waypoints: LatLng[];
  restaurantCoord: LatLng;
  destCoord: LatLng;
  driverCoord: LatLng | null;
  driverVisible: boolean;
}

export function TrackingMap({ driverVisible }: TrackingMapProps) {
  const colors = useColors();
  return (
    <View style={[styles.container, { backgroundColor: colors.muted, borderColor: colors.border }]}>
      <Ionicons name="map" size={32} color={colors.mutedForeground} />
      <Text style={[styles.label, { color: colors.mutedForeground }]}>
        {driverVisible ? 'Driver en route…' : 'Awaiting driver…'}
      </Text>
      <Text style={[styles.sub, { color: colors.mutedForeground }]}>
        Live map available on iOS &amp; Android
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  sub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
});
