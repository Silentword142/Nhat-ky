import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, MapPinOff, ExternalLink } from 'lucide-react';
import type * as LeafletNS from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { PlanStop } from '../types';
import { LatLng } from '../utils/maps';
import { PlacePickButton } from './PlaceTools';
import { Leg, Vehicle, VEHICLES, formatKm, formatMinutes, geocodePlace, getCachedGeocode, getLeg, looksLikeUrl } from '../services/routing';

interface Props {
  /** The selected day's stops, already in visiting order. Index + 1 is the number shown on the map. */
  stops: PlanStop[];
  days: number[];
  day: number;
  dateLabel: string;
  destination?: string;
  onDayChange: (day: number) => void;
  onPinStop: (stopId: string, coords: LatLng) => void;
}

interface Point {
  stop: PlanStop;
  number: number;
  pos: LatLng;
  approx: boolean; // located from the place NAME (auto), not from an exact pin
}

const VEHICLE_KEY = 'lovesync_plan_vehicle';
const ROUTE_COLOR = '#f43f5e';

const readVehicle = (): Vehicle => {
  try {
    const v = localStorage.getItem(VEHICLE_KEY) as Vehicle | null;
    if (v && v in VEHICLES) return v;
  } catch {
    // ignore
  }
  return 'moto';
};

const el = (tag: string, css: string, text?: string) => {
  const e = document.createElement(tag);
  e.style.cssText = css;
  if (text !== undefined) e.textContent = text; // textContent, never innerHTML: titles come from the partner too
  return e;
};

