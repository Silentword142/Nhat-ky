import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const app = express();
const server = http.createServer(app);

// Increase JSON payload limit for photos & canvas cards
app.use(express.json({ limit: '50mb' }));

// Ensure data storage directory exists
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'rooms_db.json');
const USERS_FILE = path.join(DATA_DIR, 'users_db.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export interface UserAccount {
  id: string;
  username: string; // trimmed lowercase
  passwordHash: string;
  displayName: string;
  avatar?: string;
  birthday?: string;
  gender?: string;
  bio?: string;
  loveQuote?: string;
  profile?: any;
  roomCode: string;
  partnerUsername?: string;
  partnerDisplayName?: string;
  // Google Drive cross-device integration metadata
  gdriveConnected?: boolean;
  gdriveEmail?: string;
  gdriveDisplayName?: string;
  gdriveFolderUrl?: string;
  gdriveLastSaved?: string;
  createdAt: number;
  lastLogin: number;
  updatedAt?: number;
}

interface UserDatabase {
  [username: string]: UserAccount;
}

let usersDb: UserDatabase = {};

// Load users database from file if exists
try {
  if (fs.existsSync(USERS_FILE)) {
    const raw = fs.readFileSync(USERS_FILE, 'utf-8');
    usersDb = JSON.parse(raw);
    console.log(`Loaded ${Object.keys(usersDb).length} user accounts from storage.`);
  }
} catch (err) {
  console.error('Error loading users database:', err);
}

function saveUsersDb() {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(usersDb, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving users database:', err);
  }
}

// Password hashing helper (deterministic SHA-256 for unicode & cross-device compatibility)
function hashUserPassword(password: string): string {
  return crypto.createHash('sha256').update(password.trim()).digest('hex');
}

// Verify password with multiple format support (SHA256, base64, UTF8 base64, plaintext)
function verifyUserPassword(inputPass: string, storedHash: string): boolean {
  if (!storedHash || !inputPass) return false;
  const cleanInput = inputPass.trim();

  // 1. SHA-256 hash match
  const sha = crypto.createHash('sha256').update(cleanInput).digest('hex');
  if (storedHash === sha) return true;

  // 2. Standard Base64 match
  try {
    const b64 = Buffer.from(cleanInput).toString('base64');
    if (storedHash === b64) return true;
  } catch {}

  // 3. UTF-8 URI encoded Base64 match
  try {
    const utf8B64 = Buffer.from(encodeURIComponent(cleanInput)).toString('base64');
    if (storedHash === utf8B64) return true;
  } catch {}

  // 4. Plain text match
  if (storedHash === cleanInput || storedHash === inputPass) return true;

  return false;
}

export interface CoupleRoomState {
  roomCode: string;
  diaries: any[];
  photos: any[];
  cards: any[];
  anniversaries: any[];
  playlist?: any[];
  albums?: any[];
  settings?: any;
  profiles: {
    [userId: string]: any;
  };
  deletedItemIds?: string[];
  migratedTo?: string;
  migratedAt?: number;
  migratedBy?: string;
  updatedAt: number;
}

interface RoomDatabase {
  [roomCode: string]: CoupleRoomState;
}

let roomsDb: RoomDatabase = {};

// Load database from file if exists
try {
  if (fs.existsSync(DB_FILE)) {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    roomsDb = JSON.parse(raw);
    console.log(`Loaded ${Object.keys(roomsDb).length} couple rooms from storage.`);
  }
} catch (err) {
  console.error('Error loading rooms database:', err);
}

// Helper to persist database safely to disk
function saveDb() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(roomsDb, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving rooms database:', err);
  }
}

