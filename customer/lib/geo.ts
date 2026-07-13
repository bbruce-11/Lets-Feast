export type LatLng = { latitude: number; longitude: number };

// Fallback restaurant location (Chicago Loop) used when a restaurant has no
// stored coordinates.
export const DEFAULT_RESTAURANT_COORD: LatLng = {
  latitude: 41.8781,
  longitude: -87.6298,
};

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}

// Deterministically derive a delivery destination near the restaurant from the
// address text entered at checkout. The same address always maps to the same
// point (roughly 1–2.5 km from the restaurant), so the tracking map reflects
// where the order is going without requiring a geocoding service.
export function deriveDestination(address: string, restaurant: LatLng): LatLng {
  const key = (address ?? '').trim().toLowerCase();
  if (!key) {
    return {
      latitude: restaurant.latitude - 0.016,
      longitude: restaurant.longitude + 0.011,
    };
  }
  const h = hashString(key);
  const angle = (Math.abs(h) % 360) * (Math.PI / 180);
  const distance = 0.011 + ((Math.abs(h >> 9) % 100) / 100) * 0.012;
  return {
    latitude: restaurant.latitude + Math.sin(angle) * distance,
    longitude: restaurant.longitude + Math.cos(angle) * distance,
  };
}

// Default center for the address pin map (Chicago Loop) used before the user has
// dropped a pin or searched for an address.
export const PIN_PAD_CENTER: LatLng = DEFAULT_RESTAURANT_COORD;

// A geocoded address match returned by the search box.
export type GeoResult = {
  // Human-readable address (e.g. "233 S Wacker Dr, Chicago, IL").
  label: string;
  coord: LatLng;
};

// Geocode a free-text address into candidate coordinates using OpenStreetMap's
// Nominatim service (no API key required). Returns up to `limit` matches ordered
// by relevance. Throws on network/HTTP errors so callers can surface a message.
export async function geocodeAddress(
  query: string,
  opts: { signal?: AbortSignal; limit?: number } = {}
): Promise<GeoResult[]> {
  const q = query.trim();
  if (!q) return [];
  const params = new URLSearchParams({
    q,
    format: 'jsonv2',
    addressdetails: '0',
    limit: String(opts.limit ?? 5),
  });
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
    { signal: opts.signal, headers: { Accept: 'application/json' } }
  );
  if (!res.ok) {
    throw new Error(`Address search failed (${res.status})`);
  }
  const data = (await res.json()) as Array<{
    display_name: string;
    lat: string;
    lon: string;
  }>;
  return data
    .map((d) => ({
      label: d.display_name,
      coord: { latitude: parseFloat(d.lat), longitude: parseFloat(d.lon) },
    }))
    .filter((r) => Number.isFinite(r.coord.latitude) && Number.isFinite(r.coord.longitude));
}

// Build a lightly curved set of waypoints between two points for the driver to
// follow on the map.
export function buildWaypoints(from: LatLng, to: LatLng, segments = 3): LatLng[] {
  const pts: LatLng[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const curve = Math.sin(t * Math.PI) * 0.0022;
    pts.push({
      latitude: from.latitude + (to.latitude - from.latitude) * t + curve,
      longitude: from.longitude + (to.longitude - from.longitude) * t,
    });
  }
  return pts;
}
