import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  CoupleProfile,
  CoupleSettings,
  DiaryEntry,
  PhotoMemory,
  HandwrittenCard,
  AnniversaryEvent,
  HeartbeatPulse,
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
  isPartnerOnline: boolean;
  isPartnerTyping: boolean;
  incomingHeartbeat: HeartbeatPulse | null;
  syncStatus: 'connected' | 'connecting' | 'offline';
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

  sendHeartbeat: (type: HeartbeatPulse['type'], message?: string) => void;
  clearIncomingHeartbeat: () => void;
  sendTypingStatus: (isTyping: boolean) => void;
  roomPlaylist: any[];
  updateRoomPlaylist: (newPlaylist: any[]) => void;
  exportData: () => string;
  importData: (jsonStr: string) => boolean;
}

export const CoupleContext = createContext<CoupleContextType | undefined>(undefined);

const STORAGE_KEY_PREFIX = 'lovesync_cloud_v2_';

// Firestore documents are capped at 1MiB. Inline base64 image/canvas data (data: URLs) from
// unsynced local photos or handwritten cards can blow past that instantly and silently break
// realtime sync for the *entire* room (Firestore rejects the whole write). This strips any long
// inline data: URL out of the payload right before it is sent to Firestore — the full-quality
// version keeps living in localStorage on this device and, once uploaded to Google Drive, the
// lightweight Drive URL takes its place and syncs normally.
const MAX_INLINE_DATA_URL_LENGTH = 2000;
function stripHeavyInlineDataForCloudSync<T>(value: T): T {
  if (typeof value === 'string') {
    if (value.startsWith('data:') && value.length > MAX_INLINE_DATA_URL_LENGTH) {
      return '' as unknown as T;
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => stripHeavyInlineDataForCloudSync(item)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const key of Object.keys(value as Record<string, any>)) {
      out[key] = stripHeavyInlineDataForCloudSync((value as Record<string, any>)[key]);
    }
    return out as T;
  }
  return value;
}

