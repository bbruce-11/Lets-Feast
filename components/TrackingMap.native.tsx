import React, { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

export type LatLng = { latitude: number; longitude: number };

interface TrackingMapProps {
  waypoints: LatLng[];
  restaurantCoord: LatLng;
  destCoord: LatLng;
  driverCoord: LatLng | null;
  driverVisible: boolean;
}

export function TrackingMap({
  waypoints,
  restaurantCoord,
  destCoord,
  driverCoord,
  driverVisible,
}: TrackingMapProps) {
  const colors = useColors();
  const mapRef = useRef<MapView>(null);

  const latSpan = Math.abs(restaurantCoord.latitude - destCoord.latitude);
  const lngSpan = Math.abs(restaurantCoord.longitude - destCoord.longitude);
  const region = {
    latitude: (restaurantCoord.latitude + destCoord.latitude) / 2,
    longitude: (restaurantCoord.longitude + destCoord.longitude) / 2,
    latitudeDelta: Math.max(latSpan * 1.8, 0.02),
    longitudeDelta: Math.max(lngSpan * 1.8, 0.02),
  };

  const fitMarkers = useCallback(() => {
    const coords = [restaurantCoord, destCoord, ...(driverCoord ? [driverCoord] : [])];
    mapRef.current?.fitToCoordinates(coords, {
      edgePadding: { top: 48, right: 48, bottom: 48, left: 48 },
      animated: false,
    });
  }, [restaurantCoord, destCoord, driverCoord]);

  useEffect(() => {
    fitMarkers();
  }, [fitMarkers]);

  return (
    <View style={[styles.container, { borderColor: colors.border }]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={region}
        onMapReady={fitMarkers}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        <Polyline
          coordinates={waypoints}
          strokeColor={colors.primary}
          strokeWidth={3}
          lineDashPattern={[6, 4]}
        />
        <Marker coordinate={restaurantCoord} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={[styles.markerBubble, { backgroundColor: colors.primary }]}>
            <Ionicons name="restaurant" size={14} color="#fff" />
          </View>
        </Marker>
        <Marker coordinate={destCoord} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={[styles.markerBubble, { backgroundColor: '#22C55E' }]}>
            <Ionicons name="home" size={14} color="#fff" />
          </View>
        </Marker>
        {driverVisible && driverCoord && (
          <Marker coordinate={driverCoord} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.driverMarker}>
              <Ionicons name="bicycle" size={16} color="#fff" />
            </View>
          </Marker>
        )}
      </MapView>
      <View
        style={[
          styles.legend,
          { backgroundColor: colors.card + 'EE', borderColor: colors.border },
        ]}
      >
        <LegendRow color={colors.primary} label="Restaurant" />
        <LegendRow color="#22C55E" label="Your Door" />
        {driverVisible && <LegendRow color="#F97316" label="Driver" />}
      </View>
    </View>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  const colors = useColors();
  return (
    <View style={styles.legendRow}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={[styles.legendText, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', height: 220, borderRadius: 16, overflow: 'hidden', borderWidth: 1 },
  map: { flex: 1 },
  legend: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 4,
    borderWidth: 1,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  markerBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  driverMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 6,
  },
});
