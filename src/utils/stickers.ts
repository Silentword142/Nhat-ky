import { NoteColor } from '../types';

/** Cute markers for a calendar note. The sticker is what shows on the day in the calendar. */
export const NOTE_STICKERS: { emoji: string; label: string }[] = [
  { emoji: '💖', label: 'Yêu thương' },
  { emoji: '🎂', label: 'Sinh nhật' },
  { emoji: '🥂', label: 'Kỷ niệm' },
  { emoji: '🎁', label: 'Quà tặng' },
  { emoji: '💐', label: 'Tặng hoa' },
  { emoji: '🌙', label: 'Hẹn tối' },
  { emoji: '✈️', label: 'Du lịch' },
  { emoji: '🎬', label: 'Xem phim' },
  { emoji: '🍜', label: 'Ăn uống' },
  { emoji: '☕', label: 'Cà phê' },
  { emoji: '🛍️', label: 'Mua sắm' },
  { emoji: '🎉', label: 'Tiệc tùng' },
  { emoji: '📌', label: 'Việc cần làm' },
  { emoji: '⏰', label: 'Nhắc nhở' },
  { emoji: '⭐', label: 'Quan trọng' },
  { emoji: '💊', label: 'Uống thuốc' },
  { emoji: '🏥', label: 'Khám bệnh' },
  { emoji: '📚', label: 'Học tập' },
  { emoji: '💼', label: 'Công việc' },
  { emoji: '🏠', label: 'Về nhà' },
  { emoji: '🐶', label: 'Thú cưng' },
  { emoji: '🧸', label: 'Gấu bông' },
  { emoji: '🎀', label: 'Điệu đà' },
  { emoji: '🍀', label: 'May mắn' },
];

export const DEFAULT_STICKER = NOTE_STICKERS[0].emoji;

export const stickerLabel = (emoji: string) => NOTE_STICKERS.find((s) => s.emoji === emoji)?.label || 'Ghi chú';

/** Sticky-note paper colours (both themes). `dot` is the swatch in the picker. */
export const NOTE_COLORS: Record<NoteColor, { label: string; paper: string; dot: string }> = {
  pink: { label: 'Hồng', paper: 'bg-pink-100 dark:bg-pink-950/50 border-pink-200 dark:border-pink-900/60', dot: 'bg-pink-300' },
  yellow: { label: 'Vàng', paper: 'bg-amber-100 dark:bg-amber-950/50 border-amber-200 dark:border-amber-900/60', dot: 'bg-amber-300' },
  mint: { label: 'Bạc hà', paper: 'bg-emerald-100 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-900/60', dot: 'bg-emerald-300' },
  sky: { label: 'Trời xanh', paper: 'bg-sky-100 dark:bg-sky-950/50 border-sky-200 dark:border-sky-900/60', dot: 'bg-sky-300' },
  lavender: { label: 'Oải hương', paper: 'bg-violet-100 dark:bg-violet-950/50 border-violet-200 dark:border-violet-900/60', dot: 'bg-violet-300' },
  peach: { label: 'Đào', paper: 'bg-orange-100 dark:bg-orange-950/50 border-orange-200 dark:border-orange-900/60', dot: 'bg-orange-300' },
};

export const NOTE_COLOR_ORDER: NoteColor[] = ['pink', 'yellow', 'mint', 'sky', 'lavender', 'peach'];
