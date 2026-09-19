import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Search, LocateFixed, Check, Loader2, MapPin } from 'lucide-react';
import { LatLng, parseLatLngFromText } from '../utils/maps';
import { useMapAdapter } from './mapEngines';

export interface PickedPlace extends LatLng {
  address?: string;
}

interface Props {
  initial?: LatLng | null;
  initialQuery?: string;
  onClose: () => void;
  onPick: (place: PickedPlace) => void;
}

interface SearchResult {
  display_name: string;
  lat: string;
  lon: string;
}

// Search / reverse-geocode use OpenStreetMap's free Nominatim service (no API key needed) on either map.
const NOMINATIM = 'https://nominatim.openstreetmap.org';

const MapPickerModal: React.FC<Props> = ({ initial, initialQuery, onClose, onPick }) => {
  const { setContainer, adapter, engine, notice } = useMapAdapter();
  const attachContainer = useCallback((node: HTMLDivElement | null) => setContainer(node), [setContainer]);
  const reverseSeq = useRef(0);

  const [picked, setPicked] = useState<PickedPlace | null>(initial ? { ...initial } : null);
  const [query, setQuery] = useState(initialQuery || '');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState('');

  const placeMarker = (lat: number, lng: number, address?: string, fly = false) => {
    if (!adapter) return;
    adapter.setPin({ lat, lng });
    if (fly) adapter.flyTo({ lat, lng }, 16);
    setPicked({ lat, lng, address });

    if (!address) {
      const seq = ++reverseSeq.current;
      fetch(`${NOMINATIM}/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=vi`)
        .then((r) => r.json())
        .then((d) => {
          if (seq === reverseSeq.current && d?.display_name) setPicked({ lat, lng, address: d.display_name });
        })
        .catch(() => {});
    }
  };

  // Always call the latest placeMarker from the map's click handler.
  const placeRef = useRef(placeMarker);
  placeRef.current = placeMarker;

  useEffect(() => {
    if (!adapter) return;
    adapter.onClick((p) => placeRef.current(p.lat, p.lng));
    if (initial) {
      adapter.setPin(initial);
      adapter.fit([initial]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter]);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setMessage('');
    const fromLink = parseLatLngFromText(q);
    if (fromLink) {
      placeMarker(fromLink.lat, fromLink.lng, undefined, true);
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`${NOMINATIM}/search?format=json&limit=6&accept-language=vi&q=${encodeURIComponent(q)}`);
      const data: SearchResult[] = await res.json();
      setResults(data);
      if (data.length === 0) setMessage('Không tìm thấy — thử thêm tên thành phố, hoặc chạm thẳng lên bản đồ.');
    } catch {
      setMessage('Không tìm kiếm được lúc này. Bạn vẫn có thể chạm trực tiếp lên bản đồ.');
    } finally {
      setSearching(false);
    }
  };

  const locateMe = () => {
    if (!navigator.geolocation) {
      setMessage('Trình duyệt không hỗ trợ định vị.');
      return;
    }
    setMessage('Đang lấy vị trí của bạn...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMessage('');
        placeMarker(pos.coords.latitude, pos.coords.longitude, undefined, true);
      },
      () => setMessage('Không lấy được vị trí (bạn chưa cho phép định vị).'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-2xl h-[92vh] sm:h-[80vh] flex flex-col bg-white dark:bg-zinc-900 rounded-t-[28px] sm:rounded-[28px] shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
          <h3 className="font-bold text-zinc-800 dark:text-zinc-100 font-cute flex items-center gap-2">
            <MapPin className="w-5 h-5 text-rose-500" /> Chọn vị trí trên bản đồ
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500">{engine === 'google' ? 'Google Maps' : 'OpenStreetMap'}</span>
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-full text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Đóng">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={search} className="px-4 pt-3 flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm quán / địa chỉ, hoặc dán link Google Maps..."
            className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 text-sm text-zinc-800 dark:text-zinc-100 focus:ring-2 focus:ring-rose-400"
          />
          <button type="submit" className="px-3.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white transition" aria-label="Tìm">
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </button>
          <button type="button" onClick={locateMe} className="px-3.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-rose-500 transition" title="Dùng vị trí của tôi" aria-label="Dùng vị trí của tôi">
            <LocateFixed className="w-4 h-4" />
          </button>
        </form>

        {(results.length > 0 || message || notice) && (
          <div className="px-4 pt-2 space-y-1">
            {notice && <p className="text-xs text-red-600 dark:text-red-400">{notice}</p>}
            {message && <p className="text-xs text-zinc-500 dark:text-zinc-400">{message}</p>}
            {results.length > 0 && (
              <ul className="max-h-36 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-700 divide-y divide-zinc-100 dark:divide-zinc-800">
                {results.map((r, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => {
                        placeMarker(Number(r.lat), Number(r.lon), r.display_name, true);
                        setResults([]);
                      }}
                      className="w-full text-left px-3 py-2 text-xs text-zinc-700 dark:text-zinc-200 hover:bg-rose-50 dark:hover:bg-zinc-800"
                    >
                      {r.display_name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="relative flex-1 mt-3 min-h-0">
          {/* own stacking context so map panes stay under the header/footer */}
          <div key={engine} ref={attachContainer} className="absolute inset-0" style={{ zIndex: 0 }} />
          {!adapter && (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-400 gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Đang tải bản đồ...
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-3">
          <p className="flex-1 min-w-0 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
            {picked ? picked.address || `${picked.lat.toFixed(5)}, ${picked.lng.toFixed(5)}` : 'Chạm vào bản đồ để đặt ghim 📍'}
          </p>
          <button
            type="button"
            disabled={!picked}
            onClick={() => picked && onPick(picked)}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 disabled:opacity-40 text-white font-bold text-sm shadow-md flex items-center gap-1.5 transition active:scale-95"
          >
            <Check className="w-4 h-4" /> Chọn vị trí này
          </button>
        </div>
      </div>
    </div>
  );
};

export default MapPickerModal;
