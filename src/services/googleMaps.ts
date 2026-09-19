/**
 * Google Maps JavaScript API loader. The key comes from the build (VITE_GOOGLE_MAPS_API_KEY — set it as a
 * GitHub Actions secret so both partners get it automatically) or from this browser's localStorage.
 * Only the "Maps JavaScript API" needs to be enabled on the key.
 */

const KEY_STORAGE = 'lovesync_gmaps_key';
const CALLBACK_NAME = '__lovesyncGmapsInit';

export const getBuildTimeGoogleMapsKey = (): string => {
  try {
    return String((import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '').trim();
  } catch {
    return '';
  }
};

export const getGoogleMapsKey = (): string => {
  const fromBuild = getBuildTimeGoogleMapsKey();
  if (fromBuild) return fromBuild;
  try {
    return (localStorage.getItem(KEY_STORAGE) || '').trim();
  } catch {
    return '';
  }
};

export const setGoogleMapsKey = (key: string) => {
  try {
    if (key.trim()) localStorage.setItem(KEY_STORAGE, key.trim());
    else localStorage.removeItem(KEY_STORAGE);
  } catch {
    // storage unavailable — the key just won't persist
  }
};

/** The script can't be re-loaded with another key; the page has to be refreshed. */
export const isGoogleMapsScriptLoaded = (): boolean => Boolean((window as any).google?.maps?.Map);

const authFailureListeners = new Set<() => void>();

/** Google calls window.gm_authFailure when the key is invalid / the API isn't enabled / the referrer is blocked. */
export const onGoogleMapsAuthFailure = (cb: () => void): (() => void) => {
  authFailureListeners.add(cb);
  (window as any).gm_authFailure = () => authFailureListeners.forEach((f) => f());
  return () => {
    authFailureListeners.delete(cb);
  };
};

let loadPromise: Promise<typeof google.maps> | null = null;

export const loadGoogleMaps = (key: string): Promise<typeof google.maps> => {
  if (isGoogleMapsScriptLoaded()) return Promise.resolve(google.maps);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<typeof google.maps>((resolve, reject) => {
    const timer = setTimeout(() => {
      loadPromise = null;
      reject(new Error('quá thời gian chờ'));
    }, 15000);
    (window as any)[CALLBACK_NAME] = () => {
      clearTimeout(timer);
      resolve(google.maps);
    };
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&language=vi&region=VN&callback=${CALLBACK_NAME}`;
    script.async = true;
    script.onerror = () => {
      clearTimeout(timer);
      loadPromise = null;
      reject(new Error('không tải được script Google Maps'));
    };
    document.head.appendChild(script);
  });
  return loadPromise;
};
