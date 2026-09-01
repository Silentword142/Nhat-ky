import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { auth } from './firebase';

const googleProvider = new GoogleAuthProvider();

export interface UserAccountData {
  id: string;
  username: string;
  displayName: string;
  photoURL?: string;
  avatar?: string;
  roomCode: string;
  partnerUsername?: string;
  partnerDisplayName?: string;
  birthday?: string;
  gender?: string;
  bio?: string;
  loveQuote?: string;
  profile?: any;
  email?: string;
  authProvider?: 'username' | 'google';
  gdriveConnected?: boolean;
  gdriveEmail?: string;
  gdriveDisplayName?: string;
  gdriveFolderUrl?: string;
  gdriveLastSaved?: string;
  createdAt?: number;
}

export interface StoredAccountRecord extends UserAccountData {
  passwordHash: string; // Base64 or plain string for local web matching
  updatedAt: number;
}

const AUTH_STORAGE_KEY = 'lovesync_auth_user';
const WEB_ACCOUNTS_KEY = 'lovesync_web_accounts_v1';

// Helper: Safely get all accounts stored on this website/browser
export function getStoredWebAccounts(): Record<string, StoredAccountRecord> {
  try {
    const raw = localStorage.getItem(WEB_ACCOUNTS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Error reading web accounts:', e);
  }
  return {};
}

// Helper: Save all accounts to local web storage
export function saveStoredWebAccounts(accounts: Record<string, StoredAccountRecord>) {
  try {
    localStorage.setItem(WEB_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch (e) {
    console.error('Error saving web accounts:', e);
  }
}

// Get currently authenticated active user session from web storage
export function getCurrentAuthUser(): UserAccountData | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {}
  return null;
}

// Helper: encode password safely
function hashPassword(pass: string): string {
  try {
    return btoa(unescape(encodeURIComponent(pass)));
  } catch {
    return btoa(pass);
  }
}

function verifyPassword(inputPass: string, storedHash: string): boolean {
  if (storedHash === inputPass) return true;
  if (storedHash === hashPassword(inputPass)) return true;
  try {
    if (btoa(inputPass) === storedHash) return true;
  } catch {}
  return false;
}

// 1. Register with Username & Password (SAVED ON SERVER & PERSISTED ACROSS ALL DEVICES)
export async function registerAccount(
  username: string,
  pass: string,
  displayName?: string,
  birthday?: string,
  roomCode?: string
): Promise<UserAccountData> {
  const cleanUsername = username.trim().toLowerCase();
  const cleanPass = pass.trim();

  if (cleanUsername.length < 2) {
    throw new Error('Tên tài khoản cần tối thiểu 2 ký tự.');
  }
  if (cleanPass.length < 4) {
    throw new Error('Mật khẩu cần tối thiểu 4 ký tự.');
  }

  const effectiveDisplayName = displayName && displayName.trim() ? displayName.trim() : cleanUsername;
  const assignedRoom = roomCode && roomCode.trim() 
    ? roomCode.trim().toUpperCase() 
    : `ROOM-${cleanUsername.toUpperCase()}`;

  // 1. Submit to Backend Server first so the account exists for ALL devices
  let serverUser: any = null;
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: cleanUsername,
        password: cleanPass,
        displayName: effectiveDisplayName,
        birthday: birthday || '',
        roomCode: assignedRoom,
      }),
    });

    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && data.success && data.user) {
        serverUser = data.user;
      }
    } else {
      const data = await res.json().catch(() => null);
      if (data && data.error && res.status !== 404) {
        throw new Error(data.error);
      }
    }
  } catch (err: any) {
    // If it is a business error (e.g., username taken), rethrow immediately
    if (err.message && err.message.includes('đã được đăng ký')) {
      throw err;
    }
    console.log('[Auth] Server register endpoint unavailable (static hosting/offline). Account saved to local web storage.');
  }

  const newUserData: UserAccountData = {
    id: serverUser?.id || `usr_${cleanUsername}`,
    username: serverUser?.username || cleanUsername,
    displayName: serverUser?.displayName || effectiveDisplayName,
    photoURL: serverUser?.avatar || '',
    avatar: serverUser?.avatar || '',
    birthday: serverUser?.birthday || birthday || '',
    gender: serverUser?.gender || '',
    bio: serverUser?.bio || '',
    loveQuote: serverUser?.loveQuote || '',
    profile: serverUser?.profile || null,
    roomCode: serverUser?.roomCode || assignedRoom,
    authProvider: 'username',
    createdAt: Date.now(),
  };

  // 2. Save into browser cache for instant local retrieval
  const existingAccounts = getStoredWebAccounts();
  existingAccounts[cleanUsername] = {
    ...newUserData,
    passwordHash: hashPassword(cleanPass),
    updatedAt: Date.now(),
  };
  saveStoredWebAccounts(existingAccounts);

  // Set active session in browser
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newUserData));

  return newUserData;
}

