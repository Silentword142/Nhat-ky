import { CoupleProfile, CoupleSettings, DiaryEntry, PhotoMemory, HandwrittenCard, AnniversaryEvent } from '../types';

export const DEFAULT_AVATAR_ME = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80';
export const DEFAULT_AVATAR_PARTNER = 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&auto=format&fit=crop&q=80';

export const initialMyProfile: CoupleProfile = {
  id: 'guest_user',
  name: 'Bạn',
  nickname: '',
  avatar: DEFAULT_AVATAR_ME,
  mood: '🌸',
  statusText: '',
  locationEmoji: '',
  // Neutral by default — the Flo cycle tracker only appears once someone explicitly picks
  // "Nữ" in their profile (see ProfileModal), so a guest profile shouldn't default to it.
  gender: 'other',
  birthday: '',
  authProvider: 'guest',
  lastActive: Date.now(),
};

export const initialPartnerProfile: CoupleProfile | null = null;

export const initialSettings: CoupleSettings = {
  coupleStartDate: '',
  anniversaryName: 'Ngày Chúng Mình Bắt Đầu Yêu',
  roomCode: '',
  passphrase: 'lovesync2026',
  e2eeEnabled: true,
  theme: 'sakura',
  isDarkMode: false,
  soundEnabled: true,
  floatingParticles: true,
  customQuote: '“Tình yêu đẹp nhất là khi có một nơi chốn bình yên để cùng nhau lưu giữ kỷ niệm.” ✨',
  partnerBirthday: '',
  accountEmail: '',
};

// Clean empty collections - only filled when authenticated user loads their room
export const initialDiaries: DiaryEntry[] = [];
export const initialPhotos: PhotoMemory[] = [];
export const initialAnniversaries: AnniversaryEvent[] = [];
export const initialCards: HandwrittenCard[] = [];