// Initialize Gemini AI client lazily
let geminiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI | null {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return geminiClient;
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ==========================================
// USER AUTHENTICATION & ROOM LINKING APIS
// ==========================================

// Register Account (Works across all devices & browsers!)
app.post('/api/auth/register', (req, res) => {
  try {
    const { username, password, displayName, birthday, roomCode } = req.body;
    
    if (!username || typeof username !== 'string' || username.trim().length < 2) {
      return res.status(400).json({ success: false, error: 'Tên tài khoản cần tối thiểu 2 ký tự.' });
    }
    if (!password || typeof password !== 'string' || password.trim().length < 4) {
      return res.status(400).json({ success: false, error: 'Mật khẩu cần tối thiểu 4 ký tự.' });
    }

    const cleanUsername = username.trim().toLowerCase();

    if (usersDb[cleanUsername]) {
      return res.status(400).json({
        success: false,
        error: `Tên tài khoản "${username.trim()}" đã được đăng ký trên hệ thống. Bạn hãy chọn tên khác hoặc chuyển sang tab Đăng Nhập nhé.`,
      });
    }

    const assignedRoom = roomCode && roomCode.trim() 
      ? roomCode.trim().toUpperCase()
      : `ROOM-${cleanUsername.toUpperCase()}`;

    const newAccount: UserAccount = {
      id: `usr_${cleanUsername}`,
      username: cleanUsername,
      passwordHash: hashUserPassword(password),
      displayName: displayName && displayName.trim() ? displayName.trim() : username.trim(),
      birthday: birthday || undefined,
      roomCode: assignedRoom,
      createdAt: Date.now(),
      lastLogin: Date.now(),
      updatedAt: Date.now(),
    };

    usersDb[cleanUsername] = newAccount;
    saveUsersDb();

    // Ensure the assigned room exists in roomsDb
    if (!roomsDb[assignedRoom]) {
      roomsDb[assignedRoom] = {
        roomCode: assignedRoom,
        diaries: [],
        photos: [],
        cards: [],
        anniversaries: [],
        settings: {
          coupleName: newAccount.displayName,
          roomCode: assignedRoom,
        },
        profiles: {
          [newAccount.id]: {
            id: newAccount.id,
            username: newAccount.username,
            name: newAccount.displayName,
            birthday: newAccount.birthday || '',
            lastActive: Date.now(),
          },
        },
        deletedItemIds: [],
        updatedAt: Date.now(),
      };
      saveDb();
    }

    console.log(`[AUTH] Registered new account: "${cleanUsername}" for room: "${assignedRoom}"`);

    return res.json({
      success: true,
      user: {
        id: newAccount.id,
        username: newAccount.username,
        displayName: newAccount.displayName,
        avatar: newAccount.avatar,
        birthday: newAccount.birthday,
        gender: newAccount.gender,
        bio: newAccount.bio,
        loveQuote: newAccount.loveQuote,
        profile: newAccount.profile,
        roomCode: newAccount.roomCode,
        gdriveConnected: newAccount.gdriveConnected || false,
        gdriveEmail: newAccount.gdriveEmail || '',
        gdriveDisplayName: newAccount.gdriveDisplayName || '',
        gdriveFolderUrl: newAccount.gdriveFolderUrl || '',
        gdriveLastSaved: newAccount.gdriveLastSaved || '',
      },
    });
  } catch (err: any) {
    console.error('Registration API error:', err);
    return res.status(500).json({ success: false, error: 'Lỗi máy chủ khi đăng ký tài khoản.' });
  }
});

// Login Account (Works across all devices & browsers!)
app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Vui lòng nhập tên tài khoản và mật khẩu.' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const account = usersDb[cleanUsername];

    if (!account) {
      return res.status(404).json({
        success: false,
        error: `Tài khoản "${username.trim()}" không tồn tại trên hệ thống. Bạn hãy kiểm tra lại hoặc chuyển sang Đăng Ký nhé.`,
      });
    }

    if (!verifyUserPassword(password, account.passwordHash)) {
      return res.status(401).json({
        success: false,
        error: 'Mật khẩu không chính xác. Vui lòng kiểm tra lại.',
      });
    }

    account.lastLogin = Date.now();
    // Upgrade password hash to SHA-256 if it was previously legacy base64
    if (account.passwordHash.length !== 64) {
      account.passwordHash = hashUserPassword(password);
    }
    saveUsersDb();

    // Ensure user room exists
    if (account.roomCode && !roomsDb[account.roomCode]) {
      roomsDb[account.roomCode] = {
        roomCode: account.roomCode,
        diaries: [],
        photos: [],
        cards: [],
        anniversaries: [],
        settings: { roomCode: account.roomCode },
        profiles: {},
        deletedItemIds: [],
        updatedAt: Date.now(),
      };
      saveDb();
    }

    console.log(`[AUTH] User logged in successfully: "${cleanUsername}"`);

    return res.json({
      success: true,
      user: {
        id: account.id || `usr_${account.username}`,
        username: account.username,
        displayName: account.displayName,
        avatar: account.avatar,
        birthday: account.birthday,
        gender: account.gender,
        bio: account.bio,
        loveQuote: account.loveQuote,
        profile: account.profile,
        roomCode: account.roomCode,
        partnerUsername: account.partnerUsername,
        partnerDisplayName: account.partnerDisplayName,
        gdriveConnected: account.gdriveConnected || false,
        gdriveEmail: account.gdriveEmail || '',
        gdriveDisplayName: account.gdriveDisplayName || '',
        gdriveFolderUrl: account.gdriveFolderUrl || '',
        gdriveLastSaved: account.gdriveLastSaved || '',
      },
    });
  } catch (err: any) {
    console.error('Login API error:', err);
    return res.status(500).json({ success: false, error: 'Lỗi máy chủ khi đăng nhập.' });
  }
});

// Fetch User Profile (For cross-device authoritative state refresh)
app.get('/api/auth/user/:username', (req, res) => {
  const cleanUsername = req.params.username.trim().toLowerCase();
  const account = usersDb[cleanUsername];
  if (!account) {
    return res.status(404).json({ success: false, error: 'Không tìm thấy tài khoản.' });
  }
  return res.json({
    success: true,
    user: {
      id: account.id,
      username: account.username,
      displayName: account.displayName,
      avatar: account.avatar,
      birthday: account.birthday,
      gender: account.gender,
      bio: account.bio,
      loveQuote: account.loveQuote,
      profile: account.profile,
      roomCode: account.roomCode,
      partnerUsername: account.partnerUsername,
      partnerDisplayName: account.partnerDisplayName,
      gdriveConnected: account.gdriveConnected || false,
      gdriveEmail: account.gdriveEmail || '',
      gdriveDisplayName: account.gdriveDisplayName || '',
      gdriveFolderUrl: account.gdriveFolderUrl || '',
      gdriveLastSaved: account.gdriveLastSaved || '',
    },
  });
});

// Update User Account Profile on Server (Authoritative Cross-Device Profile Persistence)
app.post('/api/auth/update-profile', (req, res) => {
  try {
    const { username, profile } = req.body;
    if (!username) {
      return res.status(400).json({ success: false, error: 'Thiếu tên tài khoản.' });
    }
    const cleanUser = username.trim().toLowerCase();
    const account = usersDb[cleanUser];
    if (!account) {
      return res.status(404).json({ success: false, error: 'Tài khoản không tồn tại.' });
    }

    if (profile && typeof profile === 'object') {
      if (profile.name) account.displayName = profile.name;
      if (profile.avatar !== undefined) account.avatar = profile.avatar;
      if (profile.birthday !== undefined) account.birthday = profile.birthday;
      if (profile.gender !== undefined) account.gender = profile.gender;
      if (profile.bio !== undefined) account.bio = profile.bio;
      if (profile.loveQuote !== undefined) account.loveQuote = profile.loveQuote;
      account.profile = { ...(account.profile || {}), ...profile };
      account.updatedAt = Date.now();
      saveUsersDb();

      // Also persist to current room's profile list
      if (account.roomCode && roomsDb[account.roomCode]) {
        const room = roomsDb[account.roomCode];
        if (!room.profiles) room.profiles = {};
        const uid = account.id || `usr_${cleanUser}`;
        room.profiles[uid] = {
          ...(room.profiles[uid] || {}),
          ...profile,
          id: uid,
          username: cleanUser,
          name: account.displayName,
          avatar: account.avatar || profile.avatar,
          birthday: account.birthday || profile.birthday,
          gender: account.gender || profile.gender,
          bio: account.bio || profile.bio,
          loveQuote: account.loveQuote || profile.loveQuote,
          lastActive: Date.now(),
        };
        room.updatedAt = Date.now();
        saveDb();

        broadcastToRoom(account.roomCode, null, {
          event: 'room_state_broadcast',
          room,
          updatedAt: room.updatedAt,
        });
      }
    }

    return res.json({
      success: true,
      user: {
        id: account.id,
        username: account.username,
        displayName: account.displayName,
        avatar: account.avatar,
        birthday: account.birthday,
        gender: account.gender,
        bio: account.bio,
        loveQuote: account.loveQuote,
        profile: account.profile,
        roomCode: account.roomCode,
        partnerUsername: account.partnerUsername,
        partnerDisplayName: account.partnerDisplayName,
        gdriveConnected: account.gdriveConnected || false,
        gdriveEmail: account.gdriveEmail || '',
        gdriveDisplayName: account.gdriveDisplayName || '',
        gdriveFolderUrl: account.gdriveFolderUrl || '',
        gdriveLastSaved: account.gdriveLastSaved || '',
      },
    });
  } catch (err: any) {
    console.error('Error updating user profile on server:', err);
    return res.status(500).json({ success: false, error: 'Lỗi cập nhật hồ sơ.' });
  }
});