// 2. Login with Username & Password (AUTHENTICATES WITH SERVER ACROSS ALL DEVICES)
export async function loginAccount(username: string, pass: string): Promise<UserAccountData> {
  const cleanUsername = username.trim().toLowerCase();
  const cleanPass = pass.trim();

  if (!cleanUsername || !cleanPass) {
    throw new Error('Vui lòng nhập tên tài khoản và mật khẩu.');
  }

  const webAccounts = getStoredWebAccounts();

  // 1. Authenticate with Server API (Works across all devices & mobile)
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: cleanUsername,
        password: cleanPass,
      }),
    });

    const data = await res.json();
    if (res.ok && data.success && data.user) {
      const userData: UserAccountData = {
        id: data.user.id || `usr_${cleanUsername}`,
        username: data.user.username,
        displayName: data.user.displayName,
        photoURL: data.user.avatar || '',
        avatar: data.user.avatar || '',
        birthday: data.user.birthday,
        gender: data.user.gender,
        bio: data.user.bio,
        loveQuote: data.user.loveQuote,
        profile: data.user.profile,
        roomCode: data.user.roomCode,
        partnerUsername: data.user.partnerUsername,
        partnerDisplayName: data.user.partnerDisplayName,
        authProvider: 'username',
        gdriveConnected: data.user.gdriveConnected,
        gdriveEmail: data.user.gdriveEmail,
        gdriveDisplayName: data.user.gdriveDisplayName,
        gdriveFolderUrl: data.user.gdriveFolderUrl,
        gdriveLastSaved: data.user.gdriveLastSaved,
      };

      // Save into local web storage cache
      webAccounts[cleanUsername] = {
        ...userData,
        passwordHash: hashPassword(cleanPass),
        updatedAt: Date.now(),
      };
      saveStoredWebAccounts(webAccounts);

      // Save active session
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userData));
      return userData;
    } else {
      // Server returned explicit error (e.g. 404 account not found, or 401 wrong password)
      throw new Error(data.error || 'Tài khoản hoặc mật khẩu không chính xác.');
    }
  } catch (err: any) {
    // If server returned specific rejection, rethrow it
    if (err.message && !err.message.includes('Failed to fetch') && !err.message.includes('NetworkError')) {
      throw err;
    }

    // 2. Offline fallback: check local web storage accounts if network is disconnected
    const localAcc = webAccounts[cleanUsername];
    if (localAcc) {
      if (!verifyPassword(cleanPass, localAcc.passwordHash)) {
        throw new Error('Mật khẩu không chính xác. Vui lòng kiểm tra lại.');
      }

      const userData: UserAccountData = {
        id: localAcc.id || `usr_${cleanUsername}`,
        username: localAcc.username,
        displayName: localAcc.displayName || localAcc.username,
        photoURL: localAcc.avatar || localAcc.photoURL || '',
        avatar: localAcc.avatar || localAcc.photoURL || '',
        birthday: localAcc.birthday,
        gender: localAcc.gender,
        bio: localAcc.bio,
        loveQuote: localAcc.loveQuote,
        profile: localAcc.profile,
        roomCode: localAcc.roomCode,
        partnerUsername: localAcc.partnerUsername,
        partnerDisplayName: localAcc.partnerDisplayName,
        authProvider: 'username',
      };

      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userData));
      return userData;
    }

    throw new Error(err.message || `Tài khoản "${cleanUsername}" không tồn tại trên hệ thống.`);
  }
}

