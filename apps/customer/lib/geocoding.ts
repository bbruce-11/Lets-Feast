export interface GeocodeResult {
  displayName: string;
  lat: number;
  lng: number;
}

/**
 * Nominatim (OpenStreetMap) geocoding - free, no API key. Their usage policy
 * asks for a descriptive User-Agent and no more than ~1 request/second;
 * callers should debounce (the AddressPicker component does, ~500ms). For
 * production volume beyond a pilot, this should move behind a small backend
 * proxy rather than calling Nominatim directly from the client - flagging
 * that now rather than after it becomes a real rate-limit problem.
 */
export async function searchAddress(query: string): Promise<GeocodeResult[]> {
  if (query.trim().length < 3) return [];

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'FeastCustomerApp/1.0 (pilot)' },
  });
  if (!res.ok) return [];

  const rows = (await res.json()) as Array<{ display_name: string; lat: string; lon: string }>;
  return rows.map((row) => ({
    displayName: row.display_name,
    lat: Number.parseFloat(row.lat),
    lng: Number.parseFloat(row.lon),
  }));
}
