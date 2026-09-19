import { useEffect, useState } from 'react';
import type * as LeafletNS from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LatLng } from '../utils/maps';
import { getGoogleMapsKey, isGoogleMapsScriptLoaded, loadGoogleMaps, onGoogleMapsAuthFailure, setGoogleMapsKey } from '../services/googleMaps';

/**
 * One tiny interface over two map engines so the plan map and the location picker don't care which is in use:
 * Google Maps (when an API key is configured) or OpenStreetMap/Leaflet (free fallback, no key).
 */
export type MapEngine = 'google' | 'osm';

export interface MapAdapter {
  engine: MapEngine;
  destroy(): void;
  /** Re-measure after the container's size changed. */
  resize(): void;
  /** Remove everything drawn with addLine/addHtml (the pin and "my location" survive). */
  clear(): void;
  addLine(path: [number, number][], opts: { dashed: boolean }): void;
  /** Place a DOM element on the map, anchored at its own transform. `popup` opens on click. */
  addHtml(pos: LatLng, el: HTMLElement, opts?: { z?: number; popup?: HTMLElement }): void;
  fit(points: LatLng[]): void;
  flyTo(pos: LatLng, minZoom: number): void;
  onClick(cb: (pos: LatLng) => void): void;
  setPin(pos: LatLng | null): void;
  setMe(pos: LatLng | null, accuracyM?: number): void;
}

const VN_CENTER: LatLng = { lat: 16.05, lng: 106.3 };
const ROUTE_COLOR = '#f43f5e';

/* ------------------------------------------------------------------ Leaflet / OpenStreetMap */

export const createLeafletAdapter = async (container: HTMLElement): Promise<MapAdapter> => {
  const mod = await import('leaflet');
  const L = ((mod as unknown as { default?: typeof LeafletNS }).default ?? mod) as typeof LeafletNS;
  const map = L.map(container, { zoomControl: true }).setView([VN_CENTER.lat, VN_CENTER.lng], 5);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  const layer = L.layerGroup().addTo(map);
  let pin: LeafletNS.Marker | null = null;
  let meLayer: LeafletNS.LayerGroup | null = null;

  return {
    engine: 'osm',
    destroy: () => map.remove(),
    resize: () => map.invalidateSize(),
    clear: () => layer.clearLayers(),
    addLine: (path, { dashed }) => {
      L.polyline(path, { color: ROUTE_COLOR, weight: 5, opacity: 0.85, dashArray: dashed ? '2 10' : undefined, lineCap: 'round' }).addTo(layer);
    },
    addHtml: (pos, el, opts) => {
      const m = L.marker([pos.lat, pos.lng], {
        icon: L.divIcon({ className: '', html: el, iconSize: [0, 0] }),
        zIndexOffset: opts?.z ?? 0,
        interactive: !!opts?.popup,
      }).addTo(layer);
      if (opts?.popup) m.bindPopup(opts.popup);
    },
    fit: (points) => {
      map.invalidateSize();
      // No animation: re-fitting on every edit should just snap.
      if (points.length === 1) map.setView([points[0].lat, points[0].lng], 15, { animate: false });
      else if (points.length > 1) map.fitBounds(points.map((p) => [p.lat, p.lng] as [number, number]), { padding: [48, 48], maxZoom: 16, animate: false });
    },
    flyTo: (pos, minZoom) => map.flyTo([pos.lat, pos.lng], Math.max(map.getZoom(), minZoom), { duration: 0.8 }),
    onClick: (cb) => {
      map.on('click', (e: LeafletNS.LeafletMouseEvent) => cb({ lat: e.latlng.lat, lng: e.latlng.lng }));
    },
    setPin: (pos) => {
      if (!pos) {
        pin?.remove();
        pin = null;
        return;
      }
      if (pin) pin.setLatLng([pos.lat, pos.lng]);
      else {
        pin = L.marker([pos.lat, pos.lng], {
          icon: L.divIcon({
            className: '',
            html: '<div style="font-size:34px;line-height:34px;transform:translate(-50%,-100%);filter:drop-shadow(0 2px 3px rgba(0,0,0,.4))">📍</div>',
            iconSize: [0, 0],
          }),
        }).addTo(map);
      }
    },
    setMe: (pos, accuracyM) => {
      meLayer?.remove();
      meLayer = null;
      if (!pos) return;
      meLayer = L.layerGroup().addTo(map);
      if (accuracyM) L.circle([pos.lat, pos.lng], { radius: accuracyM, color: '#3b82f6', weight: 1, fillColor: '#3b82f6', fillOpacity: 0.15, interactive: false }).addTo(meLayer);
      L.circleMarker([pos.lat, pos.lng], { radius: 8, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }).bindTooltip('Vị trí của bạn').addTo(meLayer);
    },
  };
};

/* ------------------------------------------------------------------ Google Maps */