// 3. Sign In with Google Popup
export async function loginWithGoogle(roomCode?: string): Promise<UserAccountData | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    const assignedRoom = roomCode && roomCode.trim() 
      ? roomCode.trim().toUpperCase() 
      : `ROOM-${user.uid.substring(0, 6).toUpperCase()}`;

    let userData: UserAccountData = {
      id: user.uid,
      username: user.email?.split('@')[0] || user.uid,
      displayName: user.displayName || 'Người dùng Google',
      photoURL: user.photoURL || '',
      avatar: user.photoURL || '',
      email: user.email || '',
      roomCode: assignedRoom,
      authProvider: 'google',
    };

    // Register/sync Google account to server
    try {
      const syncRes = await fetch('/api/auth/google-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          roomCode: assignedRoom,
        }),
      });
      if (syncRes.ok) {
        const syncData = await syncRes.json();
        if (syncData.success && syncData.user) {
          userData = {
            ...userData,
            roomCode: syncData.user.roomCode || assignedRoom,
            partnerUsername: syncData.user.partnerUsername,
            partnerDisplayName: syncData.user.partnerDisplayName,
            birthday: syncData.user.birthday,
            gender: syncData.user.gender,
            bio: syncData.user.bio,
            loveQuote: syncData.user.loveQuote,
            profile: syncData.user.profile,
          };
        }
      }
    } catch {}

    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userData));
    return userData;
  } catch (err: any) {
    if (
      err?.code === 'auth/popup-closed-by-user' ||
      err?.code === 'auth/cancelled-popup-request' ||
      err?.message?.includes('popup-closed-by-user')
    ) {
      return null;
    }
    throw err;
  }
}

// 4. Sign Out (Clears active session while keeping web storage intact)
export async function logoutAccount(): Promise<void> {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  try {
    await firebaseSignOut(auth);
  } catch (e) {}
}

// 5. Listen to Auth state changes
export function subscribeToAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

// 6. Link Partner Account (1-1 couple pairing)
export async function linkPartnerAccountService(partnerUsername: string): Promise<{ success: boolean; roomCode: string; partner: any }> {
  const current = getCurrentAuthUser();
  if (!current || !current.username) {
    throw new Error('Vui lòng đăng nhập tài khoản trước khi liên kết với người yêu.');
  }

  const cleanPartner = partnerUsername.trim().toLowerCase();
  if (!cleanPartner) {
    throw new Error('Vui lòng nhập tên tài khoản của người yêu.');
  }

  // Update in web storage
  const accounts = getStoredWebAccounts();
  const myAcc = accounts[current.username];
  const partnerAcc = accounts[cleanPartner];

  const sharedRoom = partnerAcc?.roomCode || myAcc?.roomCode || `ROOM-${current.username.toUpperCase()}`;

  const partnerInfo = {
    username: cleanPartner,
    displayName: partnerAcc?.displayName || cleanPartner,
  };

  if (myAcc) {
    myAcc.partnerUsername = cleanPartner;
    myAcc.partnerDisplayName = partnerInfo.displayName;
    myAcc.roomCode = sharedRoom;
    saveStoredWebAccounts(accounts);
  }

  const updatedUser: UserAccountData = {
    ...current,
    roomCode: sharedRoom,
    partnerUsername: cleanPartner,
    partnerDisplayName: partnerInfo.displayName,
  };
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedUser));

  // Sync to server
  try {
    fetch('/api/auth/link-partner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: current.username,
        partnerUsername: cleanPartner,
      }),
    }).catch(() => {});
  } catch {}

  return {
    success: true,
    roomCode: sharedRoom,
    partner: partnerInfo,
  };
}

