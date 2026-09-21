import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, MapPinOff, ExternalLink, LocateFixed, KeyRound, Maximize2, X } from 'lucide-react';
import { PlanStop } from '../types';
import { LatLng } from '../utils/maps';
import { PlacePickButton } from './PlaceTools';
import { MapAdapter, ME_COLOR, legColor, useMapAdapter } from './mapEngines';
import { getBuildTimeGoogleMapsKey } from '../services/googleMaps';
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

/** Shows which map is active and lets the user paste a Google Maps API key. */
const MapEngineBar: React.FC<{ engine: 'google' | 'osm'; notice: string; keyValue: string; onSaveKey: (k: string) => void }> = ({ engine, notice, keyValue, onSaveKey }) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const fromBuild = !!getBuildTimeGoogleMapsKey();

  if (engine === 'google') {
    return (
      <div className="px-3 pb-2 flex items-center justify-between text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
        <span>✅ Đang dùng Google Maps</span>
        {!fromBuild && keyValue && (
          <button type="button" onClick={() => onSaveKey('')} className="text-zinc-400 hover:text-red-500 font-semibold">
            Gỡ API key
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mx-3 mb-2 rounded-xl bg-amber-50 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-900/50 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-300">
      {notice && <p className="font-semibold text-red-600 dark:text-red-400 mb-1">{notice}</p>}
      <div className="flex items-center justify-between gap-2">
        <span>Đang dùng bản đồ OpenStreetMap (miễn phí).</span>
        <button type="button" onClick={() => setOpen((o) => !o)} className="shrink-0 font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
          <KeyRound className="w-3 h-3" /> Dùng Google Maps
        </button>
      </div>
      {open && (
        <div className="mt-2 space-y-1.5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim()) onSaveKey(draft);
            }}
            className="flex gap-1.5"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Dán Google Maps API key (AIza...)"
              className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-800 border border-amber-200 dark:border-zinc-700 text-xs text-zinc-800 dark:text-zinc-100"
            />
            <button type="submit" disabled={!draft.trim()} className="px-3 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white font-bold">
              Lưu
            </button>
          </form>
          <p className="text-amber-700/80 dark:text-amber-300/80 leading-relaxed">
            Tạo key trong Google Cloud Console → bật <b>Maps JavaScript API</b> → Credentials → Create API key. Nên giới hạn key theo tên miền web của bạn. Key chỉ lưu trên trình duyệt này; để cả hai người cùng dùng, đặt secret <code>GOOGLE_MAPS_API_KEY</code> trên GitHub.
          </p>
        </div>
      )}
    </div>
  );
};

