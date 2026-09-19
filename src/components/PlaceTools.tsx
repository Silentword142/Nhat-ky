import React, { Suspense, useState } from 'react';
import { MapPin, Navigation, Star, Map as MapIcon } from 'lucide-react';
import { directionsUrl, safeUrl, viewOnMapUrl } from '../utils/maps';
import type { PickedPlace } from './MapPickerModal';

// Leaflet + its CSS are only downloaded when someone actually opens the map picker.
const MapPickerModal = React.lazy(() => import('./MapPickerModal'));

interface PlaceRef {
  name?: string;
  lat?: number;
  lng?: number;
  reviewUrl?: string;
}

/** Button that opens the map picker and reports the chosen point. */
export const PlacePickButton: React.FC<{
  lat?: number;
  lng?: number;
  query?: string;
  onPick: (place: PickedPlace) => void;
  className?: string;
}> = ({ lat, lng, query, onPick, className = '' }) => {
  const [open, setOpen] = useState(false);
  const has = typeof lat === 'number' && typeof lng === 'number';
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap flex items-center justify-center gap-1.5 transition ${
          has
            ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900'
            : 'bg-sky-50 dark:bg-sky-950/30 text-sky-600 dark:text-sky-300 border border-sky-200 dark:border-sky-900 hover:bg-sky-100'
        } ${className}`}
      >
        <MapPin className="w-3.5 h-3.5" />
        {has ? 'Đã ghim · đổi vị trí' : 'Chọn trên bản đồ'}
      </button>
      {open && (
        <Suspense fallback={null}>
          <MapPickerModal
            initial={has ? { lat: lat as number, lng: lng as number } : null}
            initialQuery={query}
            onClose={() => setOpen(false)}
            onPick={(p) => {
              setOpen(false);
              onPick(p);
            }}
          />
        </Suspense>
      )}
    </>
  );
};

const chip = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition';

/** Read-only links: Google Maps directions, view on map, and the review link. */
export const PlaceActions: React.FC<{ place: PlaceRef; className?: string }> = ({ place, className = '' }) => {
  const target = { lat: place.lat, lng: place.lng, query: place.name };
  const dir = directionsUrl(target);
  const view = viewOnMapUrl(target);
  const review = safeUrl(place.reviewUrl);
  if (!dir && !review) return null;
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`} onClick={(e) => e.stopPropagation()}>
      {dir && (
        <a href={dir} target="_blank" rel="noopener noreferrer" className={`${chip} bg-blue-500 hover:bg-blue-600 text-white`}>
          <Navigation className="w-3 h-3" /> Chỉ đường
        </a>
      )}
      {view && (
        <a href={view} target="_blank" rel="noopener noreferrer" className={`${chip} bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200`}>
          <MapIcon className="w-3 h-3" /> Xem bản đồ
        </a>
      )}
      {review && (
        <a href={review} target="_blank" rel="noopener noreferrer" className={`${chip} bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 hover:bg-amber-200`}>
          <Star className="w-3 h-3" /> Xem review
        </a>
      )}
    </div>
  );
};
