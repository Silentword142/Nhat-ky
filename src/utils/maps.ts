export interface LatLng {
  lat: number;
  lng: number;
}

/** Only http(s) links are ever rendered as hrefs (blocks javascript:, data: ...). Adds https:// when missing. */
export const safeUrl = (raw?: string): string | null => {
  const s = (raw || '').trim();
  if (!s) return null;
  const withProto = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withProto);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
};

/** Google Maps "start navigation" deep link — needs no API key. Uses exact coordinates when known. */
export const directionsUrl = (target: { lat?: number; lng?: number; query?: string }): string | null => {
  const dest =
    typeof target.lat === 'number' && typeof target.lng === 'number'
      ? `${target.lat},${target.lng}`
      : target.query?.trim() || '';
  if (!dest) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=driving`;
};

export const viewOnMapUrl = (target: { lat?: number; lng?: number; query?: string }): string | null => {
  const q =
    typeof target.lat === 'number' && typeof target.lng === 'number'
      ? `${target.lat},${target.lng}`
      : target.query?.trim() || '';
  if (!q) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
};

/** Pull coordinates out of a pasted full Google Maps link (…/@10.77,106.69,17z or …?q=10.77,106.69). */
export const parseLatLngFromText = (text: string): LatLng | null => {
  const m =
    text.match(/@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/) ||
    text.match(/[?&](?:q|query|ll|destination)=(-?\d{1,2}\.\d+)(?:,|%2C)(-?\d{1,3}\.\d+)/i) ||
    text.match(/^\s*(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
};
