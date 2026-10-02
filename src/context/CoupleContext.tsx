import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  CoupleProfile,
  CoupleSettings,
  DiaryEntry,
  PhotoMemory,
  HandwrittenCard,
  AnniversaryEvent,
  TripPlan,
  HeartbeatPulse,
  DatingExpense,
  CalendarNote,
  CoupleFullState,
} from '../types';
import {
  initialMyProfile,
  initialPartnerProfile,
  initialSettings,
  initialDiaries,
  initialPhotos,
  initialAnniversaries,
  initialCards,
  DEFAULT_AVATAR_ME,
  DEFAULT_AVATAR_PARTNER,
} from '../services/mockData';
import { soundService } from '../services/sound';
import { initAuth, googleSignIn, googleLogout } from '../services/googleAuth';
import { findOrCreateAppFolder, APP_FOLDER_NAME } from '../services/googleDrive';
import { User } from 'firebase/auth';
import { db, doc, setDoc, getDoc, onSnapshot } from '../services/firebase';
import { runTransaction } from 'firebase/firestore';
import { getItemTimestamp, mergeCollections, mergeIncoming, readTombstones, Tombstones } from '../utils/syncMerge';
import { offloadInlineImages, resolveImageRefs } from '../services/blobStore';
import {
  getCurrentAuthUser,
  getStoredWebAccounts,
  saveStoredWebAccounts,
  linkPartnerAccountService,
  unlinkPartnerAccountService,
  leaveRoomService,
  requestChangeRoomCode,
  fetchUserLatestProfile,
  updateUserProfileOnServer,
  logoutAccount,
  clearAllSystemDataService,
} from '../services/auth';

export interface CoupleContextType {
  isAuthenticated: boolean;
  isAuthModalOpen: boolean;
  authModalTab: 'login' | 'register';
  openAuthModal: (tab?: 'login' | 'register') => void;
  closeAuthModal: () => void;
  clearAllUserDataAndLogout: () => Promise<void>;
  clearAllSystemAndLocalData: () => Promise<void>;
  loginWithUserAccount: (user: any) => void;

  myProfile: CoupleProfile;
  partnerProfile: CoupleProfile | null;
  settings: CoupleSettings;
  diaries: DiaryEntry[];
  photos: PhotoMemory[];
  cards: HandwrittenCard[];
  anniversaries: AnniversaryEvent[];
  plans: TripPlan[];
  datingExpenses: DatingExpense[];
  calendarNotes: CalendarNote[];
  /** This device's user id — what "me" is when reading who paid for something. */
  myUserId: string;
  isPartnerOnline: boolean;
  isPartnerTyping: boolean;
  incomingHeartbeat: HeartbeatPulse | null;
  syncStatus: 'connected' | 'connecting' | 'offline';
  /** Why the last save didn't reach the cloud (null when all is well). Data stays on this device meanwhile. */
  syncError: string | null;
  lastSyncedAt: number | null;
  daysInLove: number;
  partnerAccountInfo: { username?: string; displayName?: string; birthday?: string } | null;

  // Google Drive is used exclusively as photo file storage for the album (see
  // src/services/googleDrive.ts) — connecting it is required before uploading a photo.
  // All other app data (accounts, diaries, cards, anniversaries, settings) lives in Firebase only.
  googleUser: User | null;
  isGoogleDriveConnected: boolean;
  isGoogleDriveSyncing: boolean;
  googleDriveFolderUrl: string | null;
  googleDriveFolderName: string;
  connectGoogleDrive: () => Promise<boolean>;
  disconnectGoogleDrive: () => Promise<void>;

  // Sync & Room Actions
  syncNow: () => Promise<boolean>;
  setRoomCode: (code: string) => void;
  changeCoupleRoomCode: (newCode: string, migratePartner?: boolean) => Promise<boolean>;
  leaveCoupleRoom: () => Promise<void>;
  linkPartnerAccount: (partnerUsername: string) => Promise<boolean>;
  unlinkPartnerAccount: () => Promise<void>;

  // Actions
  updateMyProfile: (profile: Partial<CoupleProfile>) => void;
  updateSettings: (newSettings: Partial<CoupleSettings>) => void;
  addDiary: (diary: Omit<DiaryEntry, 'id' | 'createdAt' | 'updatedAt' | 'authorId' | 'authorName' | 'reactions' | 'comments'>) => void;
  updateDiary: (id: string, updates: Partial<DiaryEntry>) => void;
  deleteDiary: (id: string) => void;
  deleteAllDayDiaries: (date: string) => void;
  addDiaryReaction: (diaryId: string, emoji: string) => void;
  addDiaryComment: (diaryId: string, content: string) => void;

  addPhoto: (photo: Omit<PhotoMemory, 'id' | 'createdAt' | 'authorId' | 'authorName' | 'likes'>) => void;
  addPhotosBatch: (photosList: Array<Omit<PhotoMemory, 'id' | 'createdAt' | 'authorId' | 'authorName' | 'likes'>>) => void;
  deletePhoto: (id: string) => void;
  togglePhotoLike: (photoId: string) => void;
  updatePhotoMeta: (photoId: string, updates: Partial<PhotoMemory>) => void;

  sendHandwrittenCard: (card: Omit<HandwrittenCard, 'id' | 'sentAt' | 'senderId' | 'senderName' | 'isOpened'>) => void;
  openCard: (cardId: string) => void;
  deleteCard: (cardId: string) => void;

  addAnniversary: (event: Omit<AnniversaryEvent, 'id'>) => void;
  updateAnniversary: (id: string, updates: Partial<AnniversaryEvent>) => void;
  deleteAnniversary: (id: string) => void;

  addPlan: (plan: Omit<TripPlan, 'id' | 'createdAt' | 'updatedAt' | 'authorId' | 'authorName'>) => string;
  updatePlan: (id: string, updates: Partial<TripPlan>) => void;
  deletePlan: (id: string) => void;

  addExpense: (expense: Omit<DatingExpense, 'id' | 'createdAt' | 'updatedAt' | 'authorId' | 'authorName'>) => void;
  updateExpense: (id: string, updates: Partial<DatingExpense>) => void;
  deleteExpense: (id: string) => void;

  addCalendarNote: (note: Omit<CalendarNote, 'id' | 'createdAt' | 'updatedAt' | 'authorId' | 'authorName'>) => void;
  updateCalendarNote: (id: string, updates: Partial<CalendarNote>) => void;
  deleteCalendarNote: (id: string) => void;

  sendHeartbeat: (type: HeartbeatPulse['type'], message?: string, diaryDate?: string) => void;
  clearIncomingHeartbeat: () => void;
  sendTypingStatus: (isTyping: boolean) => void;
  roomPlaylist: any[];
  updateRoomPlaylist: (newPlaylist: any[], removedId?: string) => void;
  roomAlbums: any[];
  updateRoomAlbums: (newAlbums: any[], removedId?: string) => void;
  exportData: () => string;
  importData: (jsonStr: string) => boolean;
}

export const CoupleContext = createContext<CoupleContextType | undefined>(undefined);

const STORAGE_KEY_PREFIX = 'lovesync_cloud_v2_';

/**
 * Settings that describe how the app LOOKS to the person holding this device. They stay on this
 * account only: never sent to the room, never taken from it — so changing the background (or the
 * dark mode the settings screen already promises is per-device) leaves the partner's app alone.
 * Everything else in settings — the love date, cycle tracking, the shared photo folder — is shared.
 */
const PERSONAL_SETTING_KEYS = ['theme', 'isDarkMode'] as const;

/**
 * A notification from the browser itself, for when the app is in another tab or minimised — the
 * in-app card is invisible then. Silently does nothing until the person allows notifications
 * (Cài đặt → Thông báo trên trình duyệt), which browsers only grant on a real click.
 */
const notifyInBrowser = (title: string, body: string) => {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') return;
    const note = new Notification(title, {
      body,
      tag: 'lovesync-pulse', // a newer notice replaces the previous one instead of stacking up
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">💖</text></svg>',
    });
    note.onclick = () => {
      try {
        window.focus();
      } catch {}
      note.close();
    };
  } catch {
    // notifications are a bonus; never let them break the sync
  }
};

const stripPersonalSettings = <T extends Record<string, unknown>>(settings: T): T => {
  const shared = { ...settings };
  PERSONAL_SETTING_KEYS.forEach((key) => delete shared[key]);
  return shared;
};

/** Shared collections of the room — merged item by item, never overwritten as a whole (see utils/syncMerge). */
const COLLECTION_KEYS = ['diaries', 'photos', 'cards', 'anniversaries', 'plans', 'datingExpenses', 'calendarNotes'] as const;
type CollectionKey = (typeof COLLECTION_KEYS)[number];

/** Items written in the last week are the ones that may never have made it to the cloud (see bootCache below). */
const RECENT_RESCUE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * What this device had cached when the app started: which room it belonged to, every item id, and
 * the recently written ones. Seeds the "seen in the cloud" set the first time this version opens a
 * room — see confirmedFor() in the provider.
 */
const readBootCache = () => {
  const ids = new Set<string>();
  const recent = new Set<string>();
  let room = '';
  try {
    room = String(JSON.parse(localStorage.getItem(`${STORAGE_KEY_PREFIX}settings`) || '{}').roomCode || '').toUpperCase().trim();
  } catch {}
  const now = Date.now();
  for (const key of COLLECTION_KEYS) {
    try {
      const list = JSON.parse(localStorage.getItem(`${STORAGE_KEY_PREFIX}${key}`) || '[]');
      if (!Array.isArray(list)) continue;
      for (const item of list) {
        if (!item || typeof item.id !== 'string') continue;
        ids.add(item.id);
        if (now - getItemTimestamp(item) < RECENT_RESCUE_MS) recent.add(item.id);
      }
    } catch {}
  }
  return { room, ids, recent };
};

/**
 * Shared tombstone helper for the whole-array-overwrite sync paths (playlist, albums — anything
 * that has no per-item merge, unlike diaries/photos/cards/anniversaries). A delete's Firestore
 * write is fire-and-forget, so a reload or the realtime listener's own next snapshot landing
 * before that write is acknowledged could read back the pre-delete array and resurrect the
 * just-removed item. Ids removed here are filtered out of incoming data for `ttlMs` — NOT
 * forever: ids can be fixed/reused (a default catalog reintroducing a built-in id after a
 * cleared session, for instance), so a permanent blacklist eventually blocks a legitimate
 * reappearance. See the music playlist bug this was extracted from for the full story.
 */
function loadTombstoneMap(storageKey: string, ttlMs: number): Map<string, number> {
  try {
    const saved = localStorage.getItem(storageKey);
    const parsed = saved ? JSON.parse(saved) : [];
    const now = Date.now();
    const entries: [string, number][] = Array.isArray(parsed)
      ? parsed.filter(
          (e: any): e is [string, number] =>
            Array.isArray(e) && typeof e[0] === 'string' && typeof e[1] === 'number' && now - e[1] < ttlMs
        )
      : [];
    return new Map(entries);
  } catch {
    return new Map<string, number>();
  }
}

function pruneAndPersistTombstoneMap(map: Map<string, number>, storageKey: string, ttlMs: number) {
  const now = Date.now();
  for (const [id, removedAt] of map) {
    if (now - removedAt >= ttlMs) map.delete(id);
  }
  try {
    localStorage.setItem(storageKey, JSON.stringify(Array.from(map.entries())));
  } catch {}
}

