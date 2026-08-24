import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App safely (singleton)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

export const DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive',
];

// Default Client ID created for production domain (e.g. moonandcloud-3.onrender.com)
export const DEFAULT_PROD_CLIENT_ID = '266525209219-aue0llv949spv0gv2o8r8ovtl3suhtkj.apps.googleusercontent.com';

const CLIENT_ID_STORAGE_KEY = 'lovesync_custom_oauth_client_id';
const STORAGE_TOKEN_KEY = 'lovesync_gdrive_access_token';
const STORAGE_EXPIRES_KEY = 'lovesync_gdrive_token_expires_at';
const STORAGE_USER_KEY = 'lovesync_gdrive_user';

/**
 * Get current effective OAuth Client ID
 */
export function getOAuthClientId(): string {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem(CLIENT_ID_STORAGE_KEY)?.trim();
    if (custom) return custom;
  }
  return DEFAULT_PROD_CLIENT_ID || (firebaseConfig as any).oAuthClientId || '';
}

/**
 * Save a custom OAuth Client ID
 */
export function setCustomOAuthClientId(clientId: string): void {
  if (typeof window !== 'undefined') {
    const trimmed = clientId.trim();
    if (trimmed) {
      localStorage.setItem(CLIENT_ID_STORAGE_KEY, trimmed);
    } else {
      localStorage.removeItem(CLIENT_ID_STORAGE_KEY);
    }
  }
}

// In-memory token cache (restored from localStorage if available)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

// Preload cached token on initial execution
if (typeof window !== 'undefined') {
  const savedToken = localStorage.getItem(STORAGE_TOKEN_KEY);
  if (savedToken) {
    cachedAccessToken = savedToken;
  }
}

declare global {
  interface Window {
    google?: any;
  }
}

/**
 * Safely ensure Google Identity Services client script is loaded
 */
function loadGsiScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.accounts?.oauth2) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Không thể tải Google Identity Services.')));
      if (window.google?.accounts?.oauth2) resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Không thể tải Google Identity Services.'));
    document.head.appendChild(script);
  });
}

/**
 * Save token and user info to persistent storage
 */
function persistSession(user: any, accessToken: string, expiresInSec: number = 3599) {
  cachedAccessToken = accessToken;
  if (typeof window !== 'undefined') {
    try {
      const expiresAt = Date.now() + (expiresInSec || 3599) * 1000;
      localStorage.setItem(STORAGE_TOKEN_KEY, accessToken);
      localStorage.setItem(STORAGE_EXPIRES_KEY, expiresAt.toString());
      if (user) {
        localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
      }
    } catch (e) {
      console.warn('Could not persist Google session:', e);
    }
  }
}

/**
 * Sign in directly using Google Identity Services (GSI) Token Client.
 * Uses the effective client ID configured for this domain.
 */
async function signInWithGsi(promptMode: string = 'consent'): Promise<{ user: any; accessToken: string }> {
  await loadGsiScript();
  const clientId = getOAuthClientId();
  if (!clientId) {
    throw new Error('Chưa cấu hình Google OAuth Client ID.');
  }

  if (!window.google?.accounts?.oauth2) {
    throw new Error('Google Identity Services chưa sẵn sàng.');
  }

  return new Promise((resolve, reject) => {
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: DRIVE_SCOPES.join(' ') + ' email profile openid',
        callback: async (response: any) => {
          if (response.error) {
            reject(new Error(response.error_description || response.error || 'Lỗi xác thực Google'));
            return;
          }
          const accessToken = response.access_token;
          if (!accessToken) {
            reject(new Error('Không nhận được Access Token từ Google.'));
            return;
          }

          // Fetch basic user profile from Google UserInfo endpoint
          let userObj: any = {
            uid: 'google_drive_user',
            displayName: 'Người dùng Google',
            email: '',
            photoURL: '',
          };
          try {
            const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (userRes.ok) {
              const uData = await userRes.json();
              userObj = {
                uid: uData.sub || 'google_drive_user',
                displayName: uData.name || uData.given_name || 'Người dùng Google',
                email: uData.email || '',
                photoURL: uData.picture || '',
              };
            }
          } catch (e) {
            console.warn('Could not fetch userinfo:', e);
          }

          const expiresIn = parseInt(response.expires_in, 10) || 3599;
          persistSession(userObj, accessToken, expiresIn);

          resolve({ user: userObj, accessToken });
        },
      });

      client.requestAccessToken({ prompt: promptMode });
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Initialize Auth state listener with persistent session restore.
 */
export const initAuth = (
  onAuthSuccess?: (user: User | any, token: string | null) => void,
  onAuthFailure?: () => void
) => {
  // 1. Immediately check persistent Google Drive session from localStorage
  if (typeof window !== 'undefined') {
    try {
      const savedUserStr = localStorage.getItem(STORAGE_USER_KEY);
      const savedToken = localStorage.getItem(STORAGE_TOKEN_KEY);
      const expiresAtStr = localStorage.getItem(STORAGE_EXPIRES_KEY);

      if (savedUserStr && savedToken) {
        const savedUser = JSON.parse(savedUserStr);
        cachedAccessToken = savedToken;

        if (onAuthSuccess) {
          onAuthSuccess(savedUser, savedToken);
        }

        // Check if token is expired or close to expiry (within 5 mins) -> silent refresh
        const expiresAt = expiresAtStr ? parseInt(expiresAtStr, 10) : 0;
        const isExpiringSoon = !expiresAt || expiresAt - Date.now() < 5 * 60 * 1000;

        if (isExpiringSoon && !isSigningIn) {
          // Attempt silent token refresh in background
          signInWithGsi('')
            .then((res) => {
              if (res?.accessToken && onAuthSuccess) {
                onAuthSuccess(res.user, res.accessToken);
              }
            })
            .catch((err) => {
              console.log('Background silent refresh notice (kept existing session):', err?.message);
            });
        }
      }
    } catch (e) {
      console.warn('Error restoring Google session:', e);
    }
  }

  // 2. Also listen to Firebase Auth in case Firebase Popup was used
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        if (onAuthSuccess) onAuthSuccess(user, null);
      }
    } else {
      // Check if we still have GSI session in localStorage before failing
      const savedToken = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_TOKEN_KEY) : null;
      if (!cachedAccessToken && !savedToken) {
        if (onAuthFailure) onAuthFailure();
      }
    }
  });
};