// 7. Unlink Partner Account (Separates accounts into separate rooms)
export async function unlinkPartnerAccountService(
  userId?: string,
  currentRoomCode?: string
): Promise<{ success: boolean; newRoomCode: string }> {
  const current = getCurrentAuthUser();
  const cleanUsername = current?.username || '';
  const fallbackRoom = cleanUsername
    ? `ROOM-${cleanUsername.toUpperCase().replace(/[^A-Z0-9]/g, '')}`
    : `LOVE-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

  let newAssignedRoom = fallbackRoom;

  if (cleanUsername) {
    const accounts = getStoredWebAccounts();
    if (accounts[cleanUsername]) {
      delete accounts[cleanUsername].partnerUsername;
      delete accounts[cleanUsername].partnerDisplayName;
      accounts[cleanUsername].roomCode = fallbackRoom;
      saveStoredWebAccounts(accounts);
    }

    const updatedUser: UserAccountData = {
      ...current,
      partnerUsername: undefined,
      partnerDisplayName: undefined,
      roomCode: fallbackRoom,
    };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedUser));
  }

  try {
    const res = await fetch('/api/auth/unlink-partner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: cleanUsername,
        userId,
        currentRoomCode,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.newRoomCode) {
        newAssignedRoom = data.newRoomCode;
      }
    }
  } catch {}

  return { success: true, newRoomCode: newAssignedRoom };
}

// 8. Leave Room Service
export async function leaveRoomService(roomCode: string, userId: string, username?: string): Promise<void> {
  try {
    await fetch('/api/room/leave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomCode,
        userId,
        username,
      }),
    });
  } catch {}
}

// 9. Request Change Room Code (with optional partner migration if paired)
export async function requestChangeRoomCode(
  oldRoomCode: string,
  newRoomCode: string,
  userId: string,
  migratePartner: boolean = true
): Promise<{ success: boolean; newRoomCode: string }> {
  const current = getCurrentAuthUser();
  const cleanNew = newRoomCode.trim().toUpperCase();

  if (current) {
    const accounts = getStoredWebAccounts();
    if (accounts[current.username]) {
      accounts[current.username].roomCode = cleanNew;
      saveStoredWebAccounts(accounts);
    }
    const updatedUser: UserAccountData = {
      ...current,
      roomCode: cleanNew,
    };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedUser));
  }

  try {
    fetch('/api/room/change-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        oldRoomCode,
        newRoomCode: cleanNew,
        username: current?.username,
        userId,
        migratePartner,
      }),
    }).catch(() => {});
  } catch {}

  return { success: true, newRoomCode: cleanNew };
}

// 10. Fetch user's latest account profile from server (Authoritative Cross-Device Refresh)
export async function fetchUserLatestProfile(username: string): Promise<UserAccountData | null> {
  const clean = username.trim().toLowerCase();

  // 1. Fetch live authoritative data from server first
  try {
    const res = await fetch(`/api/auth/user/${encodeURIComponent(clean)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.user) {
        const liveUser: UserAccountData = {
          id: data.user.id || `usr_${clean}`,
          username: data.user.username,
          displayName: data.user.displayName,
          photoURL: data.user.avatar || '',
          avatar: data.user.avatar || '',
          birthday: data.user.birthday,
          gender: data.user.gender,
          bio: data.user.bio,
          loveQuote: data.user.loveQuote,
          profile: data.user.profile,
          roomCode: data.user.roomCode,
          partnerUsername: data.user.partnerUsername,
          partnerDisplayName: data.user.partnerDisplayName,
          gdriveConnected: data.user.gdriveConnected,
          gdriveEmail: data.user.gdriveEmail,
          gdriveDisplayName: data.user.gdriveDisplayName,
          gdriveFolderUrl: data.user.gdriveFolderUrl,
          gdriveLastSaved: data.user.gdriveLastSaved,
          authProvider: 'username',
        };

        // Update local cache
        const accounts = getStoredWebAccounts();
        if (accounts[clean]) {
          accounts[clean] = {
            ...accounts[clean],
            ...liveUser,
          };
          saveStoredWebAccounts(accounts);
        }

        return liveUser;
      }
    }
  } catch (e) {
    console.warn('Could not fetch latest user profile from server:', e);
  }

  // 2. Fallback to local accounts if server is unreachable
  const accounts = getStoredWebAccounts();
  if (accounts[clean]) {
    return accounts[clean];
  }

  return null;
}

