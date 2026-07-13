import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AddressSearch } from '@/components/AddressSearch';
import { useColors } from '@/hooks/useColors';
import { PIN_PAD_CENTER, type GeoResult, type LatLng } from '@/lib/geo';

interface Props {
  value: LatLng | null;
  onChange: (coord: LatLng) => void;
  height?: number;
}

const LEAFLET_VERSION = '1.9.4';
const LEAFLET_CSS = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`;
const LEAFLET_JS = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`;

// Loads Leaflet from CDN exactly once and resolves with the global L. Leaflet is
// browser-only, so this file (the web/default picker) keeps it out of the native
// bundle, which uses AddressPicker.native.tsx with react-native-maps instead.
let leafletPromise: Promise<any> | null = null;
function loadLeaflet(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if ((window as any).L) return Promise.resolve((window as any).L);
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[data-leaflet]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = LEAFLET_CSS;
      link.setAttribute('data-leaflet', 'true');
      document.head.appendChild(link);
    }
    const existing = document.querySelector<HTMLScriptElement>('script[data-leaflet]');
    if (existing) {
      existing.addEventListener('load', () => resolve((window as any).L));
      existing.addEventListener('error', () => reject(new Error('Leaflet failed to load')));
      return;
    }
    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.async = true;
    script.setAttribute('data-leaflet', 'true');
    script.addEventListener('load', () => resolve((window as any).L));
    script.addEventListener('error', () => reject(new Error('Leaflet failed to load')));
    document.head.appendChild(script);
  });
  return leafletPromise;
}

const PIN_HTML = `
  <div style="position:relative;width:32px;height:40px;transform:translate(-16px,-38px)">
    <div style="width:32px;height:32px;border-radius:16px;background:#22C55E;border:2px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 8px rgba(0,0,0,0.25)">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M12 3l9 8h-3v9h-4v-6h-4v6H6v-9H3z"/></svg>
    </div>
    <div style="position:absolute;left:50%;bottom:-6px;margin-left:-6px;width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid #22C55E"></div>
  </div>`;

// Web pin picker backed by a real interactive OpenStreetMap (Leaflet). Users can
// search an address (recenters + drops the pin) or tap/drag directly on the map.
export function AddressPicker({ value, onChange, height = 240 }: Props) {
  const colors = useColors();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  onChangeRef.current = onChange;
  valueRef.current = value;

  const placeMarker = (coord: LatLng) => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    if (markerRef.current) {
      markerRef.current.setLatLng([coord.latitude, coord.longitude]);
    } else {
      const icon = L.divIcon({ html: PIN_HTML, className: '', iconSize: [0, 0] });
      const marker = L.marker([coord.latitude, coord.longitude], { icon, draggable: true });
      marker.on('dragend', () => {
        const ll = marker.getLatLng();
        onChangeRef.current({ latitude: ll.lat, longitude: ll.lng });
      });
      marker.addTo(map);
      markerRef.current = marker;
    }
  };

  // Initialize the Leaflet map once the container is mounted.
  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        LRef.current = L;
        const start = valueRef.current ?? PIN_PAD_CENTER;
        const map = L.map(containerRef.current, {
          center: [start.latitude, start.longitude],
          zoom: valueRef.current ? 15 : 12,
          zoomControl: true,
          attributionControl: true,
        });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map);
        map.on('click', (e: any) => {
          const coord = { latitude: e.latlng.lat, longitude: e.latlng.lng };
          placeMarker(coord);
          onChangeRef.current(coord);
        });
        mapRef.current = map;
        if (valueRef.current) placeMarker(valueRef.current);
        setReady(true);
        // Map sometimes mounts before layout settles; nudge it to recompute size.
        setTimeout(() => map.invalidateSize(), 60);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  // Keep the marker in sync when the value changes from outside (e.g. opening the
  // editor for an existing address).
  useEffect(() => {
    if (!ready) return;
    if (value) placeMarker(value);
    else if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
  }, [value, ready]);

  const handleSearchSelect = (result: GeoResult) => {
    placeMarker(result.coord);
    onChange(result.coord);
    const map = mapRef.current;
    if (map) map.setView([result.coord.latitude, result.coord.longitude], 16);
  };

  return (
    <View style={{ gap: 8 }}>
      <AddressSearch onSelect={handleSearchSelect} placeholder="Search an address…" />

      {failed ? (
        <View style={[styles.fallback, { height, borderColor: colors.border, backgroundColor: colors.muted }]}>
          <Text style={[styles.fallbackText, { color: colors.mutedForeground }]}>
            Map could not load. Search an address above to set your pin.
          </Text>
        </View>
      ) : (
        <View style={[styles.mapShell, { height, borderColor: colors.border }]}>
          {/* Raw DOM node Leaflet renders into (web-only file). */}
          <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
          {!ready && (
            <View style={[styles.loading, { backgroundColor: colors.muted }]}>
              <Text style={[styles.fallbackText, { color: colors.mutedForeground }]}>Loading map…</Text>
            </View>
          )}
        </View>
      )}

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
  mapShell: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    zIndex: 1,
  },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  fallback: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  fallbackText: { fontSize: 13, fontFamily: 'Inter_500Medium', textAlign: 'center' },
  coordText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
});