/**
 * Trigger Google Sign In with Drive permissions
 */
export const googleSignIn = async (): Promise<{ user: any; accessToken: string } | null> => {
  try {
    isSigningIn = true;

    // 1. Try Google Identity Services first (GSI Token Client)
    try {
      const gsiResult = await signInWithGsi('consent');
      return gsiResult;
    } catch (gsiErr: any) {
      console.warn('GSI flow notice, checking Firebase Auth fallback:', gsiErr?.message);

      // If user closed or cancelled GSI prompt
      if (
        gsiErr?.message?.includes('popup_closed_by_user') ||
        gsiErr?.message?.includes('user_cancel') ||
        gsiErr?.message?.includes('access_denied')
      ) {
        return null;
      }

      // 2. Fallback to Firebase Auth popup if needed
      try {
        const provider = new GoogleAuthProvider();
        DRIVE_SCOPES.forEach((scope) => provider.addScope(scope));
        const result = await signInWithPopup(auth, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (!credential?.accessToken) {
          throw new Error('Không lấy được Access Token từ Google. Vui lòng thử lại.');
        }

        cachedAccessToken = credential.accessToken;
        persistSession(result.user, cachedAccessToken, 3599);
        return { user: result.user, accessToken: cachedAccessToken };
      } catch (fbErr: any) {
        if (gsiErr?.message) {
          throw gsiErr;
        }
        throw fbErr;
      }
    }
  } catch (error: any) {
    if (
      error?.code === 'auth/popup-closed-by-user' ||
      error?.code === 'auth/cancelled-popup-request' ||
      error?.message?.includes('popup-closed-by-user') ||
      error?.message?.includes('popup_closed_by_user')
    ) {
      // User closed the popup intentionally
      return null;
    }
    console.warn('Google Sign In warning:', error?.message || error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Get current cached access token (or auto-restore / refresh if expired)
 */
export const getAccessToken = async (): Promise<string | null> => {
  if (cachedAccessToken) {
    // Check if token is still fresh
    if (typeof window !== 'undefined') {
      const expiresAtStr = localStorage.getItem(STORAGE_EXPIRES_KEY);
      const expiresAt = expiresAtStr ? parseInt(expiresAtStr, 10) : 0;
      if (expiresAt && Date.now() > expiresAt) {
        // Token has expired, try silent refresh
        try {
          const res = await signInWithGsi('');
          if (res?.accessToken) {
            return res.accessToken;
          }
        } catch (e) {
          // Fall back to existing cached token if refresh fails
        }
      }
    }
    return cachedAccessToken;
  }

  if (typeof window !== 'undefined') {
    const savedToken = localStorage.getItem(STORAGE_TOKEN_KEY);
    if (savedToken) {
      cachedAccessToken = savedToken;
      return savedToken;
    }
  }
  return null;
};

/**
 * Set token if acquired
 */
export const setCachedToken = (token: string | null) => {
  cachedAccessToken = token;
  if (token && typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_TOKEN_KEY, token);
  }
};

/**
 * Sign out completely and clear saved session
 */
export const googleLogout = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (e) {}
  cachedAccessToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    localStorage.removeItem(STORAGE_EXPIRES_KEY);
    localStorage.removeItem(STORAGE_USER_KEY);
  }
};
