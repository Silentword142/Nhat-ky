export interface CoupleProfile {
  id: string;
  name: string;
  avatar: string;
  nickname: string;
  mood: string;
  statusText: string;
  locationEmoji: string;
  batteryLevel?: number;
  gender: 'female' | 'male' | 'other';
  birthday?: string; // YYYY-MM-DD
  email?: string;
  authProvider?: 'google' | 'email' | 'username' | 'guest';
  lastActive: number;
  musicPlaylist?: any[];
  musicCurrentTrackId?: string;
}

export interface CoupleSettings {
  coupleStartDate: string; // YYYY-MM-DD
  anniversaryName: string;
  roomCode: string;
  passphrase: string; // For E2EE key derivation
  e2eeEnabled: boolean;
  theme: 'sakura' | 'twilight' | 'lavender' | 'peach' | 'matcha' | 'mocha';
  isDarkMode: boolean;
  soundEnabled: boolean;
  floatingParticles: boolean;
  bgWallpaper?: string;
  customQuote?: string;
  partnerBirthday?: string; // YYYY-MM-DD
  accountEmail?: string;
}

export interface DiaryComment {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: number;
}

export interface DiaryEntry {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  title: string;
  content: string;
  mood: string;
  moodLabel: string;
  weather: string;
  location?: string;
  photos: string[];
  tags: string[];
  pageNumber?: number; // Page number within the specific day (1, 2, 3...)
  isPrivate: boolean; // if true, only local author can read
  reactions: Record<string, string[]>; // emoji -> array of userIds
  comments: DiaryComment[];
  createdAt: number;
  updatedAt: number;
}

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  url: string;
  duration?: number;
  coverImage?: string;
  isCustom?: boolean;
  source?: 'audio' | 'youtube';
  youtubeId?: string;
  addedAt?: number;
}

export interface Album {
  id: string;
  name: string;
  description?: string;
  coverImage?: string;
  color?: string;
  createdAt: number;
}

export interface PhotoMemory {
  id: string;
  albumId: string;
  albumName: string;
  title: string;
  caption: string;
  imageUrl: string;
  originalFileId?: string;
  driveFolderId?: string;
  driveViewUrl?: string;
  driveDownloadUrl?: string;
  originalQuality?: boolean;
  fileSize?: number;
  fileName?: string;
  date: string; // YYYY-MM-DD
  location?: string;
  frameStyle: 'polaroid' | 'vintage' | 'sakura' | 'heart' | 'film' | 'classic';
  authorId: string;
  authorName: string;
  likes: string[]; // userIds
  tags: string[];
  createdAt: number;
}

export interface HandwrittenCard {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  recipientName: string;
  title: string;
  cardDataUrl: string; // PNG drawn canvas
  paperTemplate: 'lined' | 'sakura' | 'parchment' | 'starry' | 'grid' | 'pastel';
  sealStyle: 'rose_wax' | 'golden_heart' | 'ribbon' | 'cupid' | 'kiss';
  sealColor: string;
  messageText?: string;
  isOpened: boolean;
  openedAt?: number;
  sentAt: number;
}

export interface AnniversaryEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  category: 'official' | 'anniversary' | 'birthday' | 'date' | 'trip' | 'milestone' | 'custom';
  repeatYearly: boolean;
  icon: string;
  notes?: string;
  coverImage?: string;
  isMilestone?: boolean;
  targetDays?: number;
}

export interface HeartbeatPulse {
  senderId: string;
  senderName: string;
  type: 'miss_you' | 'hug' | 'kiss' | 'heart';
  timestamp: number;
  message?: string;
}

export interface EncryptedPacket {
  id: string;
  type: 'diary' | 'photo' | 'card' | 'anniversary' | 'profile' | 'settings';
  authorId: string;
  iv: string;
  ciphertext: string;
  updatedAt: number;
  deleted?: boolean;
}

export interface CoupleFullState {
  myProfile: CoupleProfile;
  partnerProfile: CoupleProfile | null;
  settings: CoupleSettings;
  diaries: DiaryEntry[];
  photos: PhotoMemory[];
  cards: HandwrittenCard[];
  anniversaries: AnniversaryEvent[];
  playlist?: MusicTrack[];
  albums?: Album[];
}