// 11. Update User Profile on Server (Authoritative Cross-Device Persistence)
export async function updateUserProfileOnServer(username: string, profile: any): Promise<any> {
  try {
    const res = await fetch('/api/auth/update-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        profile,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.user) {
        // Update local active session
        const current = getCurrentAuthUser();
        if (current) {
          const updated: UserAccountData = {
            ...current,
            displayName: data.user.displayName || current.displayName,
            photoURL: data.user.avatar || current.photoURL,
            avatar: data.user.avatar || current.avatar,
            birthday: data.user.birthday || current.birthday,
            gender: data.user.gender || current.gender,
            bio: data.user.bio || current.bio,
            loveQuote: data.user.loveQuote || current.loveQuote,
            profile: data.user.profile || current.profile,
          };
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
        }
        return data.user;
      }
    }
  } catch (e) {
    console.warn('Could not update user profile on server:', e);
  }
  return null;
}

// 12. Sync Google Drive Status to Backend User Account
export async function saveGoogleDriveStatusService(params: {
  username?: string;
  roomCode?: string;
  gdriveConnected: boolean;
  gdriveEmail?: string;
  gdriveDisplayName?: string;
  gdriveFolderUrl?: string;
  gdriveLastSaved?: string;
}): Promise<void> {
  try {
    await fetch('/api/auth/gdrive-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  } catch (e) {
    console.warn('Could not save Google Drive status to server:', e);
  }
}

// 12. Change Password without Old Password
export async function changePasswordWithoutOld(
  username: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  const cleanUsername = username.trim().toLowerCase();
  const cleanPass = newPassword.trim();

  if (!cleanUsername) {
    throw new Error('Vui lòng nhập tên tài khoản.');
  }
  if (!cleanPass || cleanPass.length < 4) {
    throw new Error('Mật khẩu mới cần tối thiểu 4 ký tự.');
  }

  // 1. Call server endpoint if available
  try {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: cleanUsername,
        newPassword: cleanPass,
      }),
    });

    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && data.success) {
        // Updated on server
      }
    } else {
      const data = await res.json().catch(() => null);
      if (data && data.error && res.status !== 404) {
        throw new Error(data.error);
      }
    }
  } catch (err: any) {
    if (err.message && !err.message.includes('Failed to fetch') && !err.message.includes('NetworkError') && !err.message.includes('404')) {
      throw err;
    }
  }

  // 2. Update local web accounts cache
  const webAccounts = getStoredWebAccounts();
  if (webAccounts[cleanUsername]) {
    webAccounts[cleanUsername].passwordHash = hashPassword(cleanPass);
    webAccounts[cleanUsername].updatedAt = Date.now();
    saveStoredWebAccounts(webAccounts);
  }

  return {
    success: true,
    message: `Đã đổi mật khẩu cho tài khoản "${cleanUsername}" thành công!`,
  };
}

// 13. Reset and Clear All System & Server Data
export async function clearAllSystemDataService(): Promise<void> {
  try {
    await fetch('/api/system/clear-all-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.warn('Could not clear server data:', e);
  }
}
