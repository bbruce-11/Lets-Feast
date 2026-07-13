import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { MapPressEvent, Marker, type Region } from 'react-native-maps';
import { AddressSearch } from '@/components/AddressSearch';
import { useColors } from '@/hooks/useColors';
import { PIN_PAD_CENTER, type GeoResult, type LatLng } from '@/lib/geo';

interface Props {
  value: LatLng | null;
  onChange: (coord: LatLng) => void;
  height?: number;
}

// Native pin picker backed by a real map. Search recenters the map and drops the
// pin; tapping the map or dragging the marker sets the precise coordinates.
export function AddressPicker({ value, onChange, height = 240 }: Props) {
  const colors = useColors();
  const mapRef = useRef<MapView>(null);
  const [region] = useState<Region>({
    latitude: value?.latitude ?? PIN_PAD_CENTER.latitude,
    longitude: value?.longitude ?? PIN_PAD_CENTER.longitude,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  const handlePress = (e: MapPressEvent) => {
    onChange(e.nativeEvent.coordinate);
  };

  const handleSearchSelect = (result: GeoResult) => {
    onChange(result.coord);
    mapRef.current?.animateToRegion(
      {
        latitude: result.coord.latitude,
        longitude: result.coord.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      400
    );
  };

  return (
    <View style={{ gap: 8 }}>
      <AddressSearch onSelect={handleSearchSelect} placeholder="Search an address…" />
      <View style={[styles.container, { height, borderColor: colors.border }]}>
        <MapView ref={mapRef} style={styles.map} initialRegion={region} onPress={handlePress}>
          {value && (
            <Marker
              coordinate={value}
              draggable
              onDragEnd={(e) => onChange(e.nativeEvent.coordinate)}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={styles.pin}>
                <Ionicons name="home" size={16} color="#fff" />
              </View>
            </Marker>
          )}
        </MapView>
      </View>
      {value ? (
        <Text style={[styles.coordText, { color: colors.mutedForeground }]}>
          Pin set · {value.latitude.toFixed(5)}, {value.longitude.toFixed(5)}
        </Text>
      ) : (
        <Text style={[styles.coordText, { color: colors.mutedForeground }]}>
          Search an address or tap the map to drop your delivery pin
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', borderRadius: 16, overflow: 'hidden', borderWidth: 1 },
  map: { flex: 1 },
  pin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  coordText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
});