// Unique Device Identity per browser
const getOrCreateUserId = (): string => {
  try {
    const existing = localStorage.getItem('lovesync_device_user_id');
    if (existing && existing.trim().length > 3) return existing;
    const newId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem('lovesync_device_user_id', newId);
    return newId;
  } catch {
    return `usr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
};

export const CoupleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authSessionUser, setAuthSessionUser] = useState<any>(() => getCurrentAuthUser());

  const myUserId = useMemo(() => {
    if (authSessionUser?.username) {
      return `usr_${authSessionUser.username.toLowerCase()}`;
    }
    if (authSessionUser?.id) {
      return authSessionUser.id;
    }
    return getOrCreateUserId();
  }, [authSessionUser]);

  // Check URL query parameters for room code: ?room=LOVE-1234
  const urlRoomParam = useMemo(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const q = urlParams.get('room');
      return q ? q.toUpperCase().trim() : null;
    } catch {
      return null;
    }
  }, []);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalTab, setAuthModalTab] = useState<'login' | 'register'>('register');

  const openAuthModal = useCallback((tab: 'login' | 'register' = 'login') => {
    setAuthModalTab(tab);
    setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
  }, []);

  // Initial State - Auth Gated
  const [myProfile, setMyProfileState] = useState<CoupleProfile>(() => {
    try {
      const current = getCurrentAuthUser();
      if (!current) {
        return { ...initialMyProfile, avatar: initialMyProfile.avatar || DEFAULT_AVATAR_ME, id: getOrCreateUserId() };
      }
      const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}my_profile`);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          avatar: parsed.avatar || DEFAULT_AVATAR_ME,
          id: current.id || (current.username ? `usr_${current.username.toLowerCase()}` : getOrCreateUserId()),
        };
      }
      return {
        ...initialMyProfile,
        id: current.id || (current.username ? `usr_${current.username.toLowerCase()}` : getOrCreateUserId()),
        name: current.displayName || current.username,
        avatar: DEFAULT_AVATAR_ME,
        birthday: current.birthday || '',
        email: current.email || '',
        authProvider: current.authProvider || 'username',
      };
    } catch {
      return { ...initialMyProfile, avatar: initialMyProfile.avatar || DEFAULT_AVATAR_ME, id: getOrCreateUserId() };
    }
  });

  const [partnerProfile, setPartnerProfileState] = useState<CoupleProfile | null>(() => {
    try {
      const current = getCurrentAuthUser();
      if (!current) return null;
      const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}partner_profile`);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          avatar: parsed.avatar || DEFAULT_AVATAR_PARTNER,
        };
      }
      return null;
    } catch {
      return null;
    }
  });

  const [settings, setSettingsState] = useState<CoupleSettings>(() => {
    try {
      const current = getCurrentAuthUser();
      const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}settings`);
      const parsed = saved ? JSON.parse(saved) : { ...initialSettings };
      if (current?.roomCode) {
        parsed.roomCode = current.roomCode;
      }
      if (urlRoomParam) {
        parsed.roomCode = urlRoomParam;
      }
      return parsed;
    } catch {
      const base = { ...initialSettings };
      if (urlRoomParam) base.roomCode = urlRoomParam;
      return base;
    }
  });

  const [diaries, setDiaries] = useState<DiaryEntry[]>(() => {
    try {
      const current = getCurrentAuthUser();
      if (!current) return [];
      const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}diaries`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [photos, setPhotos] = useState<PhotoMemory[]>(() => {
    try {
      const current = getCurrentAuthUser();
      if (!current) return [];
      const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}photos`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [cards, setCards] = useState<HandwrittenCard[]>(() => {
    try {
      const current = getCurrentAuthUser();
      if (!current) return [];
      const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}cards`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [anniversaries, setAnniversaries] = useState<AnniversaryEvent[]>(() => {
    try {
      const current = getCurrentAuthUser();
      if (!current) return [];
      const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}anniversaries`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [plans, setPlans] = useState<TripPlan[]>(() => {
    try {
      const current = getCurrentAuthUser();
      if (!current) return [];
      const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}plans`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [datingExpenses, setDatingExpenses] = useState<DatingExpense[]>(() => {
    try {
      const current = getCurrentAuthUser();
      if (!current) return [];
      const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}datingExpenses`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [calendarNotes, setCalendarNotes] = useState<CalendarNote[]>(() => {
    try {
      const current = getCurrentAuthUser();
      if (!current) return [];
      const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}calendarNotes`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [roomPlaylist, setRoomPlaylist] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('lovesync_full_playlist_v3');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Unlike diaries/photos/cards/anniversaries, the playlist has no per-item merge — it's synced
  // as one whole array (see applyIncomingRoomData below). See loadTombstoneMap's comment above
  // for why this needs a short-TTL tombstone rather than either nothing or a permanent one.
  const TOMBSTONE_TTL_MS = 2 * 60 * 1000;
  const REMOVED_PLAYLIST_IDS_KEY = 'lovesync_removed_playlist_ids';
  const removedPlaylistIdsRef = useRef<Map<string, number>>(loadTombstoneMap(REMOVED_PLAYLIST_IDS_KEY, TOMBSTONE_TTL_MS));
  const pruneAndPersistRemovedPlaylistIds = () =>
    pruneAndPersistTombstoneMap(removedPlaylistIdsRef.current, REMOVED_PLAYLIST_IDS_KEY, TOMBSTONE_TTL_MS);

  // The album list (PhotoAlbumView's albumsList) had no cloud sync at all before this — 100%
  // localStorage, so clearing site data (or a fresh device) silently reset every custom album,
  // including ones the user had deliberately deleted, back to the hardcoded defaults. Same
  // whole-array-overwrite shape as the playlist, so it gets the same tombstone treatment.
  const [roomAlbums, setRoomAlbums] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('lovesync_custom_albums_v2');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const REMOVED_ALBUM_IDS_KEY = 'lovesync_removed_album_ids';
  const removedAlbumIdsRef = useRef<Map<string, number>>(loadTombstoneMap(REMOVED_ALBUM_IDS_KEY, TOMBSTONE_TTL_MS));
  const pruneAndPersistRemovedAlbumIds = () =>
    pruneAndPersistTombstoneMap(removedAlbumIdsRef.current, REMOVED_ALBUM_IDS_KEY, TOMBSTONE_TTL_MS);

  // updateRoomPlaylist/updateRoomAlbums are defined further down, right after broadcastRoomChanges
  // — they have to close over that function correctly (see the comment there for why this used to
  // be broken).

  const isAuthenticated = useMemo(() => {
    const cur = getCurrentAuthUser();
    return !!cur?.username || (!!myProfile.email && myProfile.authProvider === 'google') || myProfile.authProvider === 'username';
  }, [authSessionUser, myProfile]);

  const [isPartnerOnline, setIsPartnerOnline] = useState<boolean>(false);
  const [isPartnerTyping, setIsPartnerTyping] = useState<boolean>(false);
  const [incomingHeartbeat, setIncomingHeartbeat] = useState<HeartbeatPulse | null>(null);
  // Optimistic initial value: if we already have a paired room code from a previous session,
  // assume we're online immediately instead of flashing "Đang kết nối lại..." for the brief
  // moment before the first realtime snapshot confirms it. The room-join effect below corrects
  // this to 'offline' right away if there's genuinely no authenticated room to join.
  const [syncStatus, setSyncStatus] = useState<'connected' | 'connecting' | 'offline'>(
    settings.roomCode && settings.roomCode.trim().length > 0 ? 'connected' : 'offline'
  );
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [partnerAccountInfo, setPartnerAccountInfo] = useState<{
    username?: string;
    displayName?: string;
    birthday?: string;
  } | null>(() => {
    const cur = getCurrentAuthUser();
    if (cur?.partnerUsername) {
      return {
        username: cur.partnerUsername,
        displayName: cur.partnerDisplayName,
      };
    }
    return null;
  });

  const lastProcessedPulseRef = useRef<number>(0);
  const lastKnownServerTimeRef = useRef<number>(0);
  const myProfileRef = useRef<CoupleProfile>(myProfile);
  myProfileRef.current = myProfile;
  const hasUserMutatedRef = useRef<boolean>(false);

  // ---- Safe sync bookkeeping (see utils/syncMerge.ts for the rules) ----
  const [bootCache] = useState(readBootCache);
  /** Ids this device has seen in the cloud, per room: only those may disappear without a tombstone. */
  const confirmedRef = useRef<{ room: string; ids: Set<string> } | null>(null);
  /** Collections holding items the cloud lacks; uploaded by the self-heal below. */
  const pendingPushRef = useRef<Set<CollectionKey>>(new Set());
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pushFailuresRef = useRef(0);
  /** Set when the cloud refused a save — shown in the header instead of failing silently. */
  const [syncError, setSyncError] = useState<string | null>(null);

  // Google Drive Cloud State
  const [googleUser, setGoogleUser] = useState<User | any>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('lovesync_gdrive_user');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return null;
  });
  const [isGoogleDriveConnected, setIsGoogleDriveConnected] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return !!localStorage.getItem('lovesync_gdrive_access_token');
    }
    return false;
  });
  const [isGoogleDriveSyncing, setIsGoogleDriveSyncing] = useState<boolean>(false);
  const [googleDriveFolderUrl, setGoogleDriveFolderUrl] = useState<string | null>(() => {
    return localStorage.getItem(`${STORAGE_KEY_PREFIX}gdrive_folder_url`);
  });

  // Listen to Google Auth session on mount and sync user profile with server
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setIsGoogleDriveConnected(true);
      },
      () => {
        // Retain server drive state if already linked
      }
    );

    // Authoritative check with server for account and room status
    const cur = getCurrentAuthUser();
    if (cur?.username) {
      fetchUserLatestProfile(cur.username).then((liveUser) => {
        if (liveUser) {
          setAuthSessionUser(liveUser);
          if (liveUser.partnerUsername) {
            setPartnerAccountInfo({
              username: liveUser.partnerUsername,
              displayName: liveUser.partnerDisplayName,
            });
          } else {
            setPartnerAccountInfo(null);
          }
          // Authoritative profile sync from server
          if (liveUser.profile || liveUser.avatar || liveUser.displayName || liveUser.birthday || liveUser.bio || liveUser.loveQuote) {
            const userProfile = liveUser.profile || {};
            setMyProfileState((prev) => {
              // Third occurrence of the same priority bug already fixed in loginWithGoogle and
              // loginWithUserAccount: this "authoritative check" effect runs on every app mount
              // (not just an explicit login), so even after those two fixes, a custom display
              // name/avatar kept getting silently overwritten back to the raw account
              // displayName/photo moments after every single page load. Custom saved value must
              // win, exactly like the other two spots.
              const updated: CoupleProfile = {
                ...prev,
                ...userProfile,
                name:
                  userProfile.name ||
                  (prev.name && prev.name !== 'Bạn' ? prev.name : null) ||
                  liveUser.displayName ||
                  prev.name,
                avatar:
                  userProfile.avatar ||
                  (prev.avatar && prev.avatar !== DEFAULT_AVATAR_ME ? prev.avatar : null) ||
                  liveUser.avatar ||
                  liveUser.photoURL ||
                  prev.avatar,
                birthday: liveUser.birthday || userProfile.birthday || prev.birthday,
                gender: liveUser.gender || userProfile.gender || prev.gender,
                bio: liveUser.bio || userProfile.bio || prev.bio,
                loveQuote: liveUser.loveQuote || userProfile.loveQuote || prev.loveQuote,
              };
              try {
                localStorage.setItem(`${STORAGE_KEY_PREFIX}my_profile`, JSON.stringify(updated));
              } catch {}
              return updated;
            });
          }

          if (liveUser.roomCode && liveUser.roomCode.trim().toUpperCase() !== settings.roomCode.trim().toUpperCase()) {
            const cleanRoom = liveUser.roomCode.trim().toUpperCase();
            setSettingsState((prev) => {
              const updated = { ...prev, roomCode: cleanRoom };
              try {
                localStorage.setItem(`${STORAGE_KEY_PREFIX}settings`, JSON.stringify(updated));
              } catch {}
              return updated;
            });
          }
        } else {
          // If server restarted and lost user in memory/disk, auto re-sync local account to server instead of wiping local data!
          const storedAccounts = getStoredWebAccounts();
          const localAcc = storedAccounts[cur.username.toLowerCase()];
          if (localAcc) {
            fetch('/api/auth/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                username: localAcc.username,
                password: 'LoveSyncUserPass',
                displayName: localAcc.displayName || localAcc.username,
                birthday: localAcc.birthday || '',
                roomCode: localAcc.roomCode || settings.roomCode,
              }),
            })
              .then(() => {
                // Re-sync local room state to revived server
                broadcastRoomChanges({
                  diaries,
                  photos,
                  cards,
                  anniversaries,
                  plans,
                  datingExpenses,
                  calendarNotes,
                  settings,
                });
              })
              .catch(() => {});
          }
        }
      });
    }

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const roomRef = useRef('');
  roomRef.current = (settings.roomCode || '').toUpperCase().trim();
  const latestCollectionsRef = useRef<Record<CollectionKey, any[]>>({} as Record<CollectionKey, any[]>);
  latestCollectionsRef.current = { diaries, photos, cards, anniversaries, plans, datingExpenses, calendarNotes };
  const broadcastRef = useRef<((partialDoc: Record<string, any>) => void) | null>(null);

  /** The ids this device has seen in the cloud for `room`. */
  const confirmedFor = (room: string): Set<string> => {
    if (confirmedRef.current?.room === room) return confirmedRef.current.ids;
    let ids: Set<string> | null = null;
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}confirmed_${room}`);
      if (saved) ids = new Set<string>(JSON.parse(saved));
    } catch {}
    if (!ids) {
      // First time this version opens the room. Under the old sync the cache was a copy of the
      // cloud, so what it holds counts as seen there — except the last week's writes when the
      // cache is this very room's: those may be exactly the pages that never got uploaded, so
      // they are kept and uploaded rather than written off.
      ids = new Set(bootCache.ids);
      if (bootCache.room === room) bootCache.recent.forEach((id) => ids!.delete(id));
    }
    confirmedRef.current = { room, ids };
    return ids;
  };

  const persistConfirmed = () => {
    const c = confirmedRef.current;
    if (!c) return;
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}confirmed_${c.room}`, JSON.stringify(Array.from(c.ids)));
    } catch {}
  };

  /** The cloud's copy of one collection merged into this device's — nothing undeleted is ever dropped. */
  const mergeFromCloud = <T,>(key: CollectionKey, local: T[], remote: T[], tombstones: Tombstones): T[] => {
    const confirmed = confirmedFor(roomRef.current);
    const result = mergeIncoming(local, remote, tombstones, confirmed);
    result.remoteIds.forEach((id) => confirmed.add(id));
    if (result.unsynced.length > 0) pendingPushRef.current.add(key);
    return result.merged;
  };

  /**
   * Self-heal: anything this device holds that the cloud lacks (a save that failed, or one the
   * other phone overwrote before the merge-on-write existed) is uploaded again, merged in safely.
   * Backs off while saves keep failing so a full or offline room isn't hammered.
   */
  const scheduleSelfHeal = () => {
    if (pushTimerRef.current) return;
    const delay = Math.min(60_000, 2_000 * 2 ** pushFailuresRef.current);
    pushTimerRef.current = setTimeout(() => {
      pushTimerRef.current = null;
      persistConfirmed();
      const keys: CollectionKey[] = Array.from(pendingPushRef.current) as CollectionKey[];
      pendingPushRef.current.clear();
      if (keys.length === 0 || !broadcastRef.current) return;
      const payload: Record<string, any> = {};
      keys.forEach((k) => (payload[k] = latestCollectionsRef.current[k]));
      broadcastRef.current(payload);
    }, delay);
  };

  // Helper to apply incoming cloud/server data cleanly
  const applyIncomingRoomData = useCallback(
    (data: any, source: string) => {
      if (!data) return;

      // Handle automatic room migration from partner
      if (data.migratedTo && data.migratedTo.toUpperCase().trim() !== settings.roomCode.toUpperCase().trim()) {
        const targetRoom = data.migratedTo.toUpperCase().trim();
        console.log(`[SYNC] Room was migrated to "${targetRoom}" by partner (${data.migratedBy || 'partner'}). Auto-switching room...`);
        setSettingsState((prev) => {
          const nextSettings = { ...prev, roomCode: targetRoom };
          try {
            localStorage.setItem(`${STORAGE_KEY_PREFIX}settings`, JSON.stringify(nextSettings));
          } catch {}
          return nextSettings;
        });
        return;
      }

      // Every deletion the room knows about (durable tombstones + the older single-field markers).
      const tombstones = readTombstones(data);

      // 1. Sync Diaries with authoritative remote merge
      if (Array.isArray(data.diaries)) {
        setDiaries((prev) => {
          const merged = mergeFromCloud<DiaryEntry>('diaries', prev, data.diaries, tombstones);
          merged.sort((a, b) => getItemTimestamp(b) - getItemTimestamp(a));
          try {
            localStorage.setItem(`${STORAGE_KEY_PREFIX}diaries`, JSON.stringify(merged));
          } catch {}
          return merged;
        });
      }

      // 2. Sync Photos with authoritative remote merge
      if (Array.isArray(data.photos)) {
        setPhotos((prev) => {
          const merged = mergeFromCloud<PhotoMemory>('photos', prev, data.photos, tombstones);
          merged.sort((a, b) => getItemTimestamp(b) - getItemTimestamp(a));
          try {
            localStorage.setItem(`${STORAGE_KEY_PREFIX}photos`, JSON.stringify(merged));
          } catch {}
          return merged;
        });
      }

      // 3. Sync Cards with authoritative remote merge
      if (Array.isArray(data.cards)) {
        setCards((prev) => {
          const merged = mergeFromCloud<HandwrittenCard>('cards', prev, data.cards, tombstones);
          merged.sort((a, b) => getItemTimestamp(b) - getItemTimestamp(a));
          try {
            localStorage.setItem(`${STORAGE_KEY_PREFIX}cards`, JSON.stringify(merged));
          } catch {}
          return merged;
        });
      }

      // 4. Sync Anniversaries with authoritative remote merge
      if (Array.isArray(data.anniversaries)) {
        setAnniversaries((prev) => {
          const merged = mergeFromCloud<AnniversaryEvent>('anniversaries', prev, data.anniversaries, tombstones);
          try {
            localStorage.setItem(`${STORAGE_KEY_PREFIX}anniversaries`, JSON.stringify(merged));
          } catch {}
          return merged;
        });
      }

      // 4a. Sync trip / date plans
      if (Array.isArray(data.plans)) {
        setPlans((prev) => {
          const merged = mergeFromCloud<TripPlan>('plans', prev, data.plans, tombstones);
          try {
            localStorage.setItem(`${STORAGE_KEY_PREFIX}plans`, JSON.stringify(merged));
          } catch {}
          return merged;
        });
      }

      // 4a'. Sync Dating Fees
      if (Array.isArray(data.datingExpenses)) {
        setDatingExpenses((prev) => {
          const merged = mergeFromCloud<DatingExpense>('datingExpenses', prev, data.datingExpenses, tombstones);
          try {
            localStorage.setItem(`${STORAGE_KEY_PREFIX}datingExpenses`, JSON.stringify(merged));
          } catch {}
          return merged;
        });
      }

      // 4a''. Sync calendar notes
      if (Array.isArray(data.calendarNotes)) {
        setCalendarNotes((prev) => {
          const merged = mergeFromCloud<CalendarNote>('calendarNotes', prev, data.calendarNotes, tombstones);
          try {
            localStorage.setItem(`${STORAGE_KEY_PREFIX}calendarNotes`, JSON.stringify(merged));
          } catch {}
          return merged;
        });
      }

      // 4b. Sync Playlist — filter out anything removed here within the last
      // REMOVED_PLAYLIST_ID_TTL_MS so a stale/racy read (the delete's own Firestore write hadn't
      // landed yet, or a snapshot arrived out of order) can't resurrect a track just deleted.
      // Expired entries are pruned first — see removedPlaylistIdsRef's declaration for why this
      // must never be a permanent blacklist.
      if (Array.isArray(data.playlist)) {
        pruneAndPersistRemovedPlaylistIds();
        const incomingPlaylist = removedPlaylistIdsRef.current.size > 0
          ? data.playlist.filter((t: any) => !t?.id || !removedPlaylistIdsRef.current.has(t.id))
          : data.playlist;
        setRoomPlaylist(incomingPlaylist);
        try {
          localStorage.setItem('lovesync_full_playlist_v3', JSON.stringify(incomingPlaylist));
        } catch {}
      }

      // 4c. Sync Albums — same tombstone-filtered whole-array sync as playlist above. This used
      // to only ever write to localStorage with no reactive state for PhotoAlbumView to read, so
      // an incoming update from the room never actually reached the UI at all. Deliberately no
      // "> 0" length guard here: a legitimate delete-down-to-zero (or a fresh scan on one device)
      // must still reach the other device instead of getting silently stuck — the tombstone map
      // above is what actually protects against a stale/racy read resurrecting a just-deleted item.
      if (Array.isArray(data.albums)) {
        pruneAndPersistRemovedAlbumIds();
        const incomingAlbums = removedAlbumIdsRef.current.size > 0
          ? data.albums.filter((a: any) => !a?.id || !removedAlbumIdsRef.current.has(a.id))
          : data.albums;
        setRoomAlbums(incomingAlbums);
        try {
          localStorage.setItem('lovesync_custom_albums_v2', JSON.stringify(incomingAlbums));
        } catch {}
      }

      // 5. Sync Settings
      if (data.settings && typeof data.settings === 'object') {
        setSettingsState((prev) => {
          // The partner's look-and-feel is dropped here, so their theme never overrides this one.
          const merged = { ...prev, ...stripPersonalSettings(data.settings), roomCode: prev.roomCode };
          try {
            localStorage.setItem(`${STORAGE_KEY_PREFIX}settings`, JSON.stringify(merged));
          } catch {}
          return merged;
        });
      }

      // 6. Partner Profile & Online presence
      if (data.profiles && typeof data.profiles === 'object') {
        // `profiles` is only ever merged into, never pruned, so a room that has seen a guest
        // session, a re-login, or an old device can end up with more than one non-self key. Just
        // taking the first such key risked picking a stale leftover profile instead of the
        // partner's current one — e.g. showing their old avatar forever, even after they update
        // it, because the update lands under a different (correct) key than the one being read.
        // Always pick whichever non-self entry was active most recently.
        const candidateIds = Object.keys(data.profiles).filter((id) => id !== myUserId);
        const partnerId =
          candidateIds.length <= 1
            ? candidateIds[0]
            : candidateIds.reduce((freshest, id) =>
                (data.profiles[id]?.lastActive || 0) > (data.profiles[freshest]?.lastActive || 0) ? id : freshest
              );
        if (partnerId && data.profiles[partnerId]) {
          const p = data.profiles[partnerId];
          setPartnerProfileState(p);
          try {
            localStorage.setItem(`${STORAGE_KEY_PREFIX}partner_profile`, JSON.stringify(p));
          } catch {}

          const nowTime = Date.now();
          setIsPartnerOnline(nowTime - (p.lastActive || 0) < 60000);
        } else {
          setIsPartnerOnline(false);
          setIsPartnerTyping(false);
        }
      } else {
        setIsPartnerOnline(false);
        setIsPartnerTyping(false);
      }

      // 7. Pulse
      if (data.lastActivePulse && typeof data.lastActivePulse === 'object') {
        const pulse = data.lastActivePulse;
        if (pulse.senderId !== myUserId && pulse.timestamp > lastProcessedPulseRef.current) {
          lastProcessedPulseRef.current = pulse.timestamp;
          const senderName = pulse.senderName || 'Người yêu';
          if (pulse.type === 'diary') soundService.playPaperOpen();
          else soundService.playHeartbeat();
          setIncomingHeartbeat({
            senderId: pulse.senderId,
            senderName,
            type: pulse.type || 'heart',
            timestamp: pulse.timestamp,
            message: pulse.message,
            diaryDate: pulse.diaryDate,
          });
          // The in-app card only helps if the app is on screen; otherwise ask the browser to say it.
          notifyInBrowser(
            pulse.type === 'diary' ? `${senderName} vừa viết xong nhật ký 📖` : `${senderName} vừa gửi yêu thương 💖`,
            pulse.message || ''
          );
        }
      }

      // 8. Typing status
      if (data.typingStatus && typeof data.typingStatus === 'object') {
        const partnerTypingId = Object.keys(data.typingStatus).find((id) => id !== myUserId);
        if (partnerTypingId) {
          setIsPartnerTyping(!!data.typingStatus[partnerTypingId]);
        }
      }

      setLastSyncedAt(data.updatedAt || Date.now());
      setSyncStatus('connected');
      scheduleSelfHeal();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [myUserId, settings.roomCode]
  );

  /** Incoming room data with its image references resolved back into images, then applied. */
  const ingestRoomData = useCallback(
    (data: any, source: string) => {
      if (!data) return;
      resolveImageRefs(data, roomRef.current)
        .then((resolved) => applyIncomingRoomData(resolved, source))
        .catch(() => applyIncomingRoomData(data, source));
    },
    [applyIncomingRoomData]
  );

  // Push updates to Firestore Cloud Real-time & Express REST Backend
  const broadcastRoomChanges = useCallback(
    async (partialDoc: Record<string, any>, overrideProfile?: CoupleProfile) => {
      const nowTime = Date.now();
      lastKnownServerTimeRef.current = nowTime;
      const cleanRoom = settings.roomCode.toUpperCase().trim();
      const profileToSend = overrideProfile || myProfileRef.current;

      const payload: Record<string, any> = {
        ...partialDoc,
        roomCode: cleanRoom,
        updatedAt: nowTime,
      };

      if (profileToSend) {
        payload.profiles = {
          ...(partialDoc.profiles || {}),
          [myUserId]: {
            ...profileToSend,
            id: myUserId,
            lastActive: nowTime,
          },
        };
      }

      // 1. Firestore (the live sync on GitHub Pages).
      //
      // Shared lists are never written as a whole any more: setDoc with a list REPLACES the list,
      // so a phone holding a slightly stale copy used to erase whatever the other phone had just
      // saved. Now a transaction reads the room's current lists and merges this phone's into them
      // item by item (newest copy of each item wins, deleted ones stay deleted), then writes.
      // Big inline images go to their own documents first (services/blobStore) so the room
      // document stays well under Firestore's 1 MiB cap. A failed save is reported, not swallowed,
      // and the self-heal retries it — the data meanwhile stays safe on this phone.
      if (cleanRoom) {
        const roomDocRef = doc(db, 'rooms', cleanRoom);
        const collectionKeys = COLLECTION_KEYS.filter((k) => Array.isArray(payload[k]));
        const newTombstones: Tombstones = {};
        if (typeof payload.deletedId === 'string' && payload.deletedId) newTombstones[payload.deletedId] = nowTime;
        if (Array.isArray(payload.deletedItemIds)) payload.deletedItemIds.forEach((id: unknown) => typeof id === 'string' && (newTombstones[id] = nowTime));
        const touchesLists = collectionKeys.length > 0 || Object.keys(newTombstones).length > 0;

        const write = async () => {
          const safe = await offloadInlineImages(payload, cleanRoom);
          if (!touchesLists) {
            await setDoc(roomDocRef, safe, { merge: true });
            return;
          }
          await runTransaction(db, async (tx) => {
            const snap = await tx.get(roomDocRef);
            const current: Record<string, any> = snap.exists() ? snap.data() : {};
            const tombstones = { ...readTombstones(current), ...newTombstones };
            const out: Record<string, any> = { ...safe };
            for (const key of collectionKeys) out[key] = mergeCollections(current[key] || [], safe[key], tombstones);
            if (Object.keys(newTombstones).length > 0) out.tombstones = newTombstones; // merged into the map, not replacing it
            // Older app versions left big inline images all over the room document — maybe enough to
            // have filled it. Move every one of them out now, including in lists and profiles this
            // save doesn't touch, so this very write is the one that frees the room up again.
            for (const key of COLLECTION_KEYS as readonly string[]) {
              if (out[key] === undefined && current[key] !== undefined && JSON.stringify(current[key]).includes('data:')) out[key] = current[key];
            }
            if (current.profiles && JSON.stringify(current.profiles).includes('data:')) out.profiles = { ...current.profiles, ...(out.profiles || {}) };
            tx.set(roomDocRef, await offloadInlineImages(out, cleanRoom), { merge: true });
          });
        };

        // A transaction keeps retrying while the connection is down rather than failing, so say
        // something if a save hasn't gone through after a few seconds — it will still finish later.
        const slowNotice = setTimeout(
          () => setSyncError('Chưa gửi được lên mây (mất mạng hoặc kết nối chập chờn). Bản mới vẫn đang được giữ trên máy này và sẽ tự gửi lại.'),
          8000
        );
        write()
          .finally(() => clearTimeout(slowNotice))
          .then(() => {
            pushFailuresRef.current = 0;
            setSyncError(null);
            setSyncStatus('connected');
            setLastSyncedAt(nowTime);
          })
          .catch((err: any) => {
            const text = `${err?.code || ''} ${err?.message || err}`;
            console.warn('[SYNC] Cloud save failed — kept on this device, will retry:', text);
            const tooBig = /maximum|exceed|too large|1048576|invalid-argument/i.test(text);
            setSyncError(
              tooBig
                ? 'Dữ liệu của phòng đã chạm giới hạn 1MB của Firestore nên chưa lưu lên mây được. Bản mới vẫn đang được giữ an toàn trên máy này.'
                : 'Chưa gửi được lên mây (mất mạng hoặc kết nối chập chờn). Bản mới vẫn đang được giữ trên máy này và sẽ tự gửi lại.'
            );
            collectionKeys.forEach((k) => pendingPushRef.current.add(k));
            pushFailuresRef.current = Math.min(pushFailuresRef.current + 1, 5);
            scheduleSelfHeal();
          });
      }

      // 2. Express Server Broadcast (if running in fullstack mode)
      try {
        const res = await fetch(`/api/room/${encodeURIComponent(cleanRoom)}/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: myUserId,
            profile: profileToSend,
            state: payload,
          }),
        });
        const result = await res.json().catch(() => null);
        if (result && result.success) {
          setSyncStatus('connected');
          setLastSyncedAt(nowTime);
          if (result.room) {
            ingestRoomData(result.room, 'sync_ack');
          }
        }
      } catch (e) {}
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings.roomCode, myUserId, ingestRoomData]
  );
  broadcastRef.current = broadcastRoomChanges;

  // Deletes are tracked in removedPlaylistIdsRef for a short TTL only — see that ref's own
  // declaration for the full reasoning (an earlier permanent-tombstone version ended up
  // blacklisting every built-in track id after enough delete/reset cycles, since those use fixed
  // ids that DEFAULT_PLAYLIST can legitimately reintroduce).
  //
  // This must be declared with broadcastRoomChanges in its dependency array (not `[]`) — an
  // earlier version used `[]`, permanently pinning it to whatever broadcastRoomChanges (and the
  // roomCode/myUserId it closed over) looked like on the very first render. Once the user actually
  // paired up and roomCode changed to the real shared room, every playlist add/remove kept quietly
  // broadcasting to the stale old room instead, so the partner never saw any playlist change at
  // all — the reported "xóa nhạc không đồng bộ vào room" bug.
  const updateRoomPlaylist = useCallback(
    (newPlaylist: any[], removedId?: string) => {
      if (removedId) {
        removedPlaylistIdsRef.current.set(removedId, Date.now());
        pruneAndPersistRemovedPlaylistIds();
      }
      hasUserMutatedRef.current = true;
      setRoomPlaylist(newPlaylist);
      try {
        localStorage.setItem('lovesync_full_playlist_v3', JSON.stringify(newPlaylist));
      } catch {}
      broadcastRoomChanges({ playlist: newPlaylist });
    },
    [broadcastRoomChanges]
  );

  // Same shape/reasoning as updateRoomPlaylist just above (must depend on broadcastRoomChanges,
  // not `[]`, or it goes stale the moment the room code changes after pairing).
  const updateRoomAlbums = useCallback(
    (newAlbums: any[], removedId?: string) => {
      if (removedId) {
        removedAlbumIdsRef.current.set(removedId, Date.now());
        pruneAndPersistRemovedAlbumIds();
      }
      hasUserMutatedRef.current = true;
      setRoomAlbums(newAlbums);
      try {
        localStorage.setItem('lovesync_custom_albums_v2', JSON.stringify(newAlbums));
      } catch {}
      broadcastRoomChanges({ albums: newAlbums });
    },
    [broadcastRoomChanges]
  );

  // REALTIME CLOUD SYNC & REST POLLING (Guarantees Instant Sync on GitHub Pages & Fullstack)
  useEffect(() => {
    if (!isAuthenticated || !settings.roomCode || settings.roomCode.trim().length === 0) {
      setSyncStatus('offline');
      return;
    }

    const cleanRoom = settings.roomCode.toUpperCase().trim();
    let isMounted = true;

    // 1. Firestore Real-time Subscription (Live sync on GitHub Pages without server)
    let unsubscribeFirestore: (() => void) | null = null;
    try {
      const roomDocRef = doc(db, 'rooms', cleanRoom);
      unsubscribeFirestore = onSnapshot(
        roomDocRef,
        (docSnap) => {
          if (!isMounted) return;
          if (docSnap.exists()) {
            const remoteData = docSnap.data();
            ingestRoomData(remoteData, 'firestore_realtime');
            setSyncStatus('connected');
            setLastSyncedAt(remoteData.updatedAt || Date.now());
          }
        },
        (error) => {
          console.warn('[Firestore] Realtime subscription notice:', error);
        }
      );
    } catch (e) {
      console.warn('[Firestore] Init notice:', e);
    }

    // 2. Express REST Polling fallback (only relevant when running the fullstack Node server —
    // on static hosting like GitHub Pages this endpoint never exists, so stop polling it after a
    // few consecutive failures instead of hitting a 404 every 3s forever. Firestore realtime sync
    // above already covers GitHub Pages / static hosting on its own.
    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 3;
    let interval: ReturnType<typeof setInterval> | null = null;

    const fetchServerState = async () => {
      try {
        const res = await fetch(`/api/room/${encodeURIComponent(cleanRoom)}/state?t=${Date.now()}`, {
          cache: 'no-store',
        });
        if (!res.ok) {
          consecutiveFailures++;
        } else {
          consecutiveFailures = 0;
          const data = await res.json().catch(() => null);
          if (isMounted && data && data.success) {
            if (data.exists && data.room) {
              ingestRoomData(data.room, 'express_rest');
            } else {
              setIsPartnerOnline(false);
              setIsPartnerTyping(false);
            }
          }
        }
      } catch (err) {
        consecutiveFailures++;
      }

      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES && interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    fetchServerState();
    interval = setInterval(fetchServerState, 3000);

    // 3. Firestore fallback re-fetch (self-heal without needing a manual F5). onSnapshot's
    // underlying long-polling/WebChannel connection can occasionally go quiet — a backgrounded
    // tab being throttled, a network blip it doesn't cleanly recover from — with no visible
    // error, since the (error) callback above only fires on an outright failure, not a silent
    // stall. This does a plain one-off read every few seconds as a tight safety net; if
    // onSnapshot is healthy this is a harmless no-op (same data back), but if it ever stalls,
    // the room self-corrects almost immediately instead of staying stuck until the user thinks
    // to reload the page. Kept short (not 20s+) so any gap in the primary channel is never
    // noticeable as a "have to refresh" moment.
    const firestoreFallbackInterval = setInterval(async () => {
      if (!isMounted) return;
      try {
        const snap = await getDoc(doc(db, 'rooms', cleanRoom));
        if (isMounted && snap.exists()) {
          ingestRoomData(snap.data(), 'firestore_fallback_poll');
        }
      } catch (err) {
        console.warn('[Firestore] Fallback poll notice:', err);
      }
    }, 3000);

    return () => {
      isMounted = false;
      if (unsubscribeFirestore) unsubscribeFirestore();
      if (interval) clearInterval(interval);
      clearInterval(firestoreFallbackInterval);
    };
  }, [isAuthenticated, settings.roomCode, ingestRoomData]);


  // Heartbeat presence ping (sent to Firestore & Express Server)
  useEffect(() => {
    if (!isAuthenticated || !settings.roomCode || settings.roomCode.trim().length === 0) {
      return;
    }

    const cleanRoom = settings.roomCode.toUpperCase().trim();
    const pingPresence = async () => {
      const nowTime = Date.now();
      try {
        const roomDocRef = doc(db, 'rooms', cleanRoom);
        // Avatars are often a raw base64 data: URL. Inline in the room document they eat into
        // Firestore's 1MiB cap (and two of them every 20s), so they go through the image store
        // like everything else; if that upload fails the ping just leaves the avatar out.
        let safeAvatar: string | undefined;
        try {
          safeAvatar = await offloadInlineImages(myProfile.avatar, cleanRoom);
        } catch {
          safeAvatar = undefined;
        }
        // IMPORTANT: setDoc (unlike updateDoc) does NOT treat a top-level key containing dots
        // ("profiles.<id>.lastActive") as a nested field path — it creates a literal field
        // whose *name* contains those dots. That silently broke partner pairing entirely: the
        // app always reads a nested `profiles` map, which never actually got created this way,
        // so it could never find the partner's entry. A plain nested object is what actually
        // produces (and merges into) a real `profiles.{myUserId}` map entry.
        setDoc(
          roomDocRef,
          {
            profiles: {
              [myUserId]: {
                lastActive: nowTime,
                name: myProfile.name,
                avatar: safeAvatar,
              },
            },
          },
          { merge: true }
        ).catch(() => {});
      } catch {}

      try {
        fetch(`/api/room/${encodeURIComponent(cleanRoom)}/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: myUserId,
            profile: myProfile,
            state: {
              roomCode: cleanRoom,
            },
          }),
        }).catch(() => {});
      } catch {}
    };

    pingPresence();
    const interval = setInterval(pingPresence, 20000);
    return () => clearInterval(interval);
  }, [isAuthenticated, settings.roomCode, myUserId, myProfile]);

  // Connect Google Drive — used exclusively to authorize photo uploads in the album (see
  // PhotoAlbumView). No app data other than the uploaded image files ever goes to Drive.
  const connectGoogleDrive = useCallback(async (): Promise<boolean> => {
    try {
      setIsGoogleDriveSyncing(true);
      const res = await googleSignIn();
      if (!res) {
        // User closed or cancelled popup
        return false;
      }
      if (res?.user && res.accessToken) {
        setGoogleUser(res.user);
        setIsGoogleDriveConnected(true);
        try {
          const folderId = await findOrCreateAppFolder(res.accessToken);
          const folderUrl = `https://drive.google.com/drive/folders/${folderId}`;
          setGoogleDriveFolderUrl(folderUrl);
          localStorage.setItem(`${STORAGE_KEY_PREFIX}gdrive_folder_url`, folderUrl);
        } catch (err) {
          console.warn('Could not resolve Google Drive folder URL:', err);
        }
        return true;
      }
      return false;
    } catch (err: any) {
      console.error('Connect Google Drive error:', err);
      throw err;
    } finally {
      setIsGoogleDriveSyncing(false);
    }
  }, []);

  // Disconnect Google Drive
  const disconnectGoogleDrive = useCallback(async () => {
    await googleLogout();
    setGoogleUser(null);
    setIsGoogleDriveConnected(false);
  }, []);

  // Days-together counter. Deliberately coarse (ticks once a minute, not every second) — this
  // value lives in the shared app context, so a 1s interval here would re-render every screen of
  // the app every second. Components that need a live seconds-ticking countdown (Header,
  // AnniversaryView) use the self-contained `useLoveDuration` hook instead, which only re-renders
  // that one component each second.
  const [dayTick, setDayTick] = useState<number>(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setDayTick(Date.now()), 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const daysInLove = useMemo(() => {
    if (!settings.coupleStartDate || !settings.coupleStartDate.trim()) return 0;
    const start = new Date(settings.coupleStartDate).getTime();
    if (isNaN(start)) return 0;
    return Math.floor(Math.max(0, dayTick - start) / (1000 * 60 * 60 * 24));
  }, [settings.coupleStartDate, dayTick]);

  // Sound toggle
  useEffect(() => {
    soundService.setEnabled(settings.soundEnabled);
  }, [settings.soundEnabled]);

  // Theme & Dark mode with cross-platform (iOS Safari & Android Chrome) meta-tag and body styling
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    if (settings.isDarkMode) {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
      body.style.backgroundColor = '#151019';
      body.style.color = '#f4effa';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
      body.style.backgroundColor = '#FFF5F7';
      body.style.color = '#4A4A4A';
    }
    root.setAttribute('data-theme', settings.theme);

    // Update meta theme-color for mobile browser status bar
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', settings.isDarkMode ? '#151019' : '#FFF5F7');
    }
  }, [settings.isDarkMode, settings.theme]);

  // Manual Trigger to re-fetch room state from Firestore Cloud or Express Server
  const syncNow = useCallback(async (): Promise<boolean> => {
    soundService.playPop();
    setSyncStatus('connecting');
    const cleanRoom = settings.roomCode.toUpperCase().trim();
    let hasLoaded = false;

    // 1. Try Firestore Cloud Doc first
    try {
      if (cleanRoom) {
        const roomDocSnap = await getDoc(doc(db, 'rooms', cleanRoom));
        if (roomDocSnap.exists()) {
          ingestRoomData(roomDocSnap.data(), 'manual_sync_firestore');
          hasLoaded = true;
        }
      }
    } catch (e) {}

    // 2. Try Express REST API
    try {
      const res = await fetch(`/api/room/${encodeURIComponent(cleanRoom)}/state`);
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && data.success && data.exists && data.room) {
          ingestRoomData(data.room, 'manual_sync_express');
          hasLoaded = true;
        }
      }
    } catch (e) {}

    if (hasLoaded) {
      soundService.playSparkle();
      setSyncStatus('connected');
      setLastSyncedAt(Date.now());
      return true;
    }

    setSyncStatus('connected');
    return true;
  }, [settings.roomCode, ingestRoomData]);

  // 4. Polling user account for automatic partner updates and partner room migrations
  useEffect(() => {
    let isMounted = true;
    const checkAccountSync = async () => {
      const authUser = getCurrentAuthUser();
      if (!authUser || !authUser.username) return;

      try {
        const latest = await fetchUserLatestProfile(authUser.username);
        if (!latest || !isMounted) return;

        // Auto switch room if account's room was updated (e.g. partner changed room)
        if (latest.roomCode && latest.roomCode.toUpperCase().trim() !== settings.roomCode.toUpperCase().trim()) {
          const target = latest.roomCode.toUpperCase().trim();
          console.log(`[AUTH-SYNC] User account room changed to "${target}". Updating app room code...`);
          setSettingsState((prev) => {
            const next = { ...prev, roomCode: target };
            try {
              localStorage.setItem(`${STORAGE_KEY_PREFIX}settings`, JSON.stringify(next));
            } catch {}
            return next;
          });
        }

        // Update partner account info
        if (latest.partnerUsername) {
          setPartnerAccountInfo({
            username: latest.partnerUsername,
            displayName: latest.partnerDisplayName,
          });
        } else {
          setPartnerAccountInfo(null);
        }
      } catch (err) {}
    };

    checkAccountSync();
    const interval = setInterval(checkAccountSync, 4500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [settings.roomCode]);

  // Switch or Join a different Room Code
  const setRoomCode = useCallback((newCode: string) => {
    const cleanCode = (newCode || 'LOVE-8888').toUpperCase().trim();
    soundService.playPop();

    // Immediately reset partner state when switching room manually
    setPartnerProfileState(null);
    try {
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}partner_profile`);
    } catch {}
    setIsPartnerOnline(false);
    setIsPartnerTyping(false);
    setIncomingHeartbeat(null);

    setSettingsState((prev) => {
      const nextSettings = { ...prev, roomCode: cleanCode };
      try {
        localStorage.setItem(`${STORAGE_KEY_PREFIX}settings`, JSON.stringify(nextSettings));
      } catch {}
      return nextSettings;
    });
  }, []);

  // Change room code with partner migration and cloud sync
  const changeCoupleRoomCode = useCallback(
    async (newCode: string, migratePartner: boolean = true): Promise<boolean> => {
      const cleanCode = (newCode || 'LOVE-8888').toUpperCase().trim();
      const oldCode = settings.roomCode.toUpperCase().trim();
      if (cleanCode === oldCode) return true;

      soundService.playSparkle();

      // Clear partner state immediately if not migrating partner or if not paired
      if (!migratePartner || !partnerAccountInfo) {
        setPartnerProfileState(null);
        try {
          localStorage.removeItem(`${STORAGE_KEY_PREFIX}partner_profile`);
        } catch {}
        setIsPartnerOnline(false);
        setIsPartnerTyping(false);
        setIncomingHeartbeat(null);
      }

      // 1. requestChangeRoomCode only repoints the ACCOUNT records (users/{username}.roomCode)
      // at the new code — it never touches the room documents themselves. Without copying the
      // actual room content across, the new room starts completely empty on Firestore: the
      // partner (who always reads straight from Firestore) sees nothing migrate over, while the
      // switching device itself still shows everything because the sync merge keeps its own
      // in-memory cache — making it look like the migration worked when it
      // silently didn't. Write this device's current room content into the new room doc first.
      try {
        const newRoomDocRef = doc(db, 'rooms', cleanCode);
        const migratedPayload = await offloadInlineImages({
          roomCode: cleanCode,
          diaries,
          photos,
          cards,
          anniversaries,
          plans,
          datingExpenses,
          calendarNotes,
          settings: { ...stripPersonalSettings(settings), roomCode: cleanCode },
          profiles: {
            [myUserId]: { ...myProfileRef.current, id: myUserId, lastActive: Date.now() },
          },
          updatedAt: Date.now(),
        }, cleanCode);
        await setDoc(newRoomDocRef, migratedPayload, { merge: true });
      } catch (err) {
        console.warn('Room data migration error:', err);
      }

      // 2. Call server API to perform any server-side migration or separation bookkeeping
      // (account roomCode repointing) — best-effort, harmless no-op on static hosting.
      try {
        await requestChangeRoomCode(oldCode, cleanCode, myUserId, migratePartner);
      } catch (err) {
        console.warn('requestChangeRoomCode error:', err);
      }

      // 3. Update local state
      hasUserMutatedRef.current = false;
      setSettingsState((prev) => {
        const nextSettings = { ...prev, roomCode: cleanCode };
        try {
          localStorage.setItem(`${STORAGE_KEY_PREFIX}settings`, JSON.stringify(nextSettings));
        } catch {}
        return nextSettings;
      });

      return true;
    },
    [settings, myUserId, partnerAccountInfo, diaries, photos, cards, anniversaries, plans]
  );

  // Leave room / disconnect from current room and start fresh private room
  const leaveCoupleRoom = useCallback(async () => {
    soundService.playPop();
    const oldCode = settings.roomCode.toUpperCase().trim();
    const authUser = getCurrentAuthUser();
    const cleanUser = authUser?.username || '';
    const newPrivateCode = cleanUser
      ? `ROOM-${cleanUser.toUpperCase().replace(/[^A-Z0-9]/g, '')}`
      : `LOVE-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    // 1. Clear partner state on frontend immediately
    setPartnerProfileState(null);
    try {
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}partner_profile`);
    } catch {}
    setPartnerAccountInfo(null);
    setIsPartnerOnline(false);
    setIsPartnerTyping(false);
    setIncomingHeartbeat(null);

    // 1b. Clear this device's local cache of the old room's content. The old room's data on
    // Firestore is untouched (nothing is deleted there), but without clearing local state here,
    // the sync merge would keep showing the old room's diaries/photos/cards on this
    // device even after switching to a brand-new, genuinely empty private room — and any new
    // mutation made from that stale view would leak the old room's data into the new one.
    hasUserMutatedRef.current = false;
    pendingPushRef.current.clear();
    confirmedRef.current = null;
    setDiaries([]);
    setPhotos([]);
    setCards([]);
    setAnniversaries([]);
    setPlans([]);
    setDatingExpenses([]);
    setCalendarNotes([]);
    try {
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}calendarNotes`);
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}plans`);
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}datingExpenses`);
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}diaries`);
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}photos`);
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}cards`);
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}anniversaries`);
    } catch {}

    // 2. Notify server to remove this user from the old room
    try {
      await leaveRoomService(oldCode, myUserId, cleanUser);
    } catch {}

    // 3. Switch to new private room
    setSettingsState((prev) => {
      const next = { ...prev, roomCode: newPrivateCode };
      try {
        localStorage.setItem(`${STORAGE_KEY_PREFIX}settings`, JSON.stringify(next));
      } catch {}
      return next;
    });

    if (cleanUser) {
      const accounts = getStoredWebAccounts();
      if (accounts[cleanUser]) {
        accounts[cleanUser].roomCode = newPrivateCode;
        delete accounts[cleanUser].partnerUsername;
        delete accounts[cleanUser].partnerDisplayName;
        saveStoredWebAccounts(accounts);
      }
      localStorage.setItem(
        'lovesync_auth_user',
        JSON.stringify({
          ...authUser,
          roomCode: newPrivateCode,
          partnerUsername: undefined,
          partnerDisplayName: undefined,
        })
      );
    }
  }, [settings.roomCode, myUserId]);

  // Link partner account (1-to-1)
  const linkPartnerAccount = useCallback(
    async (partnerUsername: string): Promise<boolean> => {
      soundService.playSparkle();
      const result = await linkPartnerAccountService(partnerUsername);
      if (result.partner) {
        setPartnerAccountInfo({
          username: result.partner.username,
          displayName: result.partner.displayName,
          birthday: result.partner.birthday,
        });
      }
      if (result.roomCode && result.roomCode.toUpperCase().trim() !== settings.roomCode.toUpperCase().trim()) {
        setRoomCode(result.roomCode);
      }
      return true;
    },
    [settings.roomCode, setRoomCode]
  );

  // Unlink partner account (clean separation, resets room and clears partner from header)
  const unlinkPartnerAccount = useCallback(async () => {
    soundService.playPop();
    const authUser = getCurrentAuthUser();
    const cleanUser = authUser?.username || '';
    // Capture before clearing partnerAccountInfo below — needed to clean up their account record
    // too (see unlinkPartnerAccountService: unlinking used to only touch this user's own account,
    // leaving the partner's still pointing back at them as if nothing had changed).
    const partnerUsernameToClear = partnerAccountInfo?.username;

    // 1. Immediately clear all partner state from UI and storage
    setPartnerProfileState(null);
    try {
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}partner_profile`);
    } catch {}
    setPartnerAccountInfo(null);
    setIsPartnerOnline(false);
    setIsPartnerTyping(false);
    setIncomingHeartbeat(null);

    // 2. Call backend service to separate accounts into distinct rooms and remove profiles
    const result = await unlinkPartnerAccountService(myUserId, settings.roomCode, partnerUsernameToClear);
    const newRoom = result.newRoomCode || (cleanUser ? `ROOM-${cleanUser.toUpperCase()}` : `LOVE-${Math.random().toString(36).substring(2, 7).toUpperCase()}`);

    // 3. Update local settings to new private room
    setSettingsState((prev) => {
      const nextSettings = { ...prev, roomCode: newRoom };
      try {
        localStorage.setItem(`${STORAGE_KEY_PREFIX}settings`, JSON.stringify(nextSettings));
      } catch {}
      return nextSettings;
    });
  }, [settings.roomCode, myUserId, partnerAccountInfo]);

  // Update profile
  const updateMyProfile = useCallback(
    (updates: Partial<CoupleProfile>) => {
      setMyProfileState((prev) => {
        const updated = { ...prev, ...updates, id: myUserId, lastActive: Date.now() };
        myProfileRef.current = updated;
        try {
          localStorage.setItem(`${STORAGE_KEY_PREFIX}my_profile`, JSON.stringify(updated));

          // Also update web stored account record and server account if logged in
          const current = getCurrentAuthUser();
          if (current?.username) {
            updateUserProfileOnServer(current.username, updated);
            const accounts = getStoredWebAccounts();
            if (accounts[current.username]) {
              if (updates.name) accounts[current.username].displayName = updates.name;
              if (updates.birthday) accounts[current.username].birthday = updates.birthday;
              if (updates.avatar) accounts[current.username].photoURL = updates.avatar;
              accounts[current.username].updatedAt = Date.now();
              saveStoredWebAccounts(accounts);
            }
          }
        } catch {}

        broadcastRoomChanges(
          {
            profiles: {
              [myUserId]: updated,
            },
          },
          updated
        );
        return updated;
      });
    },
    [myUserId, broadcastRoomChanges]
  );

  // Update Settings
  const updateSettings = useCallback(
    (newSettings: Partial<CoupleSettings>) => {
      setSettingsState((prev) => {
        const updated = { ...prev, ...newSettings };
        try {
          localStorage.setItem(`${STORAGE_KEY_PREFIX}settings`, JSON.stringify(updated));
        } catch {}
        // How the app LOOKS belongs to whoever is holding the phone, so it is kept out of the room:
        // picking a background never repaints the partner's app (see PERSONAL_SETTING_KEYS).
        broadcastRoomChanges({ settings: stripPersonalSettings(updated) });
        return updated;
      });
    },
    [broadcastRoomChanges]
  );

  // Diary Actions
  const addDiary = useCallback(
    (diary: Omit<DiaryEntry, 'id' | 'createdAt' | 'updatedAt' | 'authorId' | 'authorName' | 'reactions' | 'comments'>) => {
      hasUserMutatedRef.current = true;
      const nowTime = Date.now();
      const newEntry: DiaryEntry = {
        ...diary,
        id: `diary_${nowTime}_${Math.random().toString(36).substring(2, 6)}`,
        authorId: myUserId,
        authorName: myProfile.name,
        authorAvatar: myProfile.avatar,
        reactions: {},
        comments: [],
        createdAt: nowTime,
        updatedAt: nowTime,
      };

      setDiaries((prev) => {
        const next = [newEntry, ...prev.filter((d) => d.id !== newEntry.id)];
        try {
          localStorage.setItem(`${STORAGE_KEY_PREFIX}diaries`, JSON.stringify(next));
        } catch {}
        broadcastRoomChanges({ diaries: next });
        return next;
      });
    },
    [myUserId, myProfile.name, myProfile.avatar, broadcastRoomChanges]
  );

  const updateDiary = useCallback(
    (id: string, updates: Partial<DiaryEntry>) => {
      hasUserMutatedRef.current = true;
      setDiaries((prev) => {
        const next = prev.map((d) => (d.id === id ? { ...d, ...updates, updatedAt: Date.now() } : d));
        try {
          localStorage.setItem(`${STORAGE_KEY_PREFIX}diaries`, JSON.stringify(next));
        } catch {}
        broadcastRoomChanges({ diaries: next });
        return next;
      });
    },
    [broadcastRoomChanges]
  );

  const deleteDiary = useCallback(
    (id: string) => {
      hasUserMutatedRef.current = true;
      setDiaries((prev) => {
        const next = prev.filter((d) => d.id !== id);
        try {
          localStorage.setItem(`${STORAGE_KEY_PREFIX}diaries`, JSON.stringify(next));
        } catch {}
        broadcastRoomChanges({ diaries: next, deletedId: id });
        return next;
      });
    },
    [broadcastRoomChanges]
  );

  const deleteAllDayDiaries = useCallback(
    (date: string) => {
      hasUserMutatedRef.current = true;
      setDiaries((prev) => {
        const removedIds = prev.filter((d) => d.date === date).map((d) => d.id);
        const next = prev.filter((d) => d.date !== date);
        try {
          localStorage.setItem(`${STORAGE_KEY_PREFIX}diaries`, JSON.stringify(next));
        } catch {}
        broadcastRoomChanges({ diaries: next, deletedItemIds: removedIds });
        return next;
      });
    },
    [broadcastRoomChanges]
  );

  const addDiaryReaction = useCallback(
    (diaryId: string, emoji: string) => {
      hasUserMutatedRef.current = true;
      setDiaries((prev) => {
        const next = prev.map((d) => {
          if (d.id !== diaryId) return d;
          const reactions = { ...(d.reactions || {}) };
          const currentList = reactions[emoji] || [];
          if (currentList.includes(myUserId)) {
            reactions[emoji] = currentList.filter((u) => u !== myUserId);
          } else {
            reactions[emoji] = [...currentList, myUserId];
          }
          return { ...d, reactions, updatedAt: Date.now() };
        });
        try {
          localStorage.setItem(`${STORAGE_KEY_PREFIX}diaries`, JSON.stringify(next));
        } catch {}
        broadcastRoomChanges({ diaries: next });
        return next;
      });
    },
    [myUserId, broadcastRoomChanges]
  );

  const addDiaryComment = useCallback(
    (diaryId: string, content: string) => {
      hasUserMutatedRef.current = true;
      const newComment = {
        id: `cmt_${Date.now()}_${Math.random().toString(36).substring(2, 4)}`,
        authorId: myUserId,
        authorName: myProfile.name,
        content: content.trim(),
        createdAt: Date.now(),
      };

      setDiaries((prev) => {
        const next = prev.map((d) =>
          d.id === diaryId ? { ...d, comments: [...(d.comments || []), newComment], updatedAt: Date.now() } : d
        );
        try {
          localStorage.setItem(`${STORAGE_KEY_PREFIX}diaries`, JSON.stringify(next));
        } catch {}
        broadcastRoomChanges({ diaries: next });
        return next;
      });
    },
    [myUserId, myProfile.name, broadcastRoomChanges]
  );

  // Photo Actions
  const addPhoto = useCallback(
    (photo: Omit<PhotoMemory, 'id' | 'createdAt' | 'authorId' | 'authorName' | 'likes'>) => {
      hasUserMutatedRef.current = true;
      const nowTime = Date.now();
      const newPhoto: PhotoMemory = {
        ...photo,
        id: `photo_${nowTime}_${Math.random().toString(36).substring(2, 6)}`,
        authorId: myUserId,
        authorName: myProfile.name,
        likes: [],
        createdAt: nowTime,
      };

      setPhotos((prev) => {
        const next = [newPhoto, ...prev.filter((p) => p.id !== newPhoto.id)];
        try {
          localStorage.setItem(`${STORAGE_KEY_PREFIX}photos`, JSON.stringify(next));
        } catch {}
        broadcastRoomChanges({ photos: next });
        return next;
      });
    },
    [myUserId, myProfile.name, broadcastRoomChanges]
  );

  const addPhotosBatch = useCallback(
    (photosList: Array<Partial<PhotoMemory>>) => {
      if (!Array.isArray(photosList) || photosList.length === 0) return;
      hasUserMutatedRef.current = true;
      const nowTime = Date.now();
      const createdPhotos: PhotoMemory[] = photosList.map((p, idx) => ({
        ...(p as PhotoMemory),
        id: (p as any).id || `photo_${nowTime}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
        authorId: (p as any).authorId || myUserId,
        authorName: (p as any).authorName || myProfile.name,
        likes: (p as any).likes || [],
        createdAt: (p as any).createdAt || (nowTime + idx),
      }));

      setPhotos((prev) => {
        const next = [...createdPhotos, ...prev.filter((p) => !createdPhotos.some((cp) => (cp.originalFileId && cp.originalFileId === p.originalFileId) || cp.id === p.id))];
        try {
          localStorage.setItem(`${STORAGE_KEY_PREFIX}photos`, JSON.stringify(next));
        } catch {}
        broadcastRoomChanges({ photos: next });
        return next;
      });
    },
    [myUserId, myProfile.name, broadcastRoomChanges]
  );

  const deletePhoto = useCallback(
    (id: string) => {
      hasUserMutatedRef.current = true;
      setPhotos((prev) => {
        const next = prev.filter((p) => p.id !== id);
        try {
          localStorage.setItem(`${STORAGE_KEY_PREFIX}photos`, JSON.stringify(next));
        } catch {}
        broadcastRoomChanges({ photos: next, deletedId: id });
        return next;
      });
    },
    [broadcastRoomChanges]
  );

  const togglePhotoLike = useCallback(
    (photoId: string) => {
      hasUserMutatedRef.current = true;
      setPhotos((prev) => {
        const next = prev.map((p) => {
          if (p.id !== photoId) return p;
          const likes = p.likes || [];
          const nextLikes = likes.includes(myUserId)
            ? likes.filter((u) => u !== myUserId)
            : [...likes, myUserId];
          return { ...p, likes: nextLikes };
        });
        try {
          localStorage.setItem(`${STORAGE_KEY_PREFIX}photos`, JSON.stringify(next));
        } catch {}
        broadcastRoomChanges({ photos: next });
        return next;
      });
    },
    [myUserId, broadcastRoomChanges]
  );

  // Patch a photo's metadata in place (used after uploading a locally-stored photo to
  // Google Drive, to swap its heavy base64 imageUrl for the lightweight Drive URL and
  // properly persist/broadcast the change — unlike a raw object mutation, this actually
  // updates React state, localStorage, and Firestore).
  const updatePhotoMeta = useCallback(
    (photoId: string, updates: Partial<PhotoMemory>) => {
      setPhotos((prev) => {
        const next = prev.map((p) => (p.id === photoId ? { ...p, ...updates } : p));
        try {
          localStorage.setItem(`${STORAGE_KEY_PREFIX}photos`, JSON.stringify(next));
        } catch {}
        broadcastRoomChanges({ photos: next });
        return next;
      });
    },
    [broadcastRoomChanges]
  );

  // Handwritten Cards
  const sendHandwrittenCard = useCallback(
    (card: Omit<HandwrittenCard, 'id' | 'sentAt' | 'senderId' | 'senderName' | 'isOpened'>) => {
      hasUserMutatedRef.current = true;
      const nowTime = Date.now();
      const newCard: HandwrittenCard = {
        ...card,
        id: `card_${nowTime}_${Math.random().toString(36).substring(2, 6)}`,
        senderId: myUserId,
        senderName: myProfile.name,
        senderAvatar: myProfile.avatar,
        isOpened: false,
        sentAt: nowTime,
      };

      setCards((prev) => {
        const next = [newCard, ...prev.filter((c) => c.id !== newCard.id)];
        try {
          localStorage.setItem(`${STORAGE_KEY_PREFIX}cards`, JSON.stringify(next));
        } catch {}
        broadcastRoomChanges({ cards: next });
        return next;
      });
    },
    [myUserId, myProfile.name, myProfile.avatar, broadcastRoomChanges]
  );

  const openCard = useCallback(
    (cardId: string) => {
      hasUserMutatedRef.current = true;
      setCards((prev) => {
        const next = prev.map((c) => (c.id === cardId ? { ...c, isOpened: true, openedAt: Date.now() } : c));
        try {
          localStorage.setItem(`${STORAGE_KEY_PREFIX}cards`, JSON.stringify(next));
        } catch {}
        broadcastRoomChanges({ cards: next });
        return next;
      });
    },
    [broadcastRoomChanges]
  );

  const deleteCard = useCallback(
    (cardId: string) => {
      hasUserMutatedRef.current = true;
      setCards((prev) => {
        const next = prev.filter((c) => c.id !== cardId);
        try {
          localStorage.setItem(`${STORAGE_KEY_PREFIX}cards`, JSON.stringify(next));
        } catch {}
        broadcastRoomChanges({ cards: next, deletedId: cardId });
        return next;
      });
    },
    [broadcastRoomChanges]
  );

  // Anniversaries
  const addAnniversary = useCallback(
    (event: Omit<AnniversaryEvent, 'id'>) => {
      hasUserMutatedRef.current = true;
      const newEvent: AnniversaryEvent = {
        ...event,
        id: `anniv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      };

      setAnniversaries((prev) => {
        const next = [...prev.filter((a) => a.id !== newEvent.id), newEvent];
        try {
          localStorage.setItem(`${STORAGE_KEY_PREFIX}anniversaries`, JSON.stringify(next));
        } catch {}
        broadcastRoomChanges({ anniversaries: next });
        return next;
      });
    },
    [broadcastRoomChanges]
  );

  const updateAnniversary = useCallback(
    (id: string, updates: Partial<AnniversaryEvent>) => {
      hasUserMutatedRef.current = true;
      setAnniversaries((prev) => {
        const next = prev.map((a) => (a.id === id ? { ...a, ...updates } : a));
        try {
          localStorage.setItem(`${STORAGE_KEY_PREFIX}anniversaries`, JSON.stringify(next));
        } catch {}
        broadcastRoomChanges({ anniversaries: next });
        return next;
      });
    },
    [broadcastRoomChanges]
  );

  const deleteAnniversary = useCallback(
    (id: string) => {
      hasUserMutatedRef.current = true;
      setAnniversaries((prev) => {
        const next = prev.filter((a) => a.id !== id);
        try {
          localStorage.setItem(`${STORAGE_KEY_PREFIX}anniversaries`, JSON.stringify(next));
        } catch {}
        broadcastRoomChanges({ anniversaries: next, deletedId: id });
        return next;
      });
    },
    [broadcastRoomChanges]
  );

  // Trip / date plans
  const addPlan = useCallback(
    (plan: Omit<TripPlan, 'id' | 'createdAt' | 'updatedAt' | 'authorId' | 'authorName'>): string => {
      hasUserMutatedRef.current = true;
      const nowTime = Date.now();
      const newPlan: TripPlan = {
        ...plan,
        id: `plan_${nowTime}_${Math.random().toString(36).substring(2, 6)}`,
        authorId: myUserId,
        authorName: myProfile.name,
        createdAt: nowTime,
        updatedAt: nowTime,
      };
      setPlans((prev) => {
        const next = [newPlan, ...prev.filter((p) => p.id !== newPlan.id)];
        try {
          localStorage.setItem(`${STORAGE_KEY_PREFIX}plans`, JSON.stringify(next));
        } catch {}
        broadcastRoomChanges({ plans: next });
        return next;
      });
      return newPlan.id;
    },
    [myUserId, myProfile.name, broadcastRoomChanges]
  );

  const updatePlan = useCallback(
    (id: string, updates: Partial<TripPlan>) => {
      hasUserMutatedRef.current = true;
      setPlans((prev) => {
        const next = prev.map((p) => (p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p));
        try {
          localStorage.setItem(`${STORAGE_KEY_PREFIX}plans`, JSON.stringify(next));
        } catch {}
        broadcastRoomChanges({ plans: next });
        return next;
      });
    },
    [broadcastRoomChanges]
  );

  const deletePlan = useCallback(
    (id: string) => {
      hasUserMutatedRef.current = true;
      setPlans((prev) => {
        const next = prev.filter((p) => p.id !== id);
        try {
          localStorage.setItem(`${STORAGE_KEY_PREFIX}plans`, JSON.stringify(next));
        } catch {}
        broadcastRoomChanges({ plans: next, deletedId: id });
        return next;
      });
    },
    [broadcastRoomChanges]
  );

  // Dating Fees — shared by both partners, synced exactly like plans
  const persistExpenses = (next: DatingExpense[]) => {
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}datingExpenses`, JSON.stringify(next));
    } catch {}
  };

  const addExpense = useCallback(
    (expense: Omit<DatingExpense, 'id' | 'createdAt' | 'updatedAt' | 'authorId' | 'authorName'>) => {
      hasUserMutatedRef.current = true;
      const nowTime = Date.now();
      const entry: DatingExpense = {
        ...expense,
        id: `fee_${nowTime}_${Math.random().toString(36).substring(2, 6)}`,
        authorId: myUserId,
        authorName: myProfile.name,
        createdAt: nowTime,
        updatedAt: nowTime,
      };
      setDatingExpenses((prev) => {
        const next = [entry, ...prev.filter((e) => e.id !== entry.id)];
        persistExpenses(next);
        broadcastRoomChanges({ datingExpenses: next });
        return next;
      });
    },
    [myUserId, myProfile.name, broadcastRoomChanges]
  );

  const updateExpense = useCallback(
    (id: string, updates: Partial<DatingExpense>) => {
      hasUserMutatedRef.current = true;
      setDatingExpenses((prev) => {
        const next = prev.map((e) => (e.id === id ? { ...e, ...updates, id, updatedAt: Date.now() } : e));
        persistExpenses(next);
        broadcastRoomChanges({ datingExpenses: next });
        return next;
      });
    },
    [broadcastRoomChanges]
  );

  const deleteExpense = useCallback(
    (id: string) => {
      hasUserMutatedRef.current = true;
      setDatingExpenses((prev) => {
        const next = prev.filter((e) => e.id !== id);
        persistExpenses(next);
        broadcastRoomChanges({ datingExpenses: next, deletedId: id });
        return next;
      });
    },
    [broadcastRoomChanges]
  );

  // Calendar notes — shared by both partners, synced exactly like Dating Fees
  const persistNotes = (next: CalendarNote[]) => {
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}calendarNotes`, JSON.stringify(next));
    } catch {}
  };

  const addCalendarNote = useCallback(
    (note: Omit<CalendarNote, 'id' | 'createdAt' | 'updatedAt' | 'authorId' | 'authorName'>) => {
      hasUserMutatedRef.current = true;
      const nowTime = Date.now();
      const entry: CalendarNote = {
        ...note,
        id: `note_${nowTime}_${Math.random().toString(36).substring(2, 6)}`,
        authorId: myUserId,
        authorName: myProfile.name,
        createdAt: nowTime,
        updatedAt: nowTime,
      };
      setCalendarNotes((prev) => {
        const next = [entry, ...prev.filter((n) => n.id !== entry.id)];
        persistNotes(next);
        broadcastRoomChanges({ calendarNotes: next });
        return next;
      });
    },
    [myUserId, myProfile.name, broadcastRoomChanges]
  );

  const updateCalendarNote = useCallback(
    (id: string, updates: Partial<CalendarNote>) => {
      hasUserMutatedRef.current = true;
      setCalendarNotes((prev) => {
        const next = prev.map((n) => (n.id === id ? { ...n, ...updates, id, updatedAt: Date.now() } : n));
        persistNotes(next);
        broadcastRoomChanges({ calendarNotes: next });
        return next;
      });
    },
    [broadcastRoomChanges]
  );

  const deleteCalendarNote = useCallback(
    (id: string) => {
      hasUserMutatedRef.current = true;
      setCalendarNotes((prev) => {
        const next = prev.filter((n) => n.id !== id);
        persistNotes(next);
        broadcastRoomChanges({ calendarNotes: next, deletedId: id });
        return next;
      });
    },
    [broadcastRoomChanges]
  );

  // Heartbeat & Typing
  const sendHeartbeat = useCallback(
    (type: HeartbeatPulse['type'], message?: string, diaryDate?: string) => {
      broadcastRoomChanges({
        lastActivePulse: {
          senderId: myUserId,
          senderName: myProfile.name,
          type,
          timestamp: Date.now(),
          message: message || '',
          ...(diaryDate ? { diaryDate } : {}),
        },
      });
    },
    [myUserId, myProfile.name, broadcastRoomChanges]
  );

  const clearIncomingHeartbeat = useCallback(() => {
    setIncomingHeartbeat(null);
  }, []);

  const sendTypingStatus = useCallback(
    (isTyping: boolean) => {
      // A dotted top-level key here (e.g. "typingStatus.usr_x") is NOT treated as a nested
      // field path by setDoc — it becomes a literal field name containing dots, and the app
      // reads a nested `typingStatus` map that would then never actually exist. See the
      // pingPresence fix for the same bug and why it silently broke partner detection.
      broadcastRoomChanges({
        typingStatus: {
          [myUserId]: isTyping,
        },
      });
    },
    [myUserId, broadcastRoomChanges]
  );

  const exportData = useCallback((): string => {
    const fullState: CoupleFullState = {
      myProfile,
      partnerProfile,
      settings,
      diaries,
      photos,
      cards,
      anniversaries,
      plans,
      datingExpenses,
      calendarNotes,
    };
    return JSON.stringify(fullState, null, 2);
  }, [myProfile, partnerProfile, settings, diaries, photos, cards, anniversaries, plans, datingExpenses, calendarNotes]);

  const importData = useCallback(
    (jsonStr: string): boolean => {
      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed.myProfile) setMyProfileState(parsed.myProfile);
        if (parsed.partnerProfile) setPartnerProfileState(parsed.partnerProfile);
        if (parsed.settings) setSettingsState(parsed.settings);
        if (Array.isArray(parsed.diaries)) setDiaries(parsed.diaries);
        if (Array.isArray(parsed.photos)) setPhotos(parsed.photos);
        if (Array.isArray(parsed.cards)) setCards(parsed.cards);
        if (Array.isArray(parsed.anniversaries)) setAnniversaries(parsed.anniversaries);
        if (Array.isArray(parsed.plans)) setPlans(parsed.plans);
        if (Array.isArray(parsed.datingExpenses)) setDatingExpenses(parsed.datingExpenses);
        if (Array.isArray(parsed.calendarNotes)) setCalendarNotes(parsed.calendarNotes);

        broadcastRoomChanges({
          diaries: parsed.diaries || [],
          photos: parsed.photos || [],
          cards: parsed.cards || [],
          anniversaries: parsed.anniversaries || [],
          plans: parsed.plans || [],
          datingExpenses: parsed.datingExpenses || [],
          calendarNotes: parsed.calendarNotes || [],
          settings: stripPersonalSettings(parsed.settings || {}),
        });
        return true;
      } catch (err) {
        console.error('Import data failed:', err);
        return false;
      }
    },
    [broadcastRoomChanges]
  );

  // Complete wipe and logout
  const clearAllUserDataAndLogout = useCallback(async () => {
    try {
      await logoutAccount();
    } catch {}
    try {
      // Clear all lovesync local storage keys
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('lovesync_') || key.startsWith(STORAGE_KEY_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
    } catch {}

    setAuthSessionUser(null);
    setMyProfileState({ ...initialMyProfile, id: getOrCreateUserId() });
    setPartnerProfileState(null);
    setSettingsState({ ...initialSettings });
    setDiaries([]);
    setPhotos([]);
    setCards([]);
    setAnniversaries([]);
    setPlans([]);
    setPartnerAccountInfo(null);
    setGoogleUser(null);
    setIsGoogleDriveConnected(false);
    setSyncStatus('offline');
    soundService.playPop();
  }, []);

  // Hard Reset: Clears everything on server and client
  const clearAllSystemAndLocalData = useCallback(async () => {
    try {
      await clearAllSystemDataService();
    } catch {}
    await clearAllUserDataAndLogout();
  }, [clearAllUserDataAndLogout]);

  // Login handler that synchronizes all state across devices
  const loginWithUserAccount = useCallback(
    (user: any) => {
      if (!user) return;
      setAuthSessionUser(user);

      if (user.partnerUsername) {
        setPartnerAccountInfo({
          username: user.partnerUsername,
          displayName: user.partnerDisplayName,
        });
      } else {
        setPartnerAccountInfo(null);
      }

      const assignedRoom = (user.roomCode || `ROOM-${user.username.toUpperCase()}`).toUpperCase().trim();
      const cleanUserId = user.id || `usr_${user.username.toLowerCase()}`;

      // Reset server timestamp to force complete sync of cloud data
      lastKnownServerTimeRef.current = 0;

      setMyProfileState((prev) => {
        const userProfile = user.profile || {};
        const updated: CoupleProfile = {
          ...prev,
          ...userProfile,
          id: cleanUserId,
          // Same priority as avatar below: a custom name the user already set (saved to their
          // account profile, or already showing locally and not just the generic placeholder)
          // must win over the raw Google account name — otherwise every Google re-login silently
          // discarded a custom display name in favor of whatever the Gmail account is named.
          name:
            userProfile.name ||
            (prev.name && prev.name !== 'Bạn' ? prev.name : null) ||
            user.displayName ||
            user.username,
          // Prefer a custom avatar the user already set (saved to their account profile, or
          // already showing locally and not just the generic placeholder) over the raw
          // Google/OAuth photo — otherwise every Google re-login silently discards a custom
          // uploaded avatar in favor of the provider photo. A first-time login (still on the
          // generic default) falls through to the Google photo as a sensible starting avatar.
          avatar:
            userProfile.avatar ||
            (prev.avatar && prev.avatar !== DEFAULT_AVATAR_ME ? prev.avatar : null) ||
            user.avatar ||
            user.photoURL ||
            DEFAULT_AVATAR_ME,
          birthday: user.birthday || userProfile.birthday || prev.birthday,
          gender: user.gender || userProfile.gender || prev.gender,
          bio: user.bio || userProfile.bio || prev.bio,
          loveQuote: user.loveQuote || userProfile.loveQuote || prev.loveQuote,
          authProvider: user.authProvider || 'username',
        };
        try {
          localStorage.setItem(`${STORAGE_KEY_PREFIX}my_profile`, JSON.stringify(updated));
        } catch {}
        return updated;
      });

      setSettingsState((prev) => {
        const updated: CoupleSettings = {
          ...prev,
          roomCode: assignedRoom,
          accountEmail: user.username,
        };
        try {
          localStorage.setItem(`${STORAGE_KEY_PREFIX}settings`, JSON.stringify(updated));
        } catch {}
        return updated;
      });

      // Instantly load room data from Firestore Cloud and backend
      getDoc(doc(db, 'rooms', assignedRoom))
        .then((snap) => {
          if (snap.exists()) {
            ingestRoomData(snap.data(), 'login_init_firestore');
          }
        })
        .catch(() => {});

      fetch(`/api/room/${encodeURIComponent(assignedRoom)}/state`)
        .then((res) => res.json())
        .then((data) => {
          if (data && data.success && data.room) {
            ingestRoomData(data.room, 'login_init_express');
          }
        })
        .catch(() => {});
    },
    [ingestRoomData]
  );

  return (
    <CoupleContext.Provider
      value={{
        isAuthenticated,
        isAuthModalOpen,
        authModalTab,
        openAuthModal,
        closeAuthModal,
        clearAllUserDataAndLogout,
        clearAllSystemAndLocalData,
        loginWithUserAccount,
        myProfile,
        partnerProfile,
        settings,
        diaries,
        photos,
        cards,
        anniversaries,
        plans,
        datingExpenses,
        calendarNotes,
        myUserId,
        isPartnerOnline,
        isPartnerTyping,
        incomingHeartbeat,
        syncStatus,
        syncError,
        lastSyncedAt,
        daysInLove,
        partnerAccountInfo,
        googleUser,
        isGoogleDriveConnected,
        isGoogleDriveSyncing,
        googleDriveFolderUrl,
        googleDriveFolderName: APP_FOLDER_NAME,
        connectGoogleDrive,
        disconnectGoogleDrive,
        syncNow,
        setRoomCode,
        changeCoupleRoomCode,
        leaveCoupleRoom,
        linkPartnerAccount,
        unlinkPartnerAccount,
        updateMyProfile,
        updateSettings,
        addDiary,
        updateDiary,
        deleteDiary,
        deleteAllDayDiaries,
        addDiaryReaction,
        addDiaryComment,
        addPhoto,
        addPhotosBatch,
        deletePhoto,
        togglePhotoLike,
        updatePhotoMeta,
        sendHandwrittenCard,
        openCard,
        deleteCard,
        addAnniversary,
        updateAnniversary,
        deleteAnniversary,
        addPlan,
        updatePlan,
        deletePlan,
        addExpense,
        updateExpense,
        deleteExpense,
        addCalendarNote,
        updateCalendarNote,
        deleteCalendarNote,
        sendHeartbeat,
        clearIncomingHeartbeat,
        sendTypingStatus,
        roomPlaylist,
        updateRoomPlaylist,
        roomAlbums,
        updateRoomAlbums,
        exportData,
        importData,
      }}
    >
      {children}
    </CoupleContext.Provider>
  );
};

export const useCouple = (): CoupleContextType => {
  const context = useContext(CoupleContext);
  if (!context) {
    throw new Error('useCouple must be used within a CoupleProvider');
  }
  return context;
};
