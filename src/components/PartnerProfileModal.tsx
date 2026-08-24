import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Heart,
  Calendar,
  Sparkles,
  MapPin,
  Clock,
  Send,
  User,
  Radio,
  Quote,
  Smile,
  ShieldCheck,
  CheckCircle2,
  Gift,
  Flame,
} from 'lucide-react';
import { useCouple } from '../context/CoupleContext';
import { THEMES } from '../utils/theme';
import { soundService } from '../services/sound';
import { DEFAULT_AVATAR_PARTNER } from '../services/mockData';

interface PartnerProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Helper to calculate Zodiac sign & countdown to next birthday
function getZodiacAndBirthdayInfo(birthdayStr?: string) {
  if (!birthdayStr) return null;
  const bdate = new Date(birthdayStr);
  if (isNaN(bdate.getTime())) return null;

  const day = bdate.getDate();
  const month = bdate.getMonth() + 1; // 1-12
  const birthYear = bdate.getFullYear();

  // Calculate age
  const today = new Date();
  let age = today.getFullYear() - birthYear;
  const monthDiff = today.getMonth() + 1 - month;
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < day)) {
    age--;
  }

  // Calculate next birthday countdown
  let nextBday = new Date(today.getFullYear(), month - 1, day);
  if (nextBday.getTime() < today.getTime()) {
    nextBday = new Date(today.getFullYear() + 1, month - 1, day);
  }
  const diffTime = nextBday.getTime() - today.getTime();
  const daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // Determine Zodiac Sign
  const zodiacMap: Array<{ name: string; icon: string; traits: string; check: (d: number, m: number) => boolean }> = [
    { name: 'Ma Kết (Capricorn)', icon: '♑', traits: 'Chân thành, kiên trì, ấm áp', check: (d, m) => (m === 12 && d >= 22) || (m === 1 && d <= 19) },
    { name: 'Bảo Bình (Aquarius)', icon: '♒', traits: 'Sáng tạo, độc đáo, thấu hiểu', check: (d, m) => (m === 1 && d >= 20) || (m === 2 && d <= 18) },
    { name: 'Song Ngư (Pisces)', icon: '♓', traits: 'Dịu dàng, lãng mạn, chu đáo', check: (d, m) => (m === 2 && d >= 19) || (m === 3 && d <= 20) },
    { name: 'Bạch Dương (Aries)', icon: '♈', traits: 'Nhiệt tình, tràn đầy năng lượng', check: (d, m) => (m === 3 && d >= 21) || (m === 4 && d <= 19) },
    { name: 'Kim Ngưu (Taurus)', icon: '♉', traits: 'Đáng tin cậy, ngọt ngào, bền bỉ', check: (d, m) => (m === 4 && d >= 20) || (m === 5 && d <= 20) },
    { name: 'Song Tử (Gemini)', icon: '♊', traits: 'Thông minh, vui vẻ, duyên dáng', check: (d, m) => (m === 5 && d >= 21) || (m === 6 && d <= 21) },
    { name: 'Cự Giải (Cancer)', icon: '♋', traits: 'Tình cảm, chu đáo, yêu thương', check: (d, m) => (m === 6 && d >= 22) || (m === 7 && d <= 22) },
    { name: 'Sư Tử (Leo)', icon: '♌', traits: 'Tự tin, hào phóng, chung thủy', check: (d, m) => (m === 7 && d >= 23) || (m === 8 && d <= 22) },
    { name: 'Xử Nữ (Virgo)', icon: '♍', traits: 'Tinh tế, cẩn thận, ngọt ngào', check: (d, m) => (m === 8 && d >= 23) || (m === 9 && d <= 22) },
    { name: 'Thiên Bình (Libra)', icon: '♎', traits: 'Hài hòa, lịch thiệp, đáng yêu', check: (d, m) => (m === 9 && d >= 23) || (m === 10 && d <= 23) },
    { name: 'Bọ Cạp (Scorpio)', icon: '♏', traits: 'Say đắm, quyến rũ, sâu sắc', check: (d, m) => (m === 10 && d >= 24) || (m === 11 && d <= 21) },
    { name: 'Nhân Mã (Sagittarius)', icon: '♐', traits: 'Lạc quan, tự do, vui tươi', check: (d, m) => (m === 11 && d >= 22) || (m === 12 && d <= 21) },
  ];

  const zodiac = zodiacMap.find((z) => z.check(day, month)) || zodiacMap[0];

  return {
    formattedDate: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${birthYear}`,
    age,
    daysUntil: daysUntil === 0 ? 'Hôm nay là sinh nhật người ấy! 🎂🎉' : `Còn ${daysUntil} ngày nữa là đến sinh nhật`,
    isToday: daysUntil === 0,
    zodiac,
  };
}

export const PartnerProfileModal: React.FC<PartnerProfileModalProps> = ({ isOpen, onClose }) => {
  const {
    partnerProfile,
    partnerAccountInfo,
    settings,
    isPartnerOnline,
    sendHeartbeat,
    daysInLove,
  } = useCouple();

  const currentTheme = THEMES[settings.theme] || THEMES.sakura;
  const [pulseMessage, setPulseMessage] = useState('');
  const [pulseSent, setPulseSent] = useState<string | null>(null);
  const [showAvatarZoom, setShowAvatarZoom] = useState(false);

  if (!isOpen) return null;

  const partner = partnerProfile || {
    name: partnerAccountInfo?.displayName || 'Người thương',
    nickname: '',
    avatar: DEFAULT_AVATAR_PARTNER,
    statusText: 'Đang kết nối cùng bạn',
    locationEmoji: '📍 Bên cạnh bạn',
    birthday: '',
    mood: '💖',
    gender: 'Nữ',
    bio: 'Luôn muốn dành trọn yêu thương ngọt ngào nhất cho bạn.',
    loveQuote: 'Yêu là cùng nhau bước qua mọi khoảnh khắc bình yên.',
    lastActive: Date.now(),
  };

  const bdayInfo = getZodiacAndBirthdayInfo(partner.birthday);

  const handleSendAction = (type: 'heart' | 'kiss' | 'hug' | 'miss_you', label: string) => {
    soundService.playHeartbeat();
    sendHeartbeat(type, pulseMessage.trim() || undefined);
    setPulseSent(`Đã gửi ${label} đến người yêu! 💖`);
    setPulseMessage('');
    setTimeout(() => setPulseSent(null), 3000);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-xs overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-zinc-900 border border-rose-200/80 dark:border-zinc-800 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
        >
          {/* Header Banner */}
          <div className="relative h-28 sm:h-32 bg-gradient-to-r from-rose-400 via-pink-400 to-rose-300 dark:from-rose-900 dark:via-pink-900 dark:to-zinc-800 flex items-start justify-between p-4">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-bold font-cute">
              <Sparkles className="w-3.5 h-3.5 text-amber-200 animate-pulse" />
              <span>Hồ Sơ Người Thương 💑</span>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/25 hover:bg-white/40 text-white flex items-center justify-center transition active:scale-95 cursor-pointer backdrop-blur-md"
              title="Đóng"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Avatar and Main Info */}
          <div className="relative px-6 pb-6 overflow-y-auto space-y-5">
            {/* Avatar Profile Positioning */}
            <div className="flex flex-col sm:flex-row items-center sm:items-end justify-between gap-3 -mt-14 sm:-mt-16">
              <div className="relative group">
                <div
                  onClick={() => setShowAvatarZoom(true)}
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-full ring-4 ring-white dark:ring-zinc-900 shadow-xl overflow-hidden cursor-pointer bg-rose-100 dark:bg-zinc-800 transition hover:scale-105"
                  title="Bấm để xem ảnh phóng to"
                >
                  <img
                    src={partner.avatar || DEFAULT_AVATAR_PARTNER}
                    alt={partner.name || 'Người thương'}
                    className="w-full h-full object-cover"
                  />
                </div>
                <span
                  className="absolute -bottom-1 -right-1 text-2xl drop-shadow-md bg-white dark:bg-zinc-800 p-1 rounded-full border border-rose-100 dark:border-zinc-700"
                  title="Cảm xúc hiện tại"
                >
                  {partner.mood || '💖'}
                </span>
              </div>

              {/* Online / Offline Status Badge */}
              <div className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold shadow-xs ${
                    isPartnerOnline
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isPartnerOnline ? 'bg-emerald-500 animate-ping' : 'bg-zinc-400'
                    }`}
                  />
                  <span>{isPartnerOnline ? 'Đang Online Trực Tiếp 🟢' : 'Ngoại tuyến ⚪'}</span>
                </div>

                <div className="px-3.5 py-1.5 rounded-full bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 text-xs font-bold">
                  {daysInLove} ngày yêu 💕
                </div>
              </div>
            </div>

            {/* Names & Status */}
            <div className="text-center sm:text-left space-y-1">
              <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                <h3 className="text-xl sm:text-2xl font-serif italic font-bold text-zinc-900 dark:text-zinc-50">
                  {partner.name || 'Người thương'}
                </h3>
                {partner.nickname && (
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-300 font-cute font-bold text-xs">
                    Biệt danh: {partner.nickname}
                  </span>
                )}
              </div>

              {partnerAccountInfo?.username && (
                <p className="text-xs font-mono text-zinc-400 dark:text-zinc-500">
                  Tài khoản: @{partnerAccountInfo.username}
                </p>
              )}

              <p className="text-sm font-cute text-rose-600 dark:text-rose-400 font-semibold pt-1">
                "{partner.statusText || 'Trái tim luôn hướng về người ấy...'}"
              </p>
            </div>

            {/* Birthday & Zodiac Card */}
            {bdayInfo ? (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-50/80 via-pink-50/40 to-white dark:from-zinc-800/80 dark:to-zinc-900 border border-rose-200/70 dark:border-zinc-700 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-xs font-cute">
                    <Calendar className="w-4 h-4" />
                    <span>Sinh Nhật & Cung Hoàng Đạo</span>
                  </div>
                  <span className="text-xs font-bold text-rose-500 font-cute bg-rose-100/80 dark:bg-rose-950/60 px-2.5 py-0.5 rounded-full">
                    {bdayInfo.age > 0 ? `${bdayInfo.age} tuổi` : ''}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-800/80 border border-rose-100 dark:border-zinc-700">
                    <span className="text-zinc-500 dark:text-zinc-400 text-[11px] block">Ngày sinh nhật:</span>
                    <strong className="text-zinc-800 dark:text-zinc-100 font-mono text-sm">
                      {bdayInfo.formattedDate}
                    </strong>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-800/80 border border-rose-100 dark:border-zinc-700">
                    <span className="text-zinc-500 dark:text-zinc-400 text-[11px] block">Cung hoàng đạo:</span>
                    <strong className="text-zinc-800 dark:text-zinc-100 flex items-center gap-1 text-xs">
                      <span>{bdayInfo.zodiac.icon}</span>
                      <span>{bdayInfo.zodiac.name.split(' ')[0]}</span>
                    </strong>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-rose-100/70 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-800/50 flex items-center justify-between text-xs text-rose-700 dark:text-rose-300 font-cute">
                  <div className="flex items-center gap-1.5 font-bold">
                    <Gift className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>{bdayInfo.daysUntil}</span>
                  </div>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                    Đặc điểm: {bdayInfo.zodiac.traits}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/60 text-xs text-zinc-500 dark:text-zinc-400 font-cute flex items-center gap-2">
                <Calendar className="w-4 h-4 text-rose-400" />
                <span>Người ấy chưa thiết lập ngày sinh nhật trong hồ sơ.</span>
              </div>
            )}

            {/* Bio & Love Quote */}
            <div className="space-y-3">
              {partner.bio && (
                <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700 space-y-1">
                  <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 flex items-center gap-1 font-cute">
                    <Smile className="w-3.5 h-3.5 text-rose-400" /> Giới thiệu bản thân
                  </span>
                  <p className="text-xs text-zinc-700 dark:text-zinc-300 font-cute leading-relaxed">
                    {partner.bio}
                  </p>
                </div>
              )}

              {partner.loveQuote && (
                <div className="p-3.5 rounded-2xl bg-rose-50/50 dark:bg-zinc-800/40 border border-rose-100 dark:border-zinc-700 space-y-1">
                  <span className="text-[11px] font-bold text-rose-500 flex items-center gap-1 font-cute">
                    <Quote className="w-3.5 h-3.5" /> Châm ngôn tình yêu
                  </span>
                  <p className="text-xs text-zinc-800 dark:text-zinc-200 italic font-serif">
                    "{partner.loveQuote}"
                  </p>
                </div>
              )}

              <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400 font-cute px-1">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-rose-500" />
                  {partner.locationEmoji || '📍 Chưa cập nhật vị trí'}
                </span>
                {partner.gender && (
                  <span className="flex items-center gap-1">
                    <span>{partner.gender === 'male' || (partner.gender as string) === 'Nam' ? '♂️ Nam' : partner.gender === 'female' || (partner.gender as string) === 'Nữ' ? '♀️ Nữ' : '💖 Khác'}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Quick Interactive Actions (Send Heartbeat / Kiss / Hug) */}
            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 font-cute flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                  <span>Gửi Yêu Thương Tức Thì Cho Người Ấy:</span>
                </span>
              </div>

              {pulseSent && (
                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-cute flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>{pulseSent}</span>
                </div>
              )}

              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => handleSendAction('heart', 'nhịp đập trái tim 💖')}
                  className="py-2.5 px-2 rounded-2xl bg-rose-50 hover:bg-rose-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-rose-600 dark:text-rose-300 border border-rose-200/60 dark:border-zinc-700 font-bold text-xs flex flex-col items-center gap-1 transition active:scale-95 cursor-pointer shadow-xs"
                >
                  <span className="text-xl">💖</span>
                  <span className="text-[10px]">Nhịp tim</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSendAction('kiss', 'nụ hôn ngọt ngào 💋')}
                  className="py-2.5 px-2 rounded-2xl bg-pink-50 hover:bg-pink-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-pink-600 dark:text-pink-300 border border-pink-200/60 dark:border-zinc-700 font-bold text-xs flex flex-col items-center gap-1 transition active:scale-95 cursor-pointer shadow-xs"
                >
                  <span className="text-xl">💋</span>
                  <span className="text-[10px]">Hôn yêu</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSendAction('hug', 'cái ôm ấm áp 🤗')}
                  className="py-2.5 px-2 rounded-2xl bg-amber-50 hover:bg-amber-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-zinc-700 font-bold text-xs flex flex-col items-center gap-1 transition active:scale-95 cursor-pointer shadow-xs"
                >
                  <span className="text-xl">🤗</span>
                  <span className="text-[10px]">Ôm chặt</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSendAction('miss_you', 'nỗi nhớ đong đầy 💌')}
                  className="py-2.5 px-2 rounded-2xl bg-purple-50 hover:bg-purple-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-purple-600 dark:text-purple-300 border border-purple-200/60 dark:border-zinc-700 font-bold text-xs flex flex-col items-center gap-1 transition active:scale-95 cursor-pointer shadow-xs"
                >
                  <span className="text-xl">💌</span>
                  <span className="text-[10px]">Nhớ lắm</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={pulseMessage}
                  onChange={(e) => setPulseMessage(e.target.value)}
                  placeholder="Viết thêm lời nhắn ngắn gửi kèm..."
                  className="flex-1 px-3.5 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-800 dark:text-zinc-100 focus:ring-2 focus:ring-rose-400 outline-hidden font-cute"
                />
                <button
                  type="button"
                  onClick={() => handleSendAction('heart', 'lời nhắn yêu thương')}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-bold text-xs shadow-md shadow-rose-200 dark:shadow-none transition active:scale-95 cursor-pointer flex items-center gap-1"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Gửi</span>
                </button>
              </div>
            </div>
          </div>

          {/* Full Avatar Zoom Overlay */}
          {showAvatarZoom && (
            <div
              onClick={() => setShowAvatarZoom(false)}
              className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4 cursor-pointer"
            >
              <div className="relative max-w-sm w-full p-2 bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl">
                <img
                  src={partner.avatar || DEFAULT_AVATAR_PARTNER}
                  alt="Partner Large Avatar"
                  className="w-full h-80 object-cover rounded-2xl"
                />
                <p className="text-center text-xs font-cute text-zinc-600 dark:text-zinc-300 mt-2 font-bold">
                  {partner.name || 'Người thương'} 💕 (Bấm để đóng)
                </p>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