const PlanDayMap: React.FC<Props> = ({ stops, days, day, dateLabel, destination, onDayChange, onPinStop }) => {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletNS.Map | null>(null);
  const layerRef = useRef<LeafletNS.LayerGroup | null>(null);
  const leafletRef = useRef<typeof LeafletNS | null>(null);

  const [ready, setReady] = useState(false);
  const [vehicle, setVehicle] = useState<Vehicle>(readVehicle);
  // keyed by the searched text (not stop id) so switching a stop's option never reuses the old option's position
  const [geo, setGeo] = useState<Record<string, LatLng>>({});
  const [legs, setLegs] = useState<(Leg | null)[]>([]);
  const [loadingLegs, setLoadingLegs] = useState(false);
  const [fitTick, setFitTick] = useState(0);

  const pickVehicle = (v: Vehicle) => {
    setVehicle(v);
    try {
      localStorage.setItem(VEHICLE_KEY, v);
    } catch {
      // ignore
    }
  };

  const queryFor = (s: PlanStop) => {
    const place = (s.place || '').trim();
    if (!place || looksLikeUrl(place)) return '';
    return destination && !place.toLowerCase().includes(destination.toLowerCase()) ? `${place}, ${destination}` : place;
  };

  // Stops that have no exact pin but do have a place name get located automatically.
  const geoSignature = stops.map((s) => `${s.id}:${typeof s.lat === 'number' ? 'p' : queryFor(s)}`).join('|');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const s of stops) {
        if (typeof s.lat === 'number' && typeof s.lng === 'number') continue;
        const q = queryFor(s);
        if (!q) continue;
        const cached = getCachedGeocode(q);
        const hit = cached !== undefined ? cached : await geocodePlace(q);
        if (cancelled) return;
        if (hit) setGeo((prev) => (prev[q]?.lat === hit.lat && prev[q]?.lng === hit.lng ? prev : { ...prev, [q]: hit }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoSignature]);

  const points: Point[] = useMemo(() => {
    const out: Point[] = [];
    stops.forEach((s, i) => {
      if (typeof s.lat === 'number' && typeof s.lng === 'number') out.push({ stop: s, number: i + 1, pos: { lat: s.lat, lng: s.lng }, approx: false });
      else {
        const q = queryFor(s);
        if (q && geo[q]) out.push({ stop: s, number: i + 1, pos: geo[q], approx: true });
      }
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops, geo]);

  const unlocated = stops.filter((s) => !points.some((p) => p.stop.id === s.id));

  // Real road distance + time between consecutive stops for the chosen vehicle.
  const pointSignature = points.map((p) => `${p.stop.id}@${p.pos.lat},${p.pos.lng}`).join('|');
  useEffect(() => {
    let cancelled = false;
    if (points.length < 2) {
      setLegs([]);
      setLoadingLegs(false);
      return;
    }
    setLoadingLegs(true);
    Promise.all(points.slice(0, -1).map((p, i) => getLeg(p.pos, points[i + 1].pos, vehicle))).then((result) => {
      if (cancelled) return;
      setLegs(result);
      setLoadingLegs(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointSignature, vehicle]);

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    let resizeObs: ResizeObserver | null = null;
    (async () => {
      const mod = await import('leaflet');
      const L = ((mod as unknown as { default?: typeof LeafletNS }).default ?? mod) as typeof LeafletNS;
      if (cancelled || !mapEl.current || mapRef.current) return;
      leafletRef.current = L;
      const map = L.map(mapEl.current, { zoomControl: true }).setView([16.05, 106.3], 5);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      setReady(true);
      setTimeout(() => map.invalidateSize(), 250);
      // The container can be 0-wide while a modal animates in or a tab is hidden; fitting then picks a
      // wrong zoom. Re-measure and re-fit as soon as it gets a real size.
      if (typeof ResizeObserver !== 'undefined') {
        resizeObs = new ResizeObserver(() => {
          if (mapEl.current && mapEl.current.clientWidth > 0) {
            map.invalidateSize();
            setFitTick((t) => t + 1);
          }
        });
        resizeObs.observe(mapEl.current);
      }
    })();
    return () => {
      cancelled = true;
      resizeObs?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // Draw pins, route lines and distance labels whenever anything changes.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!ready || !L || !map || !layer) return;
    layer.clearLayers();
    const bounds: [number, number][] = [];

    legs.forEach((leg, i) => {
      if (!leg) return;
      L.polyline(leg.geometry, {
        color: ROUTE_COLOR,
        weight: 5,
        opacity: 0.85,
        dashArray: leg.estimated ? '2 10' : undefined,
        lineCap: 'round',
      }).addTo(layer);
      leg.geometry.forEach((g) => bounds.push(g));

      const mid = leg.geometry[Math.floor(leg.geometry.length / 2)];
      const label = el(
        'div',
        'transform:translate(-50%,-50%);white-space:nowrap;padding:3px 9px;border-radius:999px;background:#fff;border:2px solid #f43f5e;color:#be123c;font:700 11px/1.2 system-ui,sans-serif;box-shadow:0 2px 6px rgba(0,0,0,.25)',
        `${VEHICLES[vehicle].emoji} ${formatKm(leg.km)} · ${formatMinutes(leg.minutes)}${leg.estimated ? ' ≈' : ''}`
      );
      L.marker(mid, { icon: L.divIcon({ className: '', html: label, iconSize: [0, 0] }), interactive: false, zIndexOffset: 500 }).addTo(layer);
    });

    points.forEach((p) => {
      const wrap = el('div', 'transform:translate(-14px,-14px);display:flex;align-items:center;gap:6px;white-space:nowrap');
      wrap.appendChild(
        el(
          'div',
          `width:28px;height:28px;border-radius:50%;background:${p.approx ? '#fb923c' : '#e11d48'};color:#fff;border:3px solid #fff;display:flex;align-items:center;justify-content:center;font:800 13px/1 system-ui,sans-serif;box-shadow:0 2px 6px rgba(0,0,0,.4);flex:none`,
          String(p.number)
        )
      );
      const name = p.stop.title.length > 24 ? `${p.stop.title.slice(0, 23)}…` : p.stop.title;
      const tag = el('div', 'padding:2px 8px;border-radius:8px;background:rgba(255,255,255,.95);color:#27272a;font:700 11px/1.25 system-ui,sans-serif;box-shadow:0 1px 4px rgba(0,0,0,.3)', name);
      if (p.stop.place && !looksLikeUrl(p.stop.place)) {
        const placeName = p.stop.place.length > 26 ? `${p.stop.place.slice(0, 25)}…` : p.stop.place;
        tag.appendChild(el('div', 'font-weight:600;font-size:10px;color:#71717a', placeName));
      }
      wrap.appendChild(tag);

      const popup = el('div', 'font:13px/1.4 system-ui,sans-serif;min-width:140px');
      popup.appendChild(el('div', 'font-weight:800', `${p.number}. ${p.stop.title}`));
      if (p.stop.place) popup.appendChild(el('div', 'color:#52525b', p.stop.place));
      if (p.stop.time) popup.appendChild(el('div', 'color:#71717a', `🕒 ${p.stop.time}`));
      if (p.approx) popup.appendChild(el('div', 'color:#c2410c;margin-top:4px;font-size:11px', 'Vị trí tự tìm theo tên — hãy ghim chính xác nếu lệch.'));

      L.marker([p.pos.lat, p.pos.lng], { icon: L.divIcon({ className: '', html: wrap, iconSize: [0, 0] }), zIndexOffset: 1000 })
        .bindPopup(popup)
        .addTo(layer);
      bounds.push([p.pos.lat, p.pos.lng]);
    });

    map.invalidateSize(); // container may have just been laid out (modal animation) — measure before fitting
    // No animation: re-fitting on every edit should just snap, and it can't get stuck mid-transition.
    if (bounds.length === 1) map.setView(bounds[0], 15, { animate: false });
    else if (bounds.length > 1) map.fitBounds(bounds, { padding: [48, 48], maxZoom: 16, animate: false });
  }, [ready, points, legs, vehicle, fitTick]);

  const totalKm = legs.reduce((s, l) => s + (l?.km || 0), 0);
  const totalMin = legs.reduce((s, l) => s + (l?.minutes || 0), 0);
  const anyEstimated = legs.some((l) => l?.estimated);

  // Whole day as one Google Maps route (Maps URLs take up to 9 waypoints).
  const googleDayUrl = useMemo(() => {
    if (points.length < 2) return null;
    const pts = points.slice(0, 10);
    const f = (p: Point) => `${p.pos.lat},${p.pos.lng}`;
    const params = new URLSearchParams({
      api: '1',
      origin: f(pts[0]),
      destination: f(pts[pts.length - 1]),
      travelmode: VEHICLES[vehicle].googleMode,
    });
    if (pts.length > 2) params.set('waypoints', pts.slice(1, -1).map(f).join('|'));
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }, [points, vehicle]);

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden bg-white dark:bg-zinc-900 flex flex-col">
      {/* Day switcher */}
      <div className="flex items-center gap-1.5 px-3 pt-3 overflow-x-auto">
        {days.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onDayChange(d)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap transition ${
              d === day ? 'bg-gradient-to-r from-[#FF758F] to-[#FF9A9E] text-white shadow' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-rose-500'
            }`}
          >
            Ngày {d}
          </button>
        ))}
        <span className="ml-auto pl-2 text-[11px] text-zinc-400 whitespace-nowrap">{dateLabel}</span>
      </div>

      {/* Vehicle */}
      <div className="flex items-center gap-1 px-3 py-2">
        {(Object.keys(VEHICLES) as Vehicle[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => pickVehicle(v)}
            className={`flex-1 px-2 py-1.5 rounded-xl text-[11px] font-bold transition border ${
              vehicle === v ? 'border-rose-400 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300' : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400'
            }`}
          >
            <span className="mr-1">{VEHICLES[v].emoji}</span>
            {VEHICLES[v].label}
          </button>
        ))}
      </div>

      {/* Map */}
      <div className="relative h-[320px] lg:h-[420px]">
        <div ref={mapEl} className="absolute inset-0" style={{ zIndex: 0 }} />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-400 gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Đang tải bản đồ...
          </div>
        )}
        {ready && points.length === 0 && (
          <div className="absolute inset-x-4 top-4 z-[500] rounded-xl bg-white/95 dark:bg-zinc-900/95 shadow px-3 py-2 text-xs text-zinc-600 dark:text-zinc-300 text-center">
            {stops.length === 0 ? `Ngày ${day} chưa có hoạt động nào.` : 'Nhập địa điểm hoặc ghim vị trí cho hoạt động để hiện lên bản đồ.'}
          </div>
        )}
        {loadingLegs && (
          <div className="absolute bottom-3 left-3 z-[500] rounded-full bg-white/95 dark:bg-zinc-900/95 shadow px-3 py-1 text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" /> Đang tính đường đi...
          </div>
        )}
      </div>

      {/* Route summary */}
      <div className="p-3 space-y-2.5">
        {legs.length > 0 && (
          <>
            <ul className="space-y-1">
              {legs.map((leg, i) =>
                leg ? (
                  <li key={i} className="flex items-center justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate text-zinc-600 dark:text-zinc-300">
                      <b className="text-rose-500">{points[i].number}</b> {points[i].stop.title} <span className="text-zinc-400">→</span> <b className="text-rose-500">{points[i + 1].number}</b>{' '}
                      {points[i + 1].stop.title}
                    </span>
                    <span className="shrink-0 font-bold text-zinc-800 dark:text-zinc-100 tabular-nums">
                      {formatKm(leg.km)} · {formatMinutes(leg.minutes)}
                    </span>
                  </li>
                ) : null
              )}
            </ul>
            <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs">
              <span className="font-bold text-zinc-500 dark:text-zinc-400">Tổng ngày {day}</span>
              <span className="font-extrabold text-rose-600 dark:text-rose-400 tabular-nums">
                {formatKm(totalKm)} · {formatMinutes(totalMin)}
              </span>
            </div>
            {anyEstimated && <p className="text-[11px] text-amber-600 dark:text-amber-400">≈ Một số đoạn chưa tính được đường thật nên đang ước tính theo đường chim bay.</p>}
          </>
        )}

        {googleDayUrl && (
          <a
            href={googleDayUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Mở cả ngày {day} trên Google Maps
          </a>
        )}

        {points.some((p) => p.approx) && (
          <p className="text-[11px] text-orange-600 dark:text-orange-400">🟠 Ghim màu cam được tự tìm theo tên địa điểm; bấm "Bản đồ" ở hoạt động để ghim chính xác.</p>
        )}

        {unlocated.length > 0 && (
          <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/60 p-2.5 space-y-1.5">
            <p className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
              <MapPinOff className="w-3.5 h-3.5" /> Chưa có vị trí trên bản đồ
            </p>
            {unlocated.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2">
                <span className="text-xs text-zinc-700 dark:text-zinc-200 truncate">
                  <b className="text-rose-500">{stops.indexOf(s) + 1}</b> {s.title}
                </span>
                <PlacePickButton compact query={s.place || s.title} onPick={(p) => onPinStop(s.id, { lat: p.lat, lng: p.lng })} className="!py-1" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PlanDayMap;