const PlanDayMap: React.FC<Props> = ({ stops, days, day, dateLabel, destination, onDayChange, onPinStop }) => {
  const { setContainer, adapter, engine, notice, key: mapKey, saveKey } = useMapAdapter();
  const elRef = useRef<HTMLDivElement | null>(null);
  const attachContainer = useCallback(
    (node: HTMLDivElement | null) => {
      elRef.current = node;
      setContainer(node);
    },
    [setContainer]
  );

  const [vehicle, setVehicle] = useState<Vehicle>(readVehicle);
  // keyed by the searched text (not stop id) so switching a stop's option never reuses the old option's position
  const [geo, setGeo] = useState<Record<string, LatLng>>({});
  const [legs, setLegs] = useState<(Leg | null)[]>([]);
  const [loadingLegs, setLoadingLegs] = useState(false);

  // "My location" on the map
  const [showMe, setShowMe] = useState(false);
  const [me, setMe] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [meMsg, setMeMsg] = useState('');
  const meRef = useRef(me);
  meRef.current = me;
  // Rounded to ~11 m so a walking GPS jitter doesn't re-route and re-draw on every tick.
  const meKey = showMe && me ? `${me.lat.toFixed(4)},${me.lng.toFixed(4)}` : '';
  const meAnchor = useMemo<LatLng | null>(() => {
    if (!meKey) return null;
    const [lat, lng] = meKey.split(',').map(Number);
    return { lat, lng };
  }, [meKey]);
  const [meLeg, setMeLeg] = useState<Leg | null>(null);

  // Framing the whole day is a one-off: it happens when the map (or the day) opens and when the user asks for it.
  // After that the zoom and pan belong to the user — nothing re-frames the map behind their back.
  const viewRef = useRef<LatLng[]>([]);
  const fittedRef = useRef<{ adapter: MapAdapter | null; day: number }>({ adapter: null, day: -1 });
  const wantMeFitRef = useRef(false);
  const dayRef = useRef(day);
  dayRef.current = day;

  const fitAll = useCallback(() => {
    // A container that is still 0-wide (tab hidden, modal animating in) would fit at a nonsense zoom.
    if (!adapter || viewRef.current.length === 0 || (elRef.current?.clientWidth ?? 0) === 0) return false;
    adapter.fit(viewRef.current);
    return true;
  }, [adapter]);

  const fitDayOnce = useCallback(() => {
    if (fittedRef.current.adapter === adapter && fittedRef.current.day === dayRef.current) return;
    if (fitAll()) fittedRef.current = { adapter, day: dayRef.current };
  }, [adapter, fitAll]);

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

  // Live location -> stop 1, so "my location" joins the route instead of floating next to it.
  useEffect(() => {
    let cancelled = false;
    const first = points[0]?.pos;
    if (!meAnchor || !first) {
      setMeLeg(null);
      return;
    }
    getLeg(meAnchor, first, vehicle).then((leg) => {
      if (!cancelled) setMeLeg(leg);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meAnchor, pointSignature, vehicle]);

  // The container can be 0-wide while a modal animates in or a tab is hidden. Re-measure when it gets a real
  // size, and run the opening fit then if it could not run earlier. A later resize never re-frames the map.
  useEffect(() => {
    const node = elRef.current;
    if (!adapter || !node || typeof ResizeObserver === 'undefined') return;
    const obs = new ResizeObserver(() => {
      if (node.clientWidth <= 0) return;
      adapter.resize();
      fitDayOnce();
    });
    obs.observe(node);
    return () => obs.disconnect();
  }, [adapter, fitDayOnce]);

  // Live location (blue dot).
  useEffect(() => {
    if (!showMe) {
      setMe(null);
      return;
    }
    if (!navigator.geolocation) {
      setMeMsg('Trình duyệt không hỗ trợ định vị.');
      setShowMe(false);
      return;
    }
    setMeMsg('Đang lấy vị trí của bạn...');
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const first = !meRef.current;
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy };
        meRef.current = next;
        setMe(next);
        setMeMsg('');
        if (first) wantMeFitRef.current = true; // the user just asked for it: frame me with the route, once
      },
      () => {
        setMeMsg('Không lấy được vị trí — hãy cho phép trang truy cập vị trí trong trình duyệt.');
        setShowMe(false);
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [showMe]);

  useEffect(() => {
    adapter?.setMe(showMe && me ? { lat: me.lat, lng: me.lng } : null, me?.acc);
  }, [adapter, me, showMe]);

  /** A stop wears the colour of the leg leaving it; the last stop reuses the leg arriving at it. */
  const pinColor = (i: number) => legColor(i < points.length - 1 ? i : Math.max(0, points.length - 2));

  /**
   * The label sitting on the middle of a leg: one white rounded box, bordered in that leg's colour,
   * with the order on the first line and the distance/time on the second.
   * `width:max-content` matters — Leaflet gives its marker a 0-wide container, and without it the white
   * box shrinks to nothing while the text spills onto the map.
   */
  const legLabel = (leg: Leg, color: string, order: string) => {
    const box = el(
      'div',
      `transform:translate(-50%,-50%);width:max-content;text-align:center;padding:4px 10px;border-radius:12px;background:#fff;border:2px solid ${color};box-shadow:0 2px 6px rgba(0,0,0,.25)`
    );
    box.appendChild(el('div', `color:${color};font:800 11px/1.3 system-ui,sans-serif;white-space:nowrap`, order));
    box.appendChild(el('div', 'color:#3f3f46;font:700 11px/1.3 system-ui,sans-serif;white-space:nowrap', `${formatKm(leg.km)} · ${formatMinutes(leg.minutes)}${leg.estimated ? ' ≈' : ''}`));
    return box;
  };

  // Draw pins, route lines and distance labels whenever anything changes.
  useEffect(() => {
    if (!adapter) return;
    adapter.clear();
    const view: LatLng[] = [];

    const drawLeg = (leg: Leg, color: string, order: string, dashed: boolean) => {
      adapter.addLine(leg.geometry, { dashed, color });
      leg.geometry.forEach(([lat, lng]) => view.push({ lat, lng }));
      const [midLat, midLng] = leg.geometry[Math.floor(leg.geometry.length / 2)];
      adapter.addHtml({ lat: midLat, lng: midLng }, legLabel(leg, color, order), { z: 500 });
    };

    // Each leg keeps its own colour: 1→2, 2→3, 3→4 ... never share one.
    legs.forEach((leg, i) => {
      if (!leg) return;
      drawLeg(leg, legColor(i), `${points[i].number} → ${points[i + 1].number}`, leg.estimated);
    });

    // The live location is drawn dashed and in its own blue so it never reads as a planned leg.
    if (meAnchor && meLeg && points.length > 0) {
      drawLeg(meLeg, ME_COLOR, `Tôi → ${points[0].number}`, true);
      const meTag = el(
        'div',
        `transform:translate(-50%,-190%);width:max-content;white-space:nowrap;padding:3px 9px;border-radius:999px;background:${ME_COLOR};color:#fff;font:800 11px/1.2 system-ui,sans-serif;box-shadow:0 2px 6px rgba(0,0,0,.35)`,
        '📍 Vị trí của tôi'
      );
      adapter.addHtml(meAnchor, meTag, { z: 900 });
    }

    points.forEach((p, i) => {
      const wrap = el('div', 'transform:translate(-14px,-14px);width:max-content;display:flex;align-items:center;gap:6px;white-space:nowrap');
      // Same colour as the leg that leaves this stop, so a pin and its outgoing line are read as one step.
      const dotColor = pinColor(i);
      wrap.appendChild(
        el(
          'div',
          `width:28px;height:28px;border-radius:50%;background:${dotColor};color:#fff;border:3px solid ${p.approx ? '#f97316' : '#fff'};display:flex;align-items:center;justify-content:center;font:800 13px/1 system-ui,sans-serif;box-shadow:0 2px 6px rgba(0,0,0,.4);flex:none`,
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

      const popup = el('div', 'font:13px/1.4 system-ui,sans-serif;min-width:140px;color:#27272a');
      popup.appendChild(el('div', 'font-weight:800', `${p.number}. ${p.stop.title}`));
      if (p.stop.place) popup.appendChild(el('div', 'color:#52525b', p.stop.place));
      if (p.stop.time) popup.appendChild(el('div', 'color:#71717a', `🕒 ${p.stop.time}`));
      if (p.approx) popup.appendChild(el('div', 'color:#c2410c;margin-top:4px;font-size:11px', 'Vị trí tự tìm theo tên — hãy ghim chính xác nếu lệch.'));

      adapter.addHtml(p.pos, wrap, { z: 1000, popup });
      view.push(p.pos);
    });

    if (meAnchor) view.push(meAnchor);
    viewRef.current = view;

    fitDayOnce(); // opening the map (or switching day) frames the whole route — and only then
    if (wantMeFitRef.current && meAnchor && fitAll()) wantMeFitRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter, points, legs, vehicle, meAnchor, meLeg, fitDayOnce, fitAll]);

  const totalKm = legs.reduce((s, l) => s + (l?.km || 0), 0);
  const totalMin = legs.reduce((s, l) => s + (l?.minutes || 0), 0);
  const anyEstimated = legs.some((l) => l?.estimated);

  // Whole day as one Google Maps route, in itinerary order (Maps URLs take up to 9 waypoints).
  // With "my location" on, the route starts where the user actually is.
  const googleDayUrl = useMemo(() => {
    const coords = points.map((p) => `${p.pos.lat},${p.pos.lng}`);
    if (meAnchor) coords.unshift(`${meAnchor.lat},${meAnchor.lng}`);
    if (coords.length < 2) return null;
    const pts = coords.slice(0, 10);
    const params = new URLSearchParams({
      api: '1',
      origin: pts[0],
      destination: pts[pts.length - 1],
      travelmode: VEHICLES[vehicle].googleMode,
    });
    if (pts.length > 2) params.set('waypoints', pts.slice(1, -1).join('|'));
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }, [points, vehicle, meAnchor]);

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

      <MapEngineBar engine={engine} notice={notice} keyValue={mapKey} onSaveKey={saveKey} />

      {/* Map */}
      <div className="relative h-[320px] lg:h-[420px]">
        <div key={engine} ref={attachContainer} className="absolute inset-0" style={{ zIndex: 0 }} />
        {!adapter && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-400 gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Đang tải bản đồ...
          </div>
        )}
        {adapter && points.length === 0 && (
          <div className="absolute inset-x-4 top-4 z-[500] rounded-xl bg-white/95 dark:bg-zinc-900/95 shadow px-3 py-2 text-xs text-zinc-600 dark:text-zinc-300 text-center pointer-events-none">
            {stops.length === 0 ? `Ngày ${day} chưa có hoạt động nào.` : 'Nhập địa điểm hoặc ghim vị trí cho hoạt động để hiện lên bản đồ.'}
          </div>
        )}
        {loadingLegs && (
          <div className="absolute bottom-3 left-3 z-[500] rounded-full bg-white/95 dark:bg-zinc-900/95 shadow px-3 py-1 text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" /> Đang tính đường đi...
          </div>
        )}
        <div className="absolute bottom-3 right-3 z-[500] flex items-center gap-1.5">
          {points.length > 0 && (
            <button
              type="button"
              onClick={fitAll}
              title="Thu về xem toàn bộ chặng của ngày"
              className="rounded-full shadow px-3 py-1.5 text-[11px] font-bold flex items-center gap-1.5 bg-white/95 dark:bg-zinc-900/95 text-zinc-600 dark:text-zinc-300 hover:text-rose-500 transition"
            >
              <Maximize2 className="w-3.5 h-3.5" /> Toàn chặng
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (!showMe) {
                setShowMe(true);
                return;
              }
              const m = meRef.current;
              if (m && adapter) adapter.flyTo({ lat: m.lat, lng: m.lng }, 16); // press again = jump back to where I am
            }}
            className={`rounded-full shadow px-3 py-1.5 text-[11px] font-bold flex items-center gap-1.5 transition ${
              showMe ? 'bg-blue-500 text-white' : 'bg-white/95 dark:bg-zinc-900/95 text-blue-600 dark:text-blue-400'
            }`}
            title={showMe ? 'Đưa bản đồ về vị trí hiện tại của tôi' : 'Hiện vị trí hiện tại của tôi'}
          >
            <LocateFixed className="w-3.5 h-3.5" /> {showMe ? 'Về vị trí của tôi' : 'Vị trí của tôi'}
          </button>
          {showMe && (
            <button
              type="button"
              onClick={() => setShowMe(false)}
              title="Ẩn vị trí của tôi"
              className="rounded-full shadow w-7 h-7 flex items-center justify-center bg-white/95 dark:bg-zinc-900/95 text-zinc-500 dark:text-zinc-400 hover:text-red-500 transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      {meMsg && <p className="px-3 pt-2 text-[11px] text-zinc-500 dark:text-zinc-400">{meMsg}</p>}

      {/* Route summary */}
      <div className="p-3 space-y-2.5">
        {(legs.length > 0 || (meLeg && points.length > 0)) && (
          <>
            <ul className="space-y-1">
              {meLeg && points.length > 0 && (
                <li className="flex items-center justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate text-zinc-600 dark:text-zinc-300">
                    <span className="inline-block w-3 h-1.5 rounded-full mr-1.5 align-middle" style={{ backgroundColor: ME_COLOR }} />
                    <b style={{ color: ME_COLOR }}>Vị trí của tôi</b> <span className="text-zinc-400">→</span> <b style={{ color: pinColor(0) }}>{points[0].number}</b> {points[0].stop.title}
                  </span>
                  <span className="shrink-0 font-bold text-zinc-800 dark:text-zinc-100 tabular-nums">
                    {formatKm(meLeg.km)} · {formatMinutes(meLeg.minutes)}
                  </span>
                </li>
              )}
              {legs.map((leg, i) =>
                leg ? (
                  <li key={i} className="flex items-center justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate text-zinc-600 dark:text-zinc-300">
                      <span className="inline-block w-3 h-1.5 rounded-full mr-1.5 align-middle" style={{ backgroundColor: legColor(i) }} />
                      <b style={{ color: pinColor(i) }}>{points[i].number}</b> {points[i].stop.title} <span className="text-zinc-400">→</span>{' '}
                      <b style={{ color: pinColor(i + 1) }}>{points[i + 1].number}</b> {points[i + 1].stop.title}
                    </span>
                    <span className="shrink-0 font-bold text-zinc-800 dark:text-zinc-100 tabular-nums">
                      {formatKm(leg.km)} · {formatMinutes(leg.minutes)}
                    </span>
                  </li>
                ) : null
              )}
            </ul>
            {legs.length > 0 && (
            <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs">
              <span className="font-bold text-zinc-500 dark:text-zinc-400">Tổng ngày {day}</span>
              <span className="font-extrabold text-rose-600 dark:text-rose-400 tabular-nums">
                {formatKm(totalKm)} · {formatMinutes(totalMin)}
              </span>
            </div>
            )}
            <p className="text-[11px] text-zinc-400">Các chặng nối theo đúng thứ tự thời gian trong lịch trình (1→2, 2→3…), mỗi chặng một màu riêng.</p>
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
            <ExternalLink className="w-3.5 h-3.5" /> {meAnchor ? `Đi từ vị trí của tôi theo lịch ngày ${day}` : `Mở cả ngày ${day} trên Google Maps`}
          </a>
        )}

        {points.some((p) => p.approx) && (
          <p className="text-[11px] text-orange-600 dark:text-orange-400">🟠 Ghim có viền cam được tự tìm theo tên địa điểm; bấm "Bản đồ" ở hoạt động để ghim chính xác.</p>
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