export const createGoogleAdapter = async (container: HTMLElement, key: string): Promise<MapAdapter> => {
  const g = await loadGoogleMaps(key);
  const map = new g.Map(container, {
    center: VN_CENTER,
    zoom: 5,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true,
    gestureHandling: 'greedy',
    clickableIcons: false,
  });

  // Puts any DOM element at a lat/lng (used for the numbered pins, names and km/time labels).
  class HtmlOverlay extends g.OverlayView {
    private div: HTMLDivElement | null = null;
    constructor(private pos: LatLng, private el: HTMLElement, private z: number, private onClick?: () => void) {
      super();
    }
    onAdd() {
      const div = document.createElement('div');
      div.style.position = 'absolute';
      div.style.zIndex = String(this.z);
      div.appendChild(this.el);
      if (this.onClick) {
        div.style.cursor = 'pointer';
        div.addEventListener('click', this.onClick);
      }
      this.div = div;
      this.getPanes()?.overlayMouseTarget.appendChild(div);
    }
    draw() {
      const p = this.getProjection()?.fromLatLngToDivPixel(new g.LatLng(this.pos.lat, this.pos.lng));
      if (p && this.div) {
        this.div.style.left = `${p.x}px`;
        this.div.style.top = `${p.y}px`;
      }
    }
    onRemove() {
      this.div?.remove();
      this.div = null;
    }
  }

  const drawn: { setMap(m: google.maps.Map | null): void }[] = [];
  const info = new g.InfoWindow();
  let pin: google.maps.Marker | null = null;
  let meItems: { setMap(m: google.maps.Map | null): void }[] = [];

  return {
    engine: 'google',
    destroy: () => {
      drawn.forEach((d) => d.setMap(null));
      pin?.setMap(null);
      meItems.forEach((d) => d.setMap(null));
      container.innerHTML = '';
    },
    resize: () => g.event.trigger(map, 'resize'),
    clear: () => {
      drawn.splice(0).forEach((d) => d.setMap(null));
      info.close();
    },
    addLine: (path, { dashed }) => {
      const line = new g.Polyline({
        map,
        path: path.map(([lat, lng]) => ({ lat, lng })),
        strokeColor: ROUTE_COLOR,
        strokeOpacity: dashed ? 0 : 0.85,
        strokeWeight: 5,
        icons: dashed ? [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeColor: ROUTE_COLOR, scale: 3 }, offset: '0', repeat: '12px' }] : undefined,
      });
      drawn.push(line);
    },
    addHtml: (pos, el, opts) => {
      const popup = opts?.popup;
      const overlay = new HtmlOverlay(pos, el, opts?.z ?? 0, popup ? () => {
        info.setContent(popup);
        info.setPosition(pos);
        info.open({ map });
      } : undefined);
      overlay.setMap(map);
      drawn.push(overlay);
    },
    fit: (points) => {
      g.event.trigger(map, 'resize');
      if (points.length === 1) {
        map.setCenter(points[0]);
        map.setZoom(15);
      } else if (points.length > 1) {
        const b = new g.LatLngBounds();
        points.forEach((p) => b.extend(p));
        map.fitBounds(b, 48);
        g.event.addListenerOnce(map, 'idle', () => {
          if ((map.getZoom() ?? 0) > 16) map.setZoom(16);
        });
      }
    },
    flyTo: (pos, minZoom) => {
      map.panTo(pos);
      map.setZoom(Math.max(map.getZoom() ?? 0, minZoom));
    },
    onClick: (cb) => {
      map.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (e.latLng) cb({ lat: e.latLng.lat(), lng: e.latLng.lng() });
      });
    },
    setPin: (pos) => {
      if (!pos) {
        pin?.setMap(null);
        pin = null;
        return;
      }
      if (pin) pin.setPosition(pos);
      else pin = new g.Marker({ map, position: pos, zIndex: 1000 });
    },
    setMe: (pos, accuracyM) => {
      meItems.forEach((d) => d.setMap(null));
      meItems = [];
      if (!pos) return;
      if (accuracyM) meItems.push(new g.Circle({ map, center: pos, radius: accuracyM, strokeColor: '#3b82f6', strokeWeight: 1, fillColor: '#3b82f6', fillOpacity: 0.15, clickable: false }));
      meItems.push(
        new g.Marker({
          map,
          position: pos,
          title: 'Vị trí của bạn',
          zIndex: 9999,
          icon: { path: g.SymbolPath.CIRCLE, scale: 8, fillColor: '#2563eb', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 3 },
        })
      );
    },
  };
};

/* ------------------------------------------------------------------ React hook */

/**
 * Creates the best available map inside the element you give to `setContainer`:
 * Google Maps when a key is configured and accepted, otherwise OpenStreetMap.
 * Render the container as `<div key={engine} ref={setContainer} />` so it is remounted when the engine changes.
 */
export const useMapAdapter = () => {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [key, setKeyState] = useState(getGoogleMapsKey);
  const [forceOsm, setForceOsm] = useState(false);
  const [notice, setNotice] = useState('');
  const [adapter, setAdapter] = useState<MapAdapter | null>(null);

  const engine: MapEngine = key && !forceOsm ? 'google' : 'osm';

  useEffect(() => {
    if (!container) return;
    let cancelled = false;
    let created: MapAdapter | null = null;

    const unsubscribe =
      engine === 'google'
        ? onGoogleMapsAuthFailure(() => {
            setNotice('Google Maps từ chối API key này (sai key, chưa bật "Maps JavaScript API", hoặc bị chặn theo tên miền). Đang dùng tạm OpenStreetMap.');
            setForceOsm(true);
          })
        : () => {};

    (engine === 'google' ? createGoogleAdapter(container, key) : createLeafletAdapter(container))
      .then((a) => {
        if (cancelled) {
          a.destroy();
          return;
        }
        created = a;
        setAdapter(a);
      })
      .catch((err: Error) => {
        if (cancelled || engine !== 'google') return;
        setNotice(`Không tải được Google Maps (${err.message}). Đang dùng tạm OpenStreetMap.`);
        setForceOsm(true);
      });

    return () => {
      cancelled = true;
      unsubscribe();
      created?.destroy();
      setAdapter(null);
    };
  }, [container, engine, key]);

  const saveKey = (next: string) => {
    const changed = next.trim() !== key;
    setGoogleMapsKey(next);
    // The Google script can't be re-initialised with a different key in the same page load.
    if (changed && isGoogleMapsScriptLoaded()) {
      window.location.reload();
      return;
    }
    setKeyState(next.trim());
    setForceOsm(false);
    setNotice('');
  };

  return { setContainer, adapter, engine, notice, key, saveKey };
};