// Google Account Sync to Server Database
app.post('/api/auth/google-sync', (req, res) => {
  try {
    const { uid, email, displayName, photoURL, roomCode } = req.body;
    if (!uid) return res.status(400).json({ success: false, error: 'Missing UID' });
    const cleanUsername = (email ? email.split('@')[0] : uid).toLowerCase();

    let account = usersDb[cleanUsername];
    if (!account) {
      const assignedRoom = roomCode && roomCode.trim() ? roomCode.trim().toUpperCase() : `ROOM-${cleanUsername.toUpperCase()}`;
      account = {
        id: uid,
        username: cleanUsername,
        passwordHash: '',
        displayName: displayName || cleanUsername,
        avatar: photoURL || '',
        roomCode: assignedRoom,
        createdAt: Date.now(),
        lastLogin: Date.now(),
        updatedAt: Date.now(),
      };
      usersDb[cleanUsername] = account;
      saveUsersDb();
    } else {
      account.lastLogin = Date.now();
      if (displayName) account.displayName = displayName;
      if (photoURL) account.avatar = photoURL;
      saveUsersDb();
    }

    return res.json({
      success: true,
      user: {
        id: account.id,
        username: account.username,
        displayName: account.displayName,
        avatar: account.avatar,
        birthday: account.birthday,
        gender: account.gender,
        bio: account.bio,
        loveQuote: account.loveQuote,
        profile: account.profile,
        roomCode: account.roomCode,
        partnerUsername: account.partnerUsername,
        partnerDisplayName: account.partnerDisplayName,
        gdriveConnected: account.gdriveConnected || false,
        gdriveEmail: account.gdriveEmail || '',
        gdriveDisplayName: account.gdriveDisplayName || '',
        gdriveFolderUrl: account.gdriveFolderUrl || '',
        gdriveLastSaved: account.gdriveLastSaved || '',
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Update Google Drive Integration Status on User Account & Room
app.post('/api/auth/gdrive-status', (req, res) => {
  try {
    const { username, roomCode, gdriveConnected, gdriveEmail, gdriveDisplayName, gdriveFolderUrl, gdriveLastSaved } = req.body;
    
    if (username && typeof username === 'string') {
      const cleanUsername = username.trim().toLowerCase();
      if (usersDb[cleanUsername]) {
        usersDb[cleanUsername].gdriveConnected = !!gdriveConnected;
        if (gdriveEmail !== undefined) usersDb[cleanUsername].gdriveEmail = gdriveEmail;
        if (gdriveDisplayName !== undefined) usersDb[cleanUsername].gdriveDisplayName = gdriveDisplayName;
        if (gdriveFolderUrl !== undefined) usersDb[cleanUsername].gdriveFolderUrl = gdriveFolderUrl;
        if (gdriveLastSaved !== undefined) usersDb[cleanUsername].gdriveLastSaved = gdriveLastSaved;
        saveUsersDb();
        console.log(`[GDRIVE] Updated Drive status for user "${cleanUsername}": connected=${gdriveConnected}`);
      }
    }

    if (roomCode && typeof roomCode === 'string') {
      const upperRoom = roomCode.trim().toUpperCase();
      if (roomsDb[upperRoom]) {
        if (!roomsDb[upperRoom].settings) roomsDb[upperRoom].settings = {};
        roomsDb[upperRoom].settings.gdriveBackup = {
          connected: !!gdriveConnected,
          email: gdriveEmail || '',
          folderUrl: gdriveFolderUrl || '',
          lastSaved: gdriveLastSaved || new Date().toISOString(),
        };
        roomsDb[upperRoom].updatedAt = Date.now();
        saveDb();
      }
    }

    return res.json({ success: true, message: 'Đã cập nhật trạng thái Google Drive thành công.' });
  } catch (err: any) {
    console.error('Error updating gdrive status:', err);
    return res.status(500).json({ success: false, error: 'Lỗi cập nhật trạng thái Google Drive.' });
  }
});

// Clear All System Data (Clean wipe of users and rooms)
app.post('/api/system/clear-all-data', (req, res) => {
  try {
    console.log('[SYSTEM] Clearing all system data: wiping usersDb and roomsDb.');
    usersDb = {};
    roomsDb = {};
    saveUsersDb();
    saveDb();
    return res.json({
      success: true,
      message: 'Toàn bộ dữ liệu trên máy chủ đã được làm sạch hoàn toàn.',
    });
  } catch (err: any) {
    console.error('Error clearing system data:', err);
    return res.status(500).json({ success: false, error: 'Lỗi khi xóa dữ liệu hệ thống.' });
  }
});

// Link Partner Account (1-to-1 couple linking)
app.post('/api/auth/link-partner', (req, res) => {
  try {
    const { username, partnerUsername } = req.body;
    if (!username || !partnerUsername) {
      return res.status(400).json({ success: false, error: 'Vui lòng cung cấp đầy đủ tên tài khoản của 2 bạn.' });
    }

    const cleanUser = username.trim().toLowerCase();
    const cleanPartner = partnerUsername.trim().toLowerCase();

    if (cleanUser === cleanPartner) {
      return res.status(400).json({ success: false, error: 'Bạn không thể tự liên kết với chính mình.' });
    }

    const myAccount = usersDb[cleanUser];
    const partnerAccount = usersDb[cleanPartner];

    if (!myAccount) {
      return res.status(404).json({ success: false, error: `Tài khoản của bạn "${cleanUser}" không tồn tại.` });
    }
    if (!partnerAccount) {
      return res.status(404).json({ success: false, error: `Không tìm thấy tài khoản của người yêu: "${cleanPartner}". Hãy đảm bảo người ấy đã lập tài khoản nhé.` });
    }

    // Determine unified room code
    const sharedRoom = myAccount.roomCode || partnerAccount.roomCode || `ROOM-${cleanUser.toUpperCase()}-${cleanPartner.toUpperCase()}`;

    // Link both accounts together
    myAccount.partnerUsername = cleanPartner;
    myAccount.partnerDisplayName = partnerAccount.displayName;
    myAccount.roomCode = sharedRoom;

    partnerAccount.partnerUsername = cleanUser;
    partnerAccount.partnerDisplayName = myAccount.displayName;
    partnerAccount.roomCode = sharedRoom;

    saveUsersDb();

    console.log(`[AUTH] Linked couple: ${cleanUser} 💖 ${cleanPartner} in room: ${sharedRoom}`);

    return res.json({
      success: true,
      roomCode: sharedRoom,
      partner: {
        username: partnerAccount.username,
        displayName: partnerAccount.displayName,
        birthday: partnerAccount.birthday,
      },
    });
  } catch (err: any) {
    console.error('Error linking partner accounts:', err);
    return res.status(500).json({ success: false, error: 'Lỗi khi liên kết tài khoản.' });
  }
});

// Unlink Partner Account (Cleanly separate both accounts into distinct rooms and remove profiles)
app.post('/api/auth/unlink-partner', (req, res) => {
  try {
    const { username, userId, currentRoomCode } = req.body;
    if (!username && !userId) {
      return res.status(400).json({ success: false, error: 'Vui lòng cung cấp tên tài khoản.' });
    }

    const cleanUser = username ? username.trim().toLowerCase() : null;
    const myAccount = cleanUser ? usersDb[cleanUser] : null;
    const oldPartner = myAccount?.partnerUsername;
    const oldRoom = (currentRoomCode || myAccount?.roomCode || '').toUpperCase().trim();

    // 1. Generate new unique private room codes for both users
    const newMyRoom = cleanUser 
      ? `ROOM-${cleanUser.toUpperCase().replace(/[^A-Z0-9]/g, '')}`
      : `LOVE-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    if (myAccount) {
      delete myAccount.partnerUsername;
      delete myAccount.partnerDisplayName;
      myAccount.roomCode = newMyRoom;

      if (oldPartner && usersDb[oldPartner]) {
        delete usersDb[oldPartner].partnerUsername;
        delete usersDb[oldPartner].partnerDisplayName;
        usersDb[oldPartner].roomCode = `ROOM-${oldPartner.toUpperCase().replace(/[^A-Z0-9]/g, '')}`;
        console.log(`[AUTH] Unlinked partner account "${oldPartner}", assigned new room: "${usersDb[oldPartner].roomCode}"`);
      }

      saveUsersDb();
    }

    // 2. Remove unlinked user profile from the old shared room in roomsDb
    if (oldRoom && roomsDb[oldRoom]) {
      const room = roomsDb[oldRoom];
      if (room.profiles) {
        if (userId) delete room.profiles[userId];
        if (cleanUser) delete room.profiles[cleanUser];
        // Also remove if matching username
        Object.keys(room.profiles).forEach((pId) => {
          if (pId === userId || pId === cleanUser || room.profiles[pId]?.username === cleanUser) {
            delete room.profiles[pId];
          }
        });
      }
      room.updatedAt = Date.now();
      saveDb();

      // Broadcast unlinked event to all sockets in old room
      broadcastToRoom(oldRoom, null, {
        event: 'partner_unlinked',
        unlinkedUser: cleanUser || userId,
        room,
        updatedAt: room.updatedAt,
      });
    }

    console.log(`[AUTH] Successfully unlinked user "${cleanUser || userId}", new room assigned: "${newMyRoom}"`);

    return res.json({ 
      success: true, 
      message: 'Đã hủy liên kết tài khoản thành công.',
      newRoomCode: newMyRoom,
    });
  } catch (err: any) {
    console.error('Error unlinking partner:', err);
    return res.status(500).json({ success: false, error: 'Lỗi hủy liên kết.' });
  }
});

// Leave Room API
app.post('/api/room/leave', (req, res) => {
  try {
    const { roomCode, userId, username } = req.body;
    const cleanCode = (roomCode || '').toUpperCase().trim();
    if (cleanCode && roomsDb[cleanCode]) {
      const room = roomsDb[cleanCode];
      if (room.profiles) {
        if (userId) delete room.profiles[userId];
        if (username) delete room.profiles[username];
        Object.keys(room.profiles).forEach((pId) => {
          if (pId === userId || (username && (pId === username || room.profiles[pId]?.username === username))) {
            delete room.profiles[pId];
          }
        });
      }
      room.updatedAt = Date.now();
      saveDb();

      broadcastToRoom(cleanCode, null, {
        event: 'room_state_broadcast',
        room,
        updatedAt: room.updatedAt,
        leftUserId: userId,
      });
    }
    return res.json({ success: true, message: 'Đã rời phòng thành công.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Lỗi khi rời phòng.' });
  }
});

// Change Room Code (With optional partner migration if paired)
app.post('/api/room/change-code', (req, res) => {
  try {
    const { oldRoomCode, newRoomCode, username, userId, migratePartner } = req.body;
    if (!newRoomCode || typeof newRoomCode !== 'string') {
      return res.status(400).json({ success: false, error: 'Mã phòng mới không hợp lệ.' });
    }

    const oldCode = (oldRoomCode || '').toUpperCase().trim();
    const newCode = newRoomCode.toUpperCase().trim();

    if (!newCode) {
      return res.status(400).json({ success: false, error: 'Mã phòng không được để trống.' });
    }

    if (oldCode === newCode) {
      return res.json({ success: true, roomCode: newCode, message: 'Mã phòng không thay đổi.' });
    }

    console.log(`[ROOM] Changing room from "${oldCode}" to "${newCode}" by user "${username || userId}" (migratePartner: ${!!migratePartner})`);

    const cleanUser = username ? username.trim().toLowerCase() : null;
    const isLinkedPair = cleanUser && usersDb[cleanUser]?.partnerUsername && migratePartner;

    // 1. If actively linked couple and requesting migration of both:
    if (isLinkedPair && oldCode) {
      if (!roomsDb[oldCode]) {
        roomsDb[oldCode] = {
          roomCode: oldCode,
          diaries: [],
          photos: [],
          cards: [],
          anniversaries: [],
          profiles: {},
          updatedAt: Date.now(),
        };
      }
      roomsDb[oldCode].migratedTo = newCode;
      roomsDb[oldCode].migratedAt = Date.now();
      roomsDb[oldCode].migratedBy = username || userId || 'partner';
      roomsDb[oldCode].updatedAt = Date.now();

      // Copy room contents to new room
      const oldData = roomsDb[oldCode];
      if (!roomsDb[newCode]) {
        roomsDb[newCode] = {
          roomCode: newCode,
          diaries: oldData.diaries || [],
          photos: oldData.photos || [],
          cards: oldData.cards || [],
          anniversaries: oldData.anniversaries || [],
          settings: { ...(oldData.settings || {}), roomCode: newCode },
          profiles: oldData.profiles || {},
          deletedItemIds: oldData.deletedItemIds || [],
          updatedAt: Date.now(),
        };
      }

      // Update linked partner account
      const partner = usersDb[cleanUser].partnerUsername;
      if (partner && usersDb[partner]) {
        usersDb[partner].roomCode = newCode;
        console.log(`[ROOM] Automatically migrated partner account "${partner}" to new room: "${newCode}"`);
      }

      // Broadcast room migration via WebSockets
      broadcastToRoom(oldCode, null, {
        event: 'room_migrated',
        oldRoomCode: oldCode,
        newRoomCode: newCode,
        migratedBy: username || userId,
      });
    } else {
      // 2. Individual user changing room / leaving old room:
      // Remove this user from old room's profiles so partner sees user left
      if (oldCode && roomsDb[oldCode] && roomsDb[oldCode].profiles) {
        if (userId) delete roomsDb[oldCode].profiles[userId];
        if (cleanUser) delete roomsDb[oldCode].profiles[cleanUser];
        Object.keys(roomsDb[oldCode].profiles).forEach((pId) => {
          if (pId === userId || pId === cleanUser || roomsDb[oldCode].profiles[pId]?.username === cleanUser) {
            delete roomsDb[oldCode].profiles[pId];
          }
        });
        roomsDb[oldCode].updatedAt = Date.now();
        broadcastToRoom(oldCode, null, {
          event: 'room_state_broadcast',
          room: roomsDb[oldCode],
          updatedAt: roomsDb[oldCode].updatedAt,
        });
      }

      // Create new room if doesn't exist
      if (!roomsDb[newCode]) {
        roomsDb[newCode] = {
          roomCode: newCode,
          diaries: [],
          photos: [],
          cards: [],
          anniversaries: [],
          settings: { roomCode: newCode },
          profiles: {},
          deletedItemIds: [],
          updatedAt: Date.now(),
        };
      }
    }

    // 3. Update this user's account in usersDb
    if (cleanUser && usersDb[cleanUser]) {
      usersDb[cleanUser].roomCode = newCode;
    }

    saveUsersDb();
    saveDb();

    return res.json({
      success: true,
      oldRoomCode: oldCode,
      newRoomCode: newCode,
      message: `Đã chuyển sang phòng "${newCode}" thành công!`,
    });
  } catch (err: any) {
    console.error('Error changing room code:', err);
    return res.status(500).json({ success: false, error: 'Lỗi khi đổi mã phòng.' });
  }
});

// REST API for instant room state fetch
app.get('/api/room/:roomCode/state', (req, res) => {
  const { roomCode } = req.params;
  const upperCode = (roomCode || 'LOVE-DEFAULT').toUpperCase().trim();
  const room = roomsDb[upperCode];
  if (!room) {
    return res.json({ success: true, exists: false, room: null, serverTime: Date.now() });
  }
  res.json({ success: true, exists: true, room, serverTime: Date.now() });
});

// REST API for smart state synchronization (Push / Merge)
app.post('/api/room/:roomCode/sync', (req, res) => {
  try {
    const { roomCode } = req.params;
    const upperCode = (roomCode || 'LOVE-DEFAULT').toUpperCase().trim();
    const { state, profile, userId } = req.body;

    if (!roomsDb[upperCode]) {
      roomsDb[upperCode] = {
        roomCode: upperCode,
        diaries: state?.diaries || [],
        photos: state?.photos || [],
        cards: state?.cards || [],
        anniversaries: state?.anniversaries || [],
        settings: state?.settings || {},
        profiles: {},
        deletedItemIds: [],
        updatedAt: Date.now(),
      };
    }

    const currentRoom = roomsDb[upperCode];
    if (!currentRoom.deletedItemIds) currentRoom.deletedItemIds = [];
    const deletedSet = new Set(currentRoom.deletedItemIds);

    // Update diaries safely
    if (state && Array.isArray(state.diaries)) {
      currentRoom.diaries = state.diaries;
    }

    // Update photos safely
    if (state && Array.isArray(state.photos)) {
      currentRoom.photos = state.photos;
    }

    // Update cards safely
    if (state && Array.isArray(state.cards)) {
      currentRoom.cards = state.cards;
    }

    // Update anniversaries safely
    if (state && Array.isArray(state.anniversaries)) {
      currentRoom.anniversaries = state.anniversaries;
    }

    // Update playlist safely
    if (state && Array.isArray(state.playlist)) {
      currentRoom.playlist = state.playlist;
    }

    // Update albums safely
    if (state && Array.isArray(state.albums)) {
      currentRoom.albums = state.albums;
    }

    // Merge settings if provided
    if (state && state.settings) {
      currentRoom.settings = { ...currentRoom.settings, ...state.settings };
    }

    // Merge profiles from state if provided
    if (state && state.profiles && typeof state.profiles === 'object') {
      if (!currentRoom.profiles) currentRoom.profiles = {};
      currentRoom.profiles = { ...currentRoom.profiles, ...state.profiles };
    }

    // Update user profile in room
    if (userId && profile) {
      if (!currentRoom.profiles) currentRoom.profiles = {};
      currentRoom.profiles[userId] = {
        ...profile,
        id: userId,
        lastActive: Date.now(),
      };
    }

    currentRoom.updatedAt = Date.now();
    saveDb();

    // Broadcast update to all WebSocket clients in the same room
    broadcastToRoom(upperCode, null, {
      event: 'room_state_broadcast',
      room: currentRoom,
      updatedAt: currentRoom.updatedAt,
      senderId: userId,
    });

    res.json({ success: true, room: currentRoom, serverTime: Date.now() });
  } catch (err: any) {
    console.error('Error syncing room via REST:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// AI Assistant for Couple Prompts & Love Letters
app.post('/api/ai/love-prompt', async (req, res) => {
  try {
    const { type, partnerName, context } = req.body;
    const ai = getGemini();

    if (!ai) {
      const fallbackPrompts: Record<string, string[]> = {
        diary_prompt: [
          'Hôm nay, hãy kể về một khoảnh khắc nhỏ của đối phương khiến tim bạn bỗng đập rộn ràng.',
          'Nếu được quay lại ngày đầu tiên gặp nhau, câu đầu tiên bạn muốn nói với người ấy là gì?',
          'Kể về món ăn mà hai bạn cùng ăn ngon nhất gần đây và tiếng cười lúc đó.',
          'Một thói quen đáng yêu hoặc cử chỉ vô thức của người ấy mà bạn mê mẩn nhất.',
          'Kế hoạch lãng mạn bí mật bạn muốn cùng người ấy thực hiện vào cuối tuần tới.'
        ],
        letter_inspiration: [
          `Gửi ${partnerName || 'em/anh yêu'}, mỗi buổi sáng thức dậy biết rằng có em trong đời là điều may mắn dịu dàng nhất của anh. Cảm ơn vì đã luôn ở bên, lắng nghe và thấu hiểu. Yêu em thật nhiều!`,
          `Gửi ${partnerName || 'người thương'}, thế giới ngoài kia rộng lớn và bận rộn, nhưng chỉ cần tựa đầu vào vai anh/em, mọi bình yên dường như đều dừng lại nơi đây.`,
          `Kỷ niệm của chúng mình không chỉ là những chuyến đi xa, mà là từng cái nắm tay ấm áp qua từng ngã tư đèn đỏ, từng câu 'chúc ngủ ngon' mỗi tối.`
        ],
        couple_question: [
          'Điều gì ở đối phương khiến bạn cảm thấy an toàn và được bảo bọc nhất?',
          'Nếu chúng mình cùng nuôi một chú thú cưng, bạn muốn đặt tên nó là gì và vì sao?',
          'Bài hát nào mỗi khi vang lên đều khiến bạn nhớ ngay đến người ấy?',
          "Khoảnh khắc nào bạn nhận ra mình đã hoàn toàn 'đổ gục' trước người ấy?"
        ]
      };

      const category = type || 'diary_prompt';
      const list = fallbackPrompts[category] || fallbackPrompts.diary_prompt;
      const randomPrompt = list[Math.floor(Math.random() * list.length)];
      return res.json({ success: true, text: randomPrompt, isAiGenerated: false });
    }

    let promptSystem = 'Bạn là trợ lý tình yêu lãng mạn, ngọt ngào, tinh tế của ứng dụng LoveSync dành cho các cặp đôi đang yêu nhau.';
    let promptUser = '';

    if (type === 'diary_prompt') {
      promptUser = `Hãy gợi ý một chủ đề viết nhật ký cặp đôi thật sâu sắc, ngọt ngào và gợi cảm xúc cho 2 người yêu nhau (người yêu tên là ${partnerName || 'người ấy'}). Viết ngắn gọn trong 1-2 câu truyền cảm hứng kèm emoji dễ thương.`;
    } else if (type === 'letter_inspiration') {
      promptUser = `Hãy viết một bức thư tình ngắn ngọt ngào, chân thành và ấm áp dành tặng cho ${partnerName || 'người yêu'}, nói về ${context || 'sự trân trọng và tình yêu sâu đậm mỗi ngày'}. Độ dài khoảng 80-120 từ tiếng Việt, có emoji lãng mạn.`;
    } else if (type === 'couple_question') {
      promptUser = `Hãy đưa ra 1 câu hỏi tương tác tình yêu ngọt ngào, thú vị và gắn kết tâm hồn dành cho cặp đôi đang yêu nhau.`;
    } else {
      promptUser = `Hãy viết 1 câu danh ngôn hoặc lời chúc tình yêu ngọt ngào dành cho cặp đôi.`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: promptUser,
      config: {
        systemInstruction: promptSystem,
        temperature: 0.8,
      }
    });

    const outputText = response.text || 'Tình yêu là khi hai trái tim cùng chung một nhịp đập 💖';
    res.json({ success: true, text: outputText.trim(), isAiGenerated: true });
  } catch (error) {
    console.error('AI generation error:', error);
    res.json({
      success: true,
      text: 'Mỗi khoảnh khắc bên người ấy đều là một trang nhật ký ngập tràn hạnh phúc ✨💖',
      isAiGenerated: false,
    });
  }
});

// YouTube Music Search API (Browser-like live search)
app.get('/api/youtube/search', async (req, res) => {
  const query = (req.query.q as string || '').trim();
  if (!query) {
    return res.json({ success: true, results: [] });
  }

  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' audio lyric tình yêu')}`;
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    const html = await response.text();
    let ytInitialData: any = null;

    const jsonMatch = html.match(/var ytInitialData = ({.*?});<\/script>/s) ||
                      html.match(/window\["ytInitialData"\] = ({.*?});<\/script>/s);

    if (jsonMatch && jsonMatch[1]) {
      try {
        ytInitialData = JSON.parse(jsonMatch[1]);
      } catch (e) {
        console.warn('JSON parse error in ytInitialData:', e);
      }
    }

    const results: any[] = [];

    if (ytInitialData) {
      const sectionContents = ytInitialData?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
      for (const section of sectionContents) {
        const items = section?.itemSectionRenderer?.contents || [];
        for (const item of items) {
          if (item.videoRenderer && item.videoRenderer.videoId) {
            const v = item.videoRenderer;
            const videoId = v.videoId;
            const title = v.title?.runs?.[0]?.text || v.title?.accessibility?.accessibilityData?.label || 'Bản tình ca';
            const artist = v.ownerText?.runs?.[0]?.text || v.shortBylineText?.runs?.[0]?.text || 'Nghệ sĩ';
            const duration = v.lengthText?.simpleText || '';
            const thumbs = v.thumbnail?.thumbnails || [];
            const coverImage = thumbs[thumbs.length - 1]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

            results.push({
              id: `yt-${videoId}`,
              youtubeId: videoId,
              title: title.replace(/&amp;/g, '&').replace(/&quot;/g, '"'),
              artist: artist.replace(/&amp;/g, '&'),
              duration,
              coverImage,
              url: `https://www.youtube.com/watch?v=${videoId}`,
              source: 'youtube',
              isCustom: true,
            });

            if (results.length >= 15) break;
          }
        }
        if (results.length >= 15) break;
      }
    }

    // Curated fallback if parsing returns fewer results
    if (results.length === 0) {
      const curated = [
        {
          id: 'yt-jfKfPfyJRdk',
          youtubeId: 'jfKfPfyJRdk',
          title: `Tình Ca Lofi Chill - ${query}`,
          artist: 'V-Pop Lofi',
          duration: '3:45',
          coverImage: 'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=300&auto=format&fit=crop&q=80',
          url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
          source: 'youtube',
        },
        {
          id: 'yt-4xDzrJKXOOY',
          youtubeId: '4xDzrJKXOOY',
          title: `Piano Lãng Mạn Cặp Đôi - ${query}`,
          artist: 'Romantic Melody',
          duration: '4:10',
          coverImage: 'https://images.unsplash.com/photo-1520523839898-50712825e3a7?w=300&auto=format&fit=crop&q=80',
          url: 'https://www.youtube.com/watch?v=4xDzrJKXOOY',
          source: 'youtube',
        },
        {
          id: 'yt-WPni755-Krg',
          youtubeId: 'WPni755-Krg',
          title: `Acoustic Tình Yêu - ${query}`,
          artist: 'Acoustic Soul',
          duration: '3:20',
          coverImage: 'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=300&auto=format&fit=crop&q=80',
          url: 'https://www.youtube.com/watch?v=WPni755-Krg',
          source: 'youtube',
        }
      ];
      return res.json({ success: true, results: curated, fallback: true });
    }

    res.json({ success: true, results });
  } catch (err) {
    console.error('YouTube search error:', err);
    res.json({
      success: true,
      results: [
        {
          id: 'yt-jfKfPfyJRdk',
          youtubeId: 'jfKfPfyJRdk',
          title: `Bản Tình Ca Hẹn Hò Chill 💖 (${query})`,
          artist: 'LoveSync Music Hub',
          duration: '3:45',
          coverImage: 'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=300&auto=format&fit=crop&q=80',
          url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
          source: 'youtube',
        }
      ],
      fallback: true
    });
  }
});

// Setup WebSocket Server for Instant Real-Time Synchronization
const wss = new WebSocketServer({ server, path: '/ws' });

interface ClientSession {
  ws: WebSocket;
  roomCode: string;
  userId: string;
  userName: string;
}

const clients = new Set<ClientSession>();

wss.on('connection', (ws: WebSocket) => {
  let session: ClientSession | null = null;

  ws.on('message', (messageRaw: string) => {
    try {
      const data = JSON.parse(messageRaw.toString());
      const { event, roomCode, userId, payload } = data;
      const upperCode = (roomCode || 'LOVE-DEFAULT').toUpperCase().trim();

      if (event === 'join_room') {
        const clientUserId = userId || `usr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        session = {
          ws,
          roomCode: upperCode,
          userId: clientUserId,
          userName: payload?.name || payload?.profile?.name || 'Người yêu',
        };
        clients.add(session);

        // If room does not exist yet on server, initialize it
        if (!roomsDb[upperCode]) {
          const initial = payload?.initialData || {};
          roomsDb[upperCode] = {
            roomCode: upperCode,
            diaries: Array.isArray(initial.diaries) ? initial.diaries : [],
            photos: Array.isArray(initial.photos) ? initial.photos : [],
            cards: Array.isArray(initial.cards) ? initial.cards : [],
            anniversaries: Array.isArray(initial.anniversaries) ? initial.anniversaries : [],
            settings: initial.settings || {},
            profiles: {},
            deletedItemIds: [],
            updatedAt: Date.now(),
          };
        }

        const room = roomsDb[upperCode];
        if (!room.profiles) room.profiles = {};
        if (!room.deletedItemIds) room.deletedItemIds = [];

        // Register profile
        if (payload?.profile) {
          room.profiles[session.userId] = {
            ...payload.profile,
            id: session.userId,
            lastActive: Date.now(),
          };
          saveDb();
        }

        // Count connected partners in room (excluding this exact ws)
        const roomPartners = Array.from(clients).filter(
          (c) => c.roomCode === upperCode && c.ws !== ws
        );

        // Send full room state immediately to newly connected client
        ws.send(
          JSON.stringify({
            event: 'room_joined',
            roomCode: upperCode,
            partnerOnline: roomPartners.length > 0,
            partnerCount: roomPartners.length,
            room: room,
            serverTime: Date.now(),
          })
        );

        // Notify other clients in the room that partner connected
        broadcastToRoom(upperCode, ws, {
          event: 'partner_connected',
          userId: session.userId,
          profile: payload?.profile,
          timestamp: Date.now(),
        });
      } else if (event === 'couple_action') {
        if (!session) return;
        const currentRoom = roomsDb[session.roomCode];
        if (!currentRoom) return;
        if (!currentRoom.deletedItemIds) currentRoom.deletedItemIds = [];

        const { actionType, item, updates, itemId, emoji, reactionUserId, comment, targetDate } = payload || {};

        switch (actionType) {
          case 'add_diary':
            if (item) {
              currentRoom.diaries = [item, ...currentRoom.diaries.filter((d) => d.id !== item.id)];
            }
            break;
          case 'update_diary':
            if (itemId && updates) {
              currentRoom.diaries = currentRoom.diaries.map((d) =>
                d.id === itemId ? { ...d, ...updates, updatedAt: Date.now() } : d
              );
            }
            break;
          case 'delete_diary':
            if (itemId) {
              currentRoom.deletedItemIds.push(itemId);
              currentRoom.diaries = currentRoom.diaries.filter((d) => d.id !== itemId);
            }
            break;
          case 'delete_all_day_diaries':
            if (targetDate) {
              const toDelete = currentRoom.diaries.filter((d) => d.date === targetDate);
              toDelete.forEach((d) => currentRoom.deletedItemIds?.push(d.id));
              currentRoom.diaries = currentRoom.diaries.filter((d) => d.date !== targetDate);
            }
            break;
          case 'add_diary_reaction':
            if (itemId && emoji && reactionUserId) {
              currentRoom.diaries = currentRoom.diaries.map((d) => {
                if (d.id !== itemId) return d;
                const reactions = { ...(d.reactions || {}) };
                const currentList = reactions[emoji] || [];
                if (currentList.includes(reactionUserId)) {
                  reactions[emoji] = currentList.filter((u: string) => u !== reactionUserId);
                } else {
                  reactions[emoji] = [...currentList, reactionUserId];
                }
                return { ...d, reactions };
              });
            }
            break;
          case 'add_diary_comment':
            if (itemId && comment) {
              currentRoom.diaries = currentRoom.diaries.map((d) =>
                d.id === itemId ? { ...d, comments: [...(d.comments || []), comment] } : d
              );
            }
            break;
          case 'add_photo':
            if (item) {
              currentRoom.photos = [item, ...currentRoom.photos.filter((p) => p.id !== item.id)];
            }
            break;
          case 'add_photos_batch':
            if (Array.isArray(item)) {
              const newIds = new Set(item.map((p) => p.id));
              currentRoom.photos = [...item, ...currentRoom.photos.filter((p) => !newIds.has(p.id))];
            }
            break;
          case 'delete_photo':
            if (itemId) {
              currentRoom.deletedItemIds.push(itemId);
              currentRoom.photos = currentRoom.photos.filter((p) => p.id !== itemId);
            }
            break;
          case 'toggle_photo_like':
            if (itemId && reactionUserId) {
              currentRoom.photos = currentRoom.photos.map((p) => {
                if (p.id !== itemId) return p;
                const likes = p.likes || [];
                const nextLikes = likes.includes(reactionUserId)
                  ? likes.filter((u: string) => u !== reactionUserId)
                  : [...likes, reactionUserId];
                return { ...p, likes: nextLikes };
              });
            }
            break;
          case 'send_card':
            if (item) {
              currentRoom.cards = [item, ...currentRoom.cards.filter((c) => c.id !== item.id)];
            }
            break;
          case 'open_card':
            if (itemId) {
              currentRoom.cards = currentRoom.cards.map((c) =>
                c.id === itemId ? { ...c, isOpened: true, openedAt: Date.now() } : c
              );
            }
            break;
          case 'delete_card':
            if (itemId) {
              currentRoom.deletedItemIds.push(itemId);
              currentRoom.cards = currentRoom.cards.filter((c) => c.id !== itemId);
            }
            break;
          case 'add_anniversary':
            if (item) {
              currentRoom.anniversaries = [...currentRoom.anniversaries.filter((a) => a.id !== item.id), item];
            }
            break;
          case 'update_anniversary':
            if (itemId && updates) {
              currentRoom.anniversaries = currentRoom.anniversaries.map((a) =>
                a.id === itemId ? { ...a, ...updates } : a
              );
            }
            break;
          case 'delete_anniversary':
            if (itemId) {
              currentRoom.deletedItemIds.push(itemId);
              currentRoom.anniversaries = currentRoom.anniversaries.filter((a) => a.id !== itemId);
            }
            break;
          case 'update_settings':
            if (updates) {
              currentRoom.settings = { ...currentRoom.settings, ...updates };
            }
            break;
          case 'update_playlist':
            if (Array.isArray(item)) {
              currentRoom.playlist = item;
            }
            break;
          case 'update_albums':
            if (Array.isArray(item)) {
              currentRoom.albums = item;
            }
            break;
          case 'full_sync':
            if (payload?.fullState) {
              const fs = payload.fullState;
              if (Array.isArray(fs.diaries)) currentRoom.diaries = fs.diaries;
              if (Array.isArray(fs.photos)) currentRoom.photos = fs.photos;
              if (Array.isArray(fs.cards)) currentRoom.cards = fs.cards;
              if (Array.isArray(fs.anniversaries)) currentRoom.anniversaries = fs.anniversaries;
              if (Array.isArray(fs.playlist)) currentRoom.playlist = fs.playlist;
              if (Array.isArray(fs.albums)) currentRoom.albums = fs.albums;
              if (fs.settings) currentRoom.settings = { ...currentRoom.settings, ...fs.settings };
            }
            break;
        }

        currentRoom.updatedAt = Date.now();
        saveDb();

        // Broadcast action to all other sockets in the room in real-time
        broadcastToRoom(session.roomCode, ws, {
          event: 'couple_action_broadcast',
          actionType,
          payload,
          updatedAt: currentRoom.updatedAt,
          userId: session.userId,
        });
      } else if (event === 'heartbeat_tap') {
        if (!session) return;
        // Real-time heartbeat / "Miss You" pulse
        broadcastToRoom(session.roomCode, ws, {
          event: 'heartbeat_received',
          senderId: session.userId,
          senderName: session.userName,
          type: payload?.type || 'heart',
          timestamp: Date.now(),
          message: payload?.message || '',
        });
      } else if (event === 'status_update') {
        if (!session) return;
        if (roomsDb[session.roomCode]?.profiles) {
          roomsDb[session.roomCode].profiles[session.userId] = {
            ...payload,
            id: session.userId,
            lastActive: Date.now(),
          };
          saveDb();
        }
        broadcastToRoom(session.roomCode, ws, {
          event: 'partner_status_update',
          userId: session.userId,
          status: payload,
        });
      } else if (event === 'typing_status') {
        if (!session) return;
        broadcastToRoom(session.roomCode, ws, {
          event: 'partner_typing',
          userId: session.userId,
          isTyping: !!payload?.isTyping,
        });
      }
    } catch (e) {
      console.error('WebSocket message parsing error:', e);
    }
  });

  ws.on('close', () => {
    if (session) {
      clients.delete(session);
      broadcastToRoom(session.roomCode, ws, {
        event: 'partner_disconnected',
        userId: session.userId,
        timestamp: Date.now(),
      });
    }
  });
});

function broadcastToRoom(roomCode: string, senderWs: WebSocket | null, messageObj: Record<string, unknown>) {
  const json = JSON.stringify(messageObj);
  for (const client of clients) {
    if (client.roomCode === roomCode && (senderWs === null || client.ws !== senderWs) && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(json);
      } catch (err) {
        console.error('Error broadcasting to client:', err);
      }
    }
  }
}

// Vite middleware for dev or Static files for prod
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`LoveSync Server running on http://localhost:${PORT}`);
  });
}

startServer();