// Robust helper to extract timestamp from any item (date string, timestamp, createdAt, updatedAt, etc.)
export function getItemTimestamp(item: any): number {
  if (!item) return 0;
  if (typeof item.updatedAt === 'number' && !isNaN(item.updatedAt) && item.updatedAt > 0) return item.updatedAt;
  if (typeof item.createdAt === 'number' && !isNaN(item.createdAt) && item.createdAt > 0) return item.createdAt;
  if (typeof item.timestamp === 'number' && !isNaN(item.timestamp) && item.timestamp > 0) return item.timestamp;
  if (typeof item.sentAt === 'number' && !isNaN(item.sentAt) && item.sentAt > 0) return item.sentAt;
  if (typeof item.date === 'number' && !isNaN(item.date) && item.date > 0) return item.date;
  if (typeof item.date === 'string' && item.date) {
    const t = new Date(item.date).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  return 0;
}

/**
 * Authoritative Remote Merge:
 * Always prioritizes incoming cloud/server data as the true source of truth.
 * Only adds local items if they were freshly created/updated in this active session
 * and strictly newer than the remote state. Stale device cache is never allowed to overwrite remote data.
 */
export function mergeWithAuthoritativeRemote<T extends { id?: string }>(
  localList: T[] = [],
  remoteList: T[] = [],
  deletedIds: string[] = [],
  hasLocalMutation: boolean = false,
  remoteUpdatedAt: number = 0
): T[] {
  const deletedSet = new Set(deletedIds || []);
  const map = new Map<string, T>();

  // 1. Authoritative Remote items always take priority
  for (const item of remoteList) {
    if (item && item.id && !deletedSet.has(item.id)) {
      map.set(item.id, item);
    }
  }

  // 2. Only if the user performed a local mutation in this active session, preserve new/modified items
  if (hasLocalMutation) {
    for (const item of localList) {
      if (!item || !item.id || deletedSet.has(item.id)) continue;
      const existing = map.get(item.id);
      const localTime = getItemTimestamp(item);
      if (!existing) {
        if (localTime >= remoteUpdatedAt) {
          map.set(item.id, item);
        }
      } else {
        const remoteTime = getItemTimestamp(existing);
        if (localTime > remoteTime) {
          map.set(item.id, { ...existing, ...item });
        }
      }
    }
  }

  return Array.from(map.values());
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

  const [roomPlaylist, setRoomPlaylist] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('lovesync_full_playlist_v3');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const updateRoomPlaylist = useCallback((newPlaylist: any[]) => {
    setRoomPlaylist(newPlaylist);
    try {
      localStorage.setItem('lovesync_full_playlist_v3', JSON.stringify(newPlaylist));
    } catch {}
    broadcastRoomChanges({ playlist: newPlaylist });
  }, []);

  const isAuthenticated = useMemo(() => {
    const cur = getCurrentAuthUser();
    return !!cur?.username || (!!myProfile.email && myProfile.authProvider === 'google') || myProfile.authProvider === 'username';
  }, [authSessionUser, myProfile]);

  const [isPartnerOnline, setIsPartnerOnline] = useState<boolean>(false);
  const [isPartnerTyping, setIsPartnerTyping] = useState<boolean>(false);
  const [incomingHeartbeat, setIncomingHeartbeat] = useState<HeartbeatPulse | null>(null);
  const [syncStatus, setSyncStatus] = useState<'connected' | 'connecting' | 'offline'>('offline');
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
              const updated: CoupleProfile = {
                ...prev,
                ...userProfile,
                name: liveUser.displayName || userProfile.name || prev.name,
                avatar: liveUser.avatar || liveUser.photoURL || userProfile.avatar || prev.avatar,
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

      const deletedIds = Array.isArray(data.deletedItemIds) ? data.deletedItemIds : [];

      // 1. Sync Diaries with authoritative remote merge
      if (Array.isArray(data.diaries)) {
        setDiaries((prev) => {
          const merged = mergeWithAuthoritativeRemote<DiaryEntry>(
            prev,
            data.diaries,
            deletedIds,
            hasUserMutatedRef.current,
            data.updatedAt || 0
          );
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
          const merged = mergeWithAuthoritativeRemote<PhotoMemory>(
            prev,
            data.photos,
            deletedIds,
            hasUserMutatedRef.current,
            data.updatedAt || 0
          );
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
          const merged = mergeWithAuthoritativeRemote<HandwrittenCard>(
            prev,
            data.cards,
            deletedIds,
            hasUserMutatedRef.current,
            data.updatedAt || 0
          );
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
          const merged = mergeWithAuthoritativeRemote<AnniversaryEvent>(
            prev,
            data.anniversaries,
            deletedIds,
            hasUserMutatedRef.current,
            data.updatedAt || 0
          );
          try {
            localStorage.setItem(`${STORAGE_KEY_PREFIX}anniversaries`, JSON.stringify(merged));
          } catch {}
          return merged;
        });
      }

      // 4b. Sync Playlist
      if (Array.isArray(data.playlist) && data.playlist.length > 0) {
        setRoomPlaylist(data.playlist);
        try {
          localStorage.setItem('lovesync_full_playlist_v3', JSON.stringify(data.playlist));
        } catch {}
      }

      // 4c. Sync Albums
      if (Array.isArray(data.albums) && data.albums.length > 0) {
        try {
          localStorage.setItem('lovesync_custom_albums_v2', JSON.stringify(data.albums));
        } catch {}
      }

      // 5. Sync Settings
      if (data.settings && typeof data.settings === 'object') {
        setSettingsState((prev) => {
          const merged = { ...prev, ...data.settings, roomCode: prev.roomCode };
          try {
            localStorage.setItem(`${STORAGE_KEY_PREFIX}settings`, JSON.stringify(merged));
          } catch {}
          return merged;
        });
      }

      // 6. Partner Profile & Online presence
      if (data.profiles && typeof data.profiles === 'object') {
        const partnerId = Object.keys(data.profiles).find((id) => id !== myUserId);
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
          soundService.playHeartbeat();
          setIncomingHeartbeat({
            senderId: pulse.senderId,
            senderName: pulse.senderName || 'Người yêu',
            type: pulse.type || 'heart',
            timestamp: pulse.timestamp,
            message: pulse.message,
          });
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
    },
    [myUserId, settings.roomCode]
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

      // 1. Direct Firestore Cloud Broadcast (Enables 100% instant sync on GitHub Pages and static hosts)
      try {
        if (cleanRoom) {
          const roomDocRef = doc(db, 'rooms', cleanRoom);
          const firestoreSafePayload = stripHeavyInlineDataForCloudSync(payload);
          setDoc(roomDocRef, firestoreSafePayload, { merge: true }).catch(() => {});
          setSyncStatus('connected');
          setLastSyncedAt(nowTime);
        }
      } catch (err) {}

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
            applyIncomingRoomData(result.room, 'sync_ack');
          }
        }
      } catch (e) {}
    },
    [settings.roomCode, myUserId, applyIncomingRoomData]
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
            applyIncomingRoomData(remoteData, 'firestore_realtime');
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
              applyIncomingRoomData(data.room, 'express_rest');
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

    return () => {
      isMounted = false;
      if (unsubscribeFirestore) unsubscribeFirestore();
      if (interval) clearInterval(interval);
    };
  }, [isAuthenticated, settings.roomCode, applyIncomingRoomData]);


  // Heartbeat presence ping (sent to Firestore & Express Server)
  useEffect(() => {
    if (!isAuthenticated || !settings.roomCode || settings.roomCode.trim().length === 0) {
      return;
    }

    const cleanRoom = settings.roomCode.toUpperCase().trim();
    const pingPresence = () => {
      const nowTime = Date.now();
      try {
        const roomDocRef = doc(db, 'rooms', cleanRoom);
        setDoc(
          roomDocRef,
          {
            [`profiles.${myUserId}.lastActive`]: nowTime,
            [`profiles.${myUserId}.name`]: myProfile.name,
            [`profiles.${myUserId}.avatar`]: myProfile.avatar,
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
          applyIncomingRoomData(roomDocSnap.data(), 'manual_sync_firestore');
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
          applyIncomingRoomData(data.room, 'manual_sync_express');
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
  }, [settings.roomCode, applyIncomingRoomData]);

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

      // 1. Call server API to perform server-side migration or separation
      try {
        await requestChangeRoomCode(oldCode, cleanCode, myUserId, migratePartner);
      } catch (err) {
        console.warn('requestChangeRoomCode error:', err);
      }

      // 2. Update local state
      setSettingsState((prev) => {
        const nextSettings = { ...prev, roomCode: cleanCode };
        try {
          localStorage.setItem(`${STORAGE_KEY_PREFIX}settings`, JSON.stringify(nextSettings));
        } catch {}
        return nextSettings;
      });

      return true;
    },
    [settings.roomCode, myUserId, partnerAccountInfo]
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
    const result = await unlinkPartnerAccountService(myUserId, settings.roomCode);
    const newRoom = result.newRoomCode || (cleanUser ? `ROOM-${cleanUser.toUpperCase()}` : `LOVE-${Math.random().toString(36).substring(2, 7).toUpperCase()}`);

    // 3. Update local settings to new private room
    setSettingsState((prev) => {
      const nextSettings = { ...prev, roomCode: newRoom };
      try {
        localStorage.setItem(`${STORAGE_KEY_PREFIX}settings`, JSON.stringify(nextSettings));
      } catch {}
      return nextSettings;
    });
  }, [settings.roomCode, myUserId]);

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
        broadcastRoomChanges({ settings: updated });
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

  // Heartbeat & Typing
  const sendHeartbeat = useCallback(
    (type: HeartbeatPulse['type'], message?: string) => {
      broadcastRoomChanges({
        lastActivePulse: {
          senderId: myUserId,
          senderName: myProfile.name,
          type,
          timestamp: Date.now(),
          message: message || '',
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
      broadcastRoomChanges({
        [`typingStatus.${myUserId}`]: isTyping,
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
    };
    return JSON.stringify(fullState, null, 2);
  }, [myProfile, partnerProfile, settings, diaries, photos, cards, anniversaries]);

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

        broadcastRoomChanges({
          diaries: parsed.diaries || [],
          photos: parsed.photos || [],
          cards: parsed.cards || [],
          anniversaries: parsed.anniversaries || [],
          settings: parsed.settings || {},
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

      // Restore Google Drive status if present on user account
      if (user.gdriveConnected) {
        setIsGoogleDriveConnected(true);
        if (user.gdriveEmail) {
          setGoogleUser({
            email: user.gdriveEmail,
            displayName: user.gdriveDisplayName || user.gdriveEmail,
          });
        }
        if (user.gdriveFolderUrl) {
          setGoogleDriveFolderUrl(user.gdriveFolderUrl);
        }
        if (user.gdriveLastSaved) {
          setGoogleDriveLastSavedAt(user.gdriveLastSaved);
        }
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
          name: user.displayName || userProfile.name || user.username,
          avatar: user.avatar || user.photoURL || userProfile.avatar || prev.avatar || DEFAULT_AVATAR_ME,
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
            applyIncomingRoomData(snap.data(), 'login_init_firestore');
          }
        })
        .catch(() => {});

      fetch(`/api/room/${encodeURIComponent(assignedRoom)}/state`)
        .then((res) => res.json())
        .then((data) => {
          if (data && data.success && data.room) {
            applyIncomingRoomData(data.room, 'login_init_express');
          }
        })
        .catch(() => {});
    },
    [applyIncomingRoomData]
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
        isPartnerOnline,
        isPartnerTyping,
        incomingHeartbeat,
        syncStatus,
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
        sendHeartbeat,
        clearIncomingHeartbeat,
        sendTypingStatus,
        roomPlaylist,
        updateRoomPlaylist,
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
