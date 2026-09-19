import { LatLng } from '../utils/maps';

/**
 * Routing + geocoding on free OpenStreetMap services (no API key, works from GitHub Pages):
 *  - routing.openstreetmap.de (OSRM) for real road distance, geometry and travel time
 *  - Nominatim for turning a typed place name into coordinates
 * If a service is unreachable we fall back to a straight-line estimate and flag it as approximate.
 */

export type Vehicle = 'walk' | 'bike' | 'moto' | 'car';

export const VEHICLES: Record<Vehicle, { label: string; emoji: string; profile: string; fallbackKmh: number; googleMode: string }> = {
  walk: { label: 'Đi bộ', emoji: '🚶', profile: 'routed-foot', fallbackKmh: 5, googleMode: 'walking' },
  bike: { label: 'Xe đạp', emoji: '🚲', profile: 'routed-bike', fallbackKmh: 15, googleMode: 'bicycling' },
  moto: { label: 'Xe máy', emoji: '🛵', profile: 'routed-car', fallbackKmh: 30, googleMode: 'two-wheeler' },
  car: { label: 'Ô tô', emoji: '🚗', profile: 'routed-car', fallbackKmh: 35, googleMode: 'driving' },
};

export interface Leg {
  km: number;
  minutes: number;
  geometry: [number, number][]; // [lat, lng]
  estimated: boolean; // true = straight-line fallback, not a real road route
}

const haversineKm = (a: LatLng, b: LatLng): number => {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

const fallbackLeg = (a: LatLng, b: LatLng, v: Vehicle): Leg => {
  const km = haversineKm(a, b) * 1.3; // roads are rarely straight
  return { km, minutes: (km / VEHICLES[v].fallbackKmh) * 60, geometry: [[a.lat, a.lng], [b.lat, b.lng]], estimated: true };
};

const legCache = new Map<string, Promise<Leg>>();

export const getLeg = (a: LatLng, b: LatLng, v: Vehicle): Promise<Leg> => {
  const key = `${v}|${a.lat.toFixed(5)},${a.lng.toFixed(5)}|${b.lat.toFixed(5)},${b.lng.toFixed(5)}`;
  const cached = legCache.get(key);
  if (cached) return cached;

  const promise = (async (): Promise<Leg> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    try {
      const url = `https://routing.openstreetmap.de/${VEHICLES[v].profile}/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`;
      const res = await fetch(url, { signal: controller.signal });
      const data = await res.json();
      const route = data?.routes?.[0];
      if (!route) throw new Error('no route');
      const km = route.distance / 1000;
      // Motorbike shares the car road network; city riding averages ~30 km/h regardless of the car's free-flow time.
      const minutes = v === 'moto' ? (km / VEHICLES.moto.fallbackKmh) * 60 : route.duration / 60;
      const geometry: [number, number][] = (route.geometry.coordinates as [number, number][]).map(([lng, lat]) => [lat, lng]);
      return { km, minutes, geometry, estimated: false };
    } finally {
      clearTimeout(timer);
    }
  })().catch(() => {
    legCache.delete(key); // allow a retry next time instead of pinning the failure
    return fallbackLeg(a, b, v);
  });

  legCache.set(key, promise);
  return promise;
};

export const formatKm = (km: number): string => `${km < 10 ? km.toFixed(1) : Math.round(km)} km`.replace('.', ',');

export const formatMinutes = (min: number): string => {
  const m = Math.max(1, Math.round(min));
  if (m < 60) return `${m} phút`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} giờ ${rest} phút` : `${h} giờ`;
};

/* ---------- geocoding (typed place name -> coordinates), cached in this browser ---------- */

const GEO_CACHE_KEY = 'lovesync_geocode_cache_v1';

const readGeoCache = (): Record<string, LatLng | null> => {
  try {
    return JSON.parse(localStorage.getItem(GEO_CACHE_KEY) || '{}');
  } catch {
    return {};
  }
};

export const looksLikeUrl = (s: string) => /^(https?:\/\/|www\.)/i.test(s.trim());

export const getCachedGeocode = (query: string): LatLng | null | undefined => {
  const cache = readGeoCache();
  return query in cache ? cache[query] : undefined;
};

let lastNominatimCall = 0;

export const geocodePlace = async (query: string): Promise<LatLng | null> => {
  const cached = getCachedGeocode(query);
  if (cached !== undefined) return cached;

  // Nominatim's usage policy allows ~1 request/second.
  const wait = Math.max(0, lastNominatimCall + 1100 - Date.now());
  if (wait) await new Promise((r) => setTimeout(r, wait));
  lastNominatimCall = Date.now();

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=vi&q=${encodeURIComponent(query)}`);
    const data = await res.json();
    const hit: LatLng | null = data?.[0] ? { lat: Number(data[0].lat), lng: Number(data[0].lon) } : null;
    try {
      const cache = readGeoCache();
      cache[query] = hit;
      localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(cache));
    } catch {
      // cache is best-effort
    }
    return hit;
  } catch {
    return null; // network error: don't cache, try again next time
  }
};
