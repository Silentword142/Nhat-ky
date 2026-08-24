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
import {
  initAuth,
  googleSignIn,
  googleLogout,
  getAccessToken,
} from '../services/googleAuth';
import {
  saveCoupleDataToDrive,
  loadCoupleDataFromDrive,
  APP_FOLDER_NAME,
} from '../services/googleDrive';
import { User } from 'firebase/auth';
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
  saveGoogleDriveStatusService,
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
  loveDuration: { days: number; hours: number; minutes: number; seconds: number };
  partnerAccountInfo: { username?: string; displayName?: string; birthday?: string } | null;

  // Google Drive Cloud Storage (Dedicated Folder)
  googleUser: User | null;
  isGoogleDriveConnected: boolean;
  isGoogleDriveSyncing: boolean;
  googleDriveLastSavedAt: string | null;
  googleDriveFolderUrl: string | null;
  googleDriveFolderName: string;
  connectGoogleDrive: () => Promise<boolean>;
  disconnectGoogleDrive: () => Promise<void>;
  saveToGoogleDriveNow: () => Promise<{ success: boolean; error?: string; folderUrl?: string }>;
  loadFromGoogleDriveNow: () => Promise<{ success: boolean; error?: string }>;

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

// Universal smart merge for arrays of items (diaries, photos, cards, anniversaries)
export function smartMergeCollections<T extends { id?: string }>(
  localList: T[] = [],
  incomingList: T[] = [],
  deletedIds: string[] = []
): T[] {
  const deletedSet = new Set(deletedIds || []);
  const map = new Map<string, T>();

  // 1. Add incoming items
  for (const item of incomingList) {
    if (item && item.id && !deletedSet.has(item.id)) {
      map.set(item.id, item);
    }
  }

  // 2. Merge local items
  for (const item of localList) {
    if (!item || !item.id || deletedSet.has(item.id)) continue;

    const existing = map.get(item.id);
    if (!existing) {
      map.set(item.id, item);
    } else {
      const incomingTime = getItemTimestamp(existing);
      const localTime = getItemTimestamp(item);
      if (localTime >= incomingTime) {
        map.set(item.id, { ...existing, ...item });
      } else {
        map.set(item.id, { ...item, ...existing });
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
  const [googleDriveLastSavedAt, setGoogleDriveLastSavedAt] = useState<string | null>(() => {
    return localStorage.getItem(`${STORAGE_KEY_PREFIX}gdrive_last_saved`);
  });
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
          if (liveUser.gdriveConnected) {
            setIsGoogleDriveConnected(true);
            if (liveUser.gdriveEmail) {
              setGoogleUser((prev: any) => ({
                ...(prev || {}),
                email: liveUser.gdriveEmail,
                displayName: liveUser.gdriveDisplayName || liveUser.gdriveEmail,
              }));
            }
            if (liveUser.gdriveFolderUrl) {
              setGoogleDriveFolderUrl(liveUser.gdriveFolderUrl);
            }
            if (liveUser.gdriveLastSaved) {
              setGoogleDriveLastSavedAt(liveUser.gdriveLastSaved);
            }
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

      // 1. Sync Diaries with smart merge
      if (Array.isArray(data.diaries)) {
        setDiaries((prev) => {
          const merged = smartMergeCollections(prev, data.diaries, deletedIds);
          merged.sort((a, b) => getItemTimestamp(b) - getItemTimestamp(a));
          try {
            localStorage.setItem(`${STORAGE_KEY_PREFIX}diaries`, JSON.stringify(merged));
          } catch {}
          return merged;
        });
      }

      // 2. Sync Photos with smart merge
      if (Array.isArray(data.photos)) {
        setPhotos((prev) => {
          const merged = smartMergeCollections(prev, data.photos, deletedIds);
          merged.sort((a, b) => getItemTimestamp(b) - getItemTimestamp(a));
          try {
            localStorage.setItem(`${STORAGE_KEY_PREFIX}photos`, JSON.stringify(merged));
          } catch {}
          return merged;
        });
      }

      // 3. Sync Cards with smart merge
      if (Array.isArray(data.cards)) {
        setCards((prev) => {
          const merged = smartMergeCollections(prev, data.cards, deletedIds);
          merged.sort((a, b) => getItemTimestamp(b) - getItemTimestamp(a));
          try {
            localStorage.setItem(`${STORAGE_KEY_PREFIX}cards`, JSON.stringify(merged));
          } catch {}
          return merged;
        });
      }

      // 4. Sync Anniversaries with smart merge
      if (Array.isArray(data.anniversaries)) {
        setAnniversaries((prev) => {
          const merged = smartMergeCollections(prev, data.anniversaries, deletedIds);
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

  // Push updates to Express REST Backend & WebSocket network
  const broadcastRoomChanges = useCallback(
    async (partialDoc: Record<string, any>, overrideProfile?: CoupleProfile) => {
      const nowTime = Date.now();
      lastKnownServerTimeRef.current = nowTime;

      const payload = {
        ...partialDoc,
        roomCode: settings.roomCode,
        updatedAt: nowTime,
      };

      const profileToSend = overrideProfile || myProfileRef.current;

      try {
        const res = await fetch(`/api/room/${encodeURIComponent(settings.roomCode)}/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: myUserId,
            profile: profileToSend,
            state: payload,
          }),
        });
        const result = await res.json();
        if (result.success) {
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

  // EXPRESS REST POLLING & INITIAL SYNC (Guarantees Incognito & Cross-Browser 100% sync)
  useEffect(() => {
    if (!isAuthenticated || !settings.roomCode || settings.roomCode.trim().length === 0) {
      setSyncStatus('offline');
      return;
    }

    let isMounted = true;

    const fetchServerState = async () => {
      try {
        const res = await fetch(`/api/room/${encodeURIComponent(settings.roomCode)}/state?t=${Date.now()}`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && data.success) {
          if (data.exists && data.room) {
            applyIncomingRoomData(data.room, 'express_rest');
          } else {
            // Room does not exist or transient state: mark offline but keep paired profile
            setIsPartnerOnline(false);
            setIsPartnerTyping(false);
          }
        }
      } catch (err) {
        // Silent catch for network hiccups
      }
    };

    // Immediate fetch on mount or room code change
    fetchServerState();

    // Fast polling every 1200ms
    const interval = setInterval(fetchServerState, 1200);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isAuthenticated, settings.roomCode, applyIncomingRoomData]);

  // Heartbeat presence ping (sent to Express Server ONLY)
  useEffect(() => {
    if (!isAuthenticated || !settings.roomCode || settings.roomCode.trim().length === 0) {
      return;
    }

    const pingPresence = () => {
      try {
        fetch(`/api/room/${encodeURIComponent(settings.roomCode)}/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: myUserId,
            profile: myProfile,
            state: {
              roomCode: settings.roomCode,
            },
          }),
        }).catch(() => {});
      } catch {}
    };

    pingPresence();
    const interval = setInterval(pingPresence, 20000);
    return () => clearInterval(interval);
  }, [isAuthenticated, settings.roomCode, myUserId, myProfile]);

  // Google Drive Manual / Auto Save (Guarantees freshest authoritative data is saved, never stale device state)
  const saveToGoogleDriveNow = useCallback(async (): Promise<{ success: boolean; error?: string; folderUrl?: string }> => {
    try {
      setIsGoogleDriveSyncing(true);
      let token = await getAccessToken();
      if (!token) {
        // Prompt login if token is not currently cached in memory
        const loginRes = await googleSignIn();
        token = loginRes?.accessToken || null;
      }
      if (!token) {
        throw new Error('Chưa đăng nhập Google để kết nối Google Drive.');
      }

      // 1. Fetch freshest authoritative state from server first!
      let serverRoom: any = null;
      try {
        const sRes = await fetch(`/api/room/${encodeURIComponent(settings.roomCode)}/state?t=${Date.now()}`, { cache: 'no-store' });
        if (sRes.ok) {
          const sData = await sRes.json();
          if (sData.success && sData.room) {
            serverRoom = sData.room;
          }
        }
      } catch (err) {
        console.warn('Could not fetch server state before Drive save:', err);
      }

      // 2. Fetch existing Google Drive file if present to merge
      let driveExistingData: any = null;
      try {
        const dRes = await loadCoupleDataFromDrive(token, settings.roomCode);
        if (dRes.success && dRes.data) {
          driveExistingData = dRes.data;
        }
      } catch (err) {
        console.warn('Could not fetch existing Drive backup:', err);
      }

      const deletedIds = [
        ...(serverRoom?.deletedItemIds || []),
        ...(driveExistingData?.deletedItemIds || []),
      ];

      // Smart merge all 3 sources (Server, Drive, Local) with timestamps
      const mergedDiaries = smartMergeCollections<DiaryEntry>(
        diaries,
        smartMergeCollections<DiaryEntry>(driveExistingData?.diaries || [], serverRoom?.diaries || [], deletedIds),
        deletedIds
      );
      mergedDiaries.sort((a, b) => getItemTimestamp(b) - getItemTimestamp(a));

      const mergedPhotos = smartMergeCollections<PhotoMemory>(
        photos,
        smartMergeCollections<PhotoMemory>(driveExistingData?.photos || [], serverRoom?.photos || [], deletedIds),
        deletedIds
      );
      mergedPhotos.sort((a, b) => getItemTimestamp(b) - getItemTimestamp(a));

      const mergedCards = smartMergeCollections<HandwrittenCard>(
        cards,
        smartMergeCollections<HandwrittenCard>(driveExistingData?.cards || [], serverRoom?.cards || [], deletedIds),
        deletedIds
      );
      mergedCards.sort((a, b) => getItemTimestamp(b) - getItemTimestamp(a));

      const mergedAnniversaries = smartMergeCollections<AnniversaryEvent>(
        anniversaries,
        smartMergeCollections<AnniversaryEvent>(driveExistingData?.anniversaries || [], serverRoom?.anniversaries || [], deletedIds),
        deletedIds
      );

      let currentPlaylist = roomPlaylist;
      if (!currentPlaylist || currentPlaylist.length === 0) {
        currentPlaylist = serverRoom?.playlist || driveExistingData?.playlist || [];
      }

      let currentAlbums: any[] = [];
      try {
        const aSaved = localStorage.getItem('lovesync_custom_albums_v2');
        if (aSaved) currentAlbums = JSON.parse(aSaved);
      } catch {}
      if (!currentAlbums || currentAlbums.length === 0) {
        currentAlbums = serverRoom?.albums || driveExistingData?.albums || [];
      }

      const mergedSettings = {
        ...settings,
        ...(driveExistingData?.settings || {}),
        ...(serverRoom?.settings || {}),
        roomCode: settings.roomCode,
      };

      const fullData = {
        myProfile,
        partnerProfile: partnerProfile || serverRoom?.profiles?.[Object.keys(serverRoom?.profiles || {}).find((id) => id !== myUserId) || ''] || driveExistingData?.partnerProfile || null,
        settings: mergedSettings,
        diaries: mergedDiaries,
        photos: mergedPhotos,
        cards: mergedCards,
        anniversaries: mergedAnniversaries,
        playlist: currentPlaylist,
        albums: currentAlbums,
        deletedItemIds: deletedIds,
        savedAt: new Date().toISOString(),
        updatedAt: Date.now(),
      };

      // 3. Save strictly freshest dataset to Google Drive
      const result = await saveCoupleDataToDrive(token, settings.roomCode, fullData);
      if (result.success) {
        const timeStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setGoogleDriveLastSavedAt(timeStr);
        if (result.folderUrl) {
          setGoogleDriveFolderUrl(result.folderUrl);
          localStorage.setItem(`${STORAGE_KEY_PREFIX}gdrive_folder_url`, result.folderUrl);
        }
        localStorage.setItem(`${STORAGE_KEY_PREFIX}gdrive_last_saved`, timeStr);

        // Update local React state and storage to reflect the merged newest data
        setDiaries(mergedDiaries);
        setPhotos(mergedPhotos);
        setCards(mergedCards);
        setAnniversaries(mergedAnniversaries);
        try {
          localStorage.setItem(`${STORAGE_KEY_PREFIX}diaries`, JSON.stringify(mergedDiaries));
          localStorage.setItem(`${STORAGE_KEY_PREFIX}photos`, JSON.stringify(mergedPhotos));
          localStorage.setItem(`${STORAGE_KEY_PREFIX}cards`, JSON.stringify(mergedCards));
          localStorage.setItem(`${STORAGE_KEY_PREFIX}anniversaries`, JSON.stringify(mergedAnniversaries));
        } catch {}

        // Also sync the freshest merged data to the server
        broadcastRoomChanges({
          diaries: mergedDiaries,
          photos: mergedPhotos,
          cards: mergedCards,
          anniversaries: mergedAnniversaries,
          playlist: currentPlaylist,
          albums: currentAlbums,
          settings: mergedSettings,
          deletedItemIds: deletedIds,
        });

        // Sync Google Drive metadata to user account on server for cross-device visibility
        saveGoogleDriveStatusService({
          username: authSessionUser?.username,
          roomCode: settings.roomCode,
          gdriveConnected: true,
          gdriveEmail: googleUser?.email || '',
          gdriveDisplayName: googleUser?.displayName || '',
          gdriveFolderUrl: result.folderUrl || googleDriveFolderUrl || '',
          gdriveLastSaved: timeStr,
        });

        soundService.playSuccess();
        return { success: true, folderUrl: result.folderUrl };
      } else {
        throw new Error(result.error || 'Lỗi khi lưu lên Google Drive.');
      }
    } catch (err: any) {
      console.error('saveToGoogleDriveNow Error:', err);
      soundService.playPop();
      return { success: false, error: err.message || 'Lỗi lưu Google Drive' };
    } finally {
      setIsGoogleDriveSyncing(false);
    }
  }, [settings.roomCode, myUserId, myProfile, partnerProfile, settings, diaries, photos, cards, anniversaries, roomPlaylist, authSessionUser, googleUser, googleDriveFolderUrl, broadcastRoomChanges]);

  // Google Drive Manual Restore / Load
  const loadFromGoogleDriveNow = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      setIsGoogleDriveSyncing(true);
      let token = await getAccessToken();
      if (!token) {
        const loginRes = await googleSignIn();
        token = loginRes?.accessToken || null;
      }
      if (!token) {
        return { success: false, error: 'Đăng nhập Google chưa hoàn tất hoặc đã bị hủy.' };
      }

      const result = await loadCoupleDataFromDrive(token, settings.roomCode);
      if (result.success && result.data) {
        const data = result.data;
        if (data.myProfile) setMyProfileState(data.myProfile);
        if (data.partnerProfile) setPartnerProfileState(data.partnerProfile);
        if (data.settings) setSettingsState(data.settings);
        if (Array.isArray(data.diaries)) {
          setDiaries(data.diaries);
          localStorage.setItem(`${STORAGE_KEY_PREFIX}diaries`, JSON.stringify(data.diaries));
        }
        if (Array.isArray(data.photos)) {
          setPhotos(data.photos);
          localStorage.setItem(`${STORAGE_KEY_PREFIX}photos`, JSON.stringify(data.photos));
        }
        if (Array.isArray(data.cards)) {
          setCards(data.cards);
          localStorage.setItem(`${STORAGE_KEY_PREFIX}cards`, JSON.stringify(data.cards));
        }
        if (Array.isArray(data.anniversaries)) {
          setAnniversaries(data.anniversaries);
          localStorage.setItem(`${STORAGE_KEY_PREFIX}anniversaries`, JSON.stringify(data.anniversaries));
        }
        if (Array.isArray(data.playlist) && data.playlist.length > 0) {
          setRoomPlaylist(data.playlist);
          localStorage.setItem('lovesync_full_playlist_v3', JSON.stringify(data.playlist));
        }
        if (Array.isArray(data.albums) && data.albums.length > 0) {
          localStorage.setItem('lovesync_custom_albums_v2', JSON.stringify(data.albums));
        }

        broadcastRoomChanges({
          diaries: data.diaries || [],
          photos: data.photos || [],
          cards: data.cards || [],
          anniversaries: data.anniversaries || [],
          playlist: data.playlist || [],
          albums: data.albums || [],
          settings: data.settings || {},
        });

        soundService.playSuccess();
        return { success: true };
      } else {
        throw new Error(result.error || 'Không tìm thấy dữ liệu sao lưu.');
      }
    } catch (err: any) {
      soundService.playPop();
      return { success: false, error: err.message || 'Lỗi tải từ Google Drive' };
    } finally {
      setIsGoogleDriveSyncing(false);
    }
  }, [settings.roomCode, broadcastRoomChanges]);

  // Connect Google Drive
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
        // Automatically save latest merged data
        const saveRes = await saveToGoogleDriveNow();
        return saveRes.success;
      }
      return false;
    } catch (err: any) {
      console.error('Connect Google Drive error:', err);
      throw err;
    } finally {
      setIsGoogleDriveSyncing(false);
    }
  }, [saveToGoogleDriveNow]);

  // Disconnect Google Drive
  const disconnectGoogleDrive = useCallback(async () => {
    await googleLogout();
    setGoogleUser(null);
    setIsGoogleDriveConnected(false);
    saveGoogleDriveStatusService({
      username: authSessionUser?.username,
      roomCode: settings.roomCode,
      gdriveConnected: false,
    });
  }, [authSessionUser, settings.roomCode]);

  // Debounced Auto-sync to Google Drive on actual user data mutations (when connected)
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!isGoogleDriveConnected) return;
    // Only auto-save if user performed a mutation in this active session
    if (!hasUserMutatedRef.current) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(async () => {
      hasUserMutatedRef.current = false;
      await saveToGoogleDriveNow();
    }, 4000);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [isGoogleDriveConnected, diaries, photos, cards, anniversaries, roomPlaylist, settings, saveToGoogleDriveNow]);

  // Live timer for anniversary countdown
  const [now, setNow] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loveDuration = useMemo(() => {
    if (!settings.coupleStartDate || !settings.coupleStartDate.trim()) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    }
    const start = new Date(settings.coupleStartDate).getTime();
    if (isNaN(start)) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    }
    const current = now.getTime();
    const diff = Math.max(0, current - start);

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    return { days, hours, minutes, seconds };
  }, [settings.coupleStartDate, now]);

  const daysInLove = loveDuration.days;

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

  // Manual Trigger to re-fetch room state
  const syncNow = useCallback(async (): Promise<boolean> => {
    soundService.playPop();
    try {
      setSyncStatus('connecting');
      const res = await fetch(`/api/room/${encodeURIComponent(settings.roomCode)}/state`);
      const data = await res.json();
      if (data.success && data.exists && data.room) {
        applyIncomingRoomData(data.room, 'manual_sync');
        soundService.playSparkle();
        setSyncStatus('connected');
        return true;
      }
      setSyncStatus('connected');
      return true;
    } catch (e) {
      setSyncStatus('offline');
      return false;
    }
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
    (photosList: Array<Omit<PhotoMemory, 'id' | 'createdAt' | 'authorId' | 'authorName' | 'likes'>>) => {
      if (!Array.isArray(photosList) || photosList.length === 0) return;
      hasUserMutatedRef.current = true;
      const nowTime = Date.now();
      const createdPhotos: PhotoMemory[] = photosList.map((p, idx) => ({
        ...p,
        id: `photo_${nowTime}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
        authorId: myUserId,
        authorName: myProfile.name,
        likes: [],
        createdAt: nowTime + idx,
      }));

      setPhotos((prev) => {
        const next = [...createdPhotos, ...prev.filter((p) => !createdPhotos.some((cp) => cp.id === p.id))];
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

      // Instantly load room data from backend
      fetch(`/api/room/${encodeURIComponent(assignedRoom)}/state`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.room) {
            applyIncomingRoomData(data.room, 'login_init');
          }
        })
        .catch((err) => console.warn('Login initial sync error:', err));
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
        loveDuration,
        partnerAccountInfo,
        googleUser,
        isGoogleDriveConnected,
        isGoogleDriveSyncing,
        googleDriveLastSavedAt,
        googleDriveFolderUrl,
        googleDriveFolderName: APP_FOLDER_NAME,
        connectGoogleDrive,
        disconnectGoogleDrive,
        saveToGoogleDriveNow,
        loadFromGoogleDriveNow,
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
