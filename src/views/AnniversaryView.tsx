import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  Heart,
  Calendar,
  Sparkles,
  Clock,
  CheckCircle2,
  Trash2,
  Share2,
  Download,
  Cake,
  Plane,
  Gift,
  Compass,
  X,
  Flame,
  Award,
} from 'lucide-react';
import { useCouple } from '../context/CoupleContext';
import { AnniversaryEvent } from '../types';
import { THEMES } from '../utils/theme';
import { soundService } from '../services/sound';
import { DEFAULT_AVATAR_ME, DEFAULT_AVATAR_PARTNER } from '../services/mockData';
import { formatDateVN, useLoveDuration } from '../utils/date';
import { DateInputVN } from '../components/DateInputVN';

const MILESTONES_TARGETS = [
  { targetDays: 100, label: '100 Ngày Yêu', emoji: '💯', title: 'Mốc 100 ngày ngọt ngào' },
  { targetDays: 200, label: '200 Ngày Yêu', emoji: '🌸', title: '200 ngày cùng nhau trưởng thành' },
  { targetDays: 365, label: '1 Năm Yêu Nhau (365 ngày)', emoji: '💍', title: 'Kỷ niệm 1 năm hạnh phúc trọn vẹn' },
  { targetDays: 500, label: '500 Ngày Yêu', emoji: '🎉', title: 'Nửa nghìn ngày chung đôi' },
  { targetDays: 730, label: '2 Năm Yêu Nhau (730 ngày)', emoji: '👑', title: '2 năm vững bền son sắt' },
  { targetDays: 1000, label: '1000 Ngày Yêu', emoji: '💎', title: 'Mốc 1000 ngày kim cương' },
  { targetDays: 1825, label: '5 Năm Yêu Nhau', emoji: '🌟', title: '5 năm tình yêu diệu kỳ' },
];

const CATEGORIES = [
  { id: 'anniversary', label: 'Kỷ niệm yêu', icon: '💖' },
  { id: 'birthday', label: 'Sinh nhật', icon: '🎂' },
  { id: 'date', label: 'Hẹn hò đặc biệt', icon: '☕' },
  { id: 'trip', label: 'Chuyến du lịch', icon: '✈️' },
  { id: 'milestone', label: 'Cột mốc lớn', icon: '🌟' },
  { id: 'custom', label: 'Khác', icon: '🎁' },
];

export const AnniversaryView: React.FC = () => {
  const {
    anniversaries,
    settings,
    myProfile,
    partnerProfile,
    daysInLove,
    addAnniversary,
    deleteAnniversary,
    updateSettings,
  } = useCouple();

  const currentTheme = THEMES[settings.theme] || THEMES.sakura;
  // Self-contained live seconds counter — only this view re-renders every second while open.
  const loveDuration = useLoveDuration(settings.coupleStartDate);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isShareCardModalOpen, setIsShareCardModalOpen] = useState(false);

  // Add Anniversary Form
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<AnniversaryEvent['category']>('anniversary');
  const [repeatYearly, setRepeatYearly] = useState(true);
  const [icon, setIcon] = useState('💖');
  const [notes, setNotes] = useState('');

  // Start Date Edit
  const [isEditingStartDate, setIsEditingStartDate] = useState(false);
  const [tempStartDate, setTempStartDate] = useState(settings.coupleStartDate);

  // Helper to calculate days remaining or passed for an anniversary
  const calculateDaysDiff = (targetDateStr: string, repeat: boolean) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let target = new Date(targetDateStr);
    target.setHours(0, 0, 0, 0);

    if (repeat) {
      // Set to current year
      target.setFullYear(today.getFullYear());
      // If already passed this year, set to next year
      if (target.getTime() < today.getTime()) {
        target.setFullYear(today.getFullYear() + 1);
      }
    }

    const diffMs = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Submit new anniversary
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    addAnniversary({
      title: title.trim(),
      date,
      category,
      repeatYearly,
      icon,
      notes: notes.trim() || undefined,
    });

    setTitle('');
    setNotes('');
    setIsAddModalOpen(false);
  };

  // Save updated couple start date
  const handleSaveStartDate = () => {
    soundService.playSparkle();
    updateSettings({ coupleStartDate: tempStartDate });
    setIsEditingStartDate(false);
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-3 sm:px-6 pb-24 sm:pb-12">
      {/* HERO BANNER: Live Big Love Days Counter */}
      <div className={`rounded-[40px] ${currentTheme.cardBg} border ${currentTheme.borderSubtle} p-8 sm:p-10 shadow-xl shadow-rose-100/50 dark:shadow-none mb-8 text-center relative overflow-hidden`}>
        {/* Glow effect */}
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-[#FFD8E4] dark:bg-[#381f2a]/40 blur-3xl opacity-60 pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-[#E0F2FE] dark:bg-[#142838]/30 blur-3xl opacity-60 pointer-events-none" />

        <div className="flex items-center justify-center gap-2 mb-2">
          <p className="text-[#FF758F] font-bold tracking-widest uppercase text-xs sm:text-sm">
            {settings.anniversaryName || 'Kỷ niệm của chúng mình'}
          </p>
        </div>

        {/* Huge Days Counter */}
        <motion.div
          key={daysInLove}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="my-3"
        >
          <div className="flex items-baseline justify-center gap-3 sm:gap-4 flex-wrap">
            <h2 className="text-6xl sm:text-7xl md:text-8xl font-serif font-black text-[#333] dark:text-[#f4effa] tracking-tight">
              {daysInLove.toLocaleString('vi-VN')}
            </h2>
            <span className="text-2xl sm:text-3xl font-serif italic text-[#666] dark:text-zinc-300">
              Ngày bên nhau
            </span>
          </div>
        </motion.div>

        {/* Live Hours, Minutes, Seconds Ticker */}
        <div className="inline-flex items-center justify-center gap-3 sm:gap-6 px-6 py-3 rounded-full bg-[#FFF5F7] dark:bg-zinc-800/80 backdrop-blur-sm border border-[#FFE4E9] dark:border-zinc-700 shadow-inner mt-2 mb-4 font-mono text-zinc-800 dark:text-zinc-100">
          <div className="text-center">
            <span className="text-lg sm:text-2xl font-black text-[#FF758F]">{loveDuration.hours}</span>
            <span className="block text-[10px] text-[#888] uppercase">Giờ</span>
          </div>
          <span className="text-[#FF758F]/50 text-lg sm:text-xl font-bold">:</span>
          <div className="text-center">
            <span className="text-lg sm:text-2xl font-black text-[#FF758F]">{loveDuration.minutes}</span>
            <span className="block text-[10px] text-[#888] uppercase">Phút</span>
          </div>
          <span className="text-[#FF758F]/50 text-lg sm:text-xl font-bold">:</span>
          <div className="text-center">
            <span className="text-lg sm:text-2xl font-black text-[#FF758F] animate-pulse">
              {loveDuration.seconds}
            </span>
            <span className="block text-[10px] text-[#888] uppercase">Giây</span>
          </div>
        </div>

        {/* Start date display & Edit */}
        <div className="flex items-center justify-center gap-3 text-xs text-[#888] dark:text-zinc-400 font-cute">
          <span>
            Kể từ ngày:{' '}
            <strong className="text-[#FF758F] font-bold">
              {formatDateVN(settings.coupleStartDate)}
            </strong>
          </span>

          <button
            onClick={() => setIsEditingStartDate(!isEditingStartDate)}
            className="text-zinc-400 hover:text-rose-500 underline text-xs"
          >
            {isEditingStartDate ? 'Đóng' : 'Chỉnh sửa ngày'}
          </button>
        </div>

        {/* Start Date Edit Form */}
        {isEditingStartDate && (
          <div className="mt-3 flex flex-col sm:flex-row items-center gap-2 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 max-w-md">
            <div className="flex-1 w-full">
              <DateInputVN
                value={tempStartDate}
                onChange={(val) => setTempStartDate(val)}
                placeholder="dd/mm/yyyy"
                showFormatHint={false}
                inputClassName="!py-1.5 !px-3 !rounded-xl !bg-white dark:!bg-zinc-900 !text-xs font-bold"
              />
            </div>
            <button
              onClick={handleSaveStartDate}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold shadow-sm transition active:scale-95 cursor-pointer whitespace-nowrap"
            >
              Lưu
            </button>
          </div>
        )}

        {/* Share Anniversary Card Button */}
        <div className="mt-5">
          <button
            onClick={() => {
              soundService.playSparkle();
              setIsShareCardModalOpen(true);
            }}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-bold text-xs sm:text-sm shadow-md shadow-rose-300 dark:shadow-rose-950 inline-flex items-center gap-2 transition active:scale-95"
          >
            <Share2 className="w-4 h-4" />
            <span>Tạo Thẻ Kỷ Niệm Tình Yêu ✨</span>
          </button>
        </div>
      </div>

      {/* MILESTONE ROADMAP SECTION */}
      <div className={`rounded-3xl ${currentTheme.cardBg} border ${currentTheme.borderSubtle} p-5 sm:p-7 shadow-md mb-6`}>
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            <h3 className="text-base sm:text-lg font-bold text-zinc-800 dark:text-zinc-100 font-cute">
              Hành Trình Cột Mốc Tình Yêu
            </h3>
          </div>
          <span className="text-xs text-zinc-400 font-cute">Những dấu mốc đáng nhớ</span>
        </div>

        <div className="space-y-4">
          {MILESTONES_TARGETS.map((m) => {
            const isCompleted = daysInLove >= m.targetDays;
            const daysLeft = m.targetDays - daysInLove;
            const progress = Math.min(100, Math.round((daysInLove / m.targetDays) * 100));

            return (
              <div
                key={m.targetDays}
                className={`p-4 rounded-2xl border transition-all ${
                  isCompleted
                    ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40'
                    : 'bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{m.emoji}</span>
                    <div>
                      <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-100 font-cute">
                        {m.label}
                      </h4>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">{m.title}</p>
                    </div>
                  </div>

                  <div>
                    {isCompleted ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500 text-white font-bold text-xs shadow-sm">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Đã Đạt Được
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-xs">
                        <Clock className="w-3.5 h-3.5 text-rose-500" /> Còn {daysLeft} ngày
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 1 }}
                    className={`h-full rounded-full ${
                      isCompleted
                        ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                        : 'bg-gradient-to-r from-rose-500 to-pink-500'
                    }`}
                  />
                </div>
                <div className="flex justify-between items-center text-[10px] text-zinc-400 mt-1">
                  <span>Tiến độ: {progress}%</span>
                  <span>Mục tiêu: {m.targetDays} ngày</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SPECIAL DAYS & ANNIVERSARY LIST */}
      <div className={`rounded-3xl ${currentTheme.cardBg} border ${currentTheme.borderSubtle} p-5 sm:p-7 shadow-md`}>
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-rose-500" />
            <h3 className="text-base sm:text-lg font-bold text-zinc-800 dark:text-zinc-100 font-cute">
              Các Ngày Kỷ Niệm Sắp Tới
            </h3>
          </div>

          <button
            onClick={() => {
              soundService.playPop();
              setIsAddModalOpen(true);
            }}
            className="px-3.5 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shadow-sm flex items-center gap-1 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm Ngày Kỷ Niệm</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {anniversaries.map((event) => {
            const diffDays = calculateDaysDiff(event.date, event.repeatYearly);
            const isToday = diffDays === 0;

            return (
              <div
                key={event.id}
                className={`p-4 rounded-2xl border flex items-start justify-between gap-3 relative transition-all ${
                  isToday
                    ? 'bg-rose-100 dark:bg-rose-950/50 border-rose-400 ring-2 ring-rose-400 shadow-md animate-pulse'
                    : 'bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-800'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-3xl p-2 rounded-2xl bg-white dark:bg-zinc-900 shadow-sm">
                    {event.icon || '💖'}
                  </span>
                  <div>
                    <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-100 font-cute">
                      {event.title}
                    </h4>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {formatDateVN(event.date)}
                      {event.repeatYearly && ' • Hàng năm'}
                    </p>
                    {event.notes && (
                      <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1 italic line-clamp-1">
                        "{event.notes}"
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-right flex flex-col items-end gap-1">
                  {isToday ? (
                    <span className="px-2.5 py-1 rounded-full bg-rose-500 text-white font-extrabold text-xs animate-bounce shadow-sm">
                      🎉 HÔM NAY!
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold text-xs">
                      Còn {diffDays} ngày
                    </span>
                  )}

                  {event.category !== 'official' && (
                    <button
                      onClick={() => deleteAnniversary(event.id)}
                      className="p-1 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                      title="Xóa kỷ niệm"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SHAREABLE LOVE CARD MODAL */}
      <AnimatePresence>
        {isShareCardModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-md w-full my-auto bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-rose-200 dark:border-zinc-800 p-6"
            >
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-zinc-200 dark:border-zinc-800">
                <h3 className="font-bold text-base text-zinc-800 dark:text-zinc-100 font-cute">
                  Thẻ Kỷ Niệm Tình Yêu ✨
                </h3>
                <button
                  onClick={() => setIsShareCardModalOpen(false)}
                  className="p-1 rounded-full text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Graphic Card Preview */}
              <div
                id="printable-love-card"
                className="relative rounded-3xl overflow-hidden p-6 text-center text-white shadow-xl bg-gradient-to-br from-rose-500 via-pink-500 to-rose-600 mb-4"
              >
                {/* Floating floral watermark */}
                <div className="absolute top-2 right-2 text-4xl opacity-20">🌸</div>
                <div className="absolute bottom-2 left-2 text-4xl opacity-20">💖</div>

                <div className="text-xs uppercase tracking-widest text-rose-100 font-semibold mb-3">
                  LoveSync • Couple Journey
                </div>

                {/* Avatars */}
                <div className="flex items-center justify-center gap-3 mb-3">
                  <img
                    src={myProfile.avatar || DEFAULT_AVATAR_ME}
                    alt={myProfile.name || 'Bạn'}
                    className="w-16 h-16 rounded-full object-cover ring-4 ring-white/60 shadow-lg"
                  />
                  <div className="w-8 h-8 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center text-white">
                    <Heart className="w-4 h-4 fill-white animate-pulse" />
                  </div>
                  {partnerProfile ? (
                    <img
                      src={partnerProfile.avatar || DEFAULT_AVATAR_PARTNER}
                      alt={partnerProfile.name || 'Partner'}
                      className="w-16 h-16 rounded-full object-cover ring-4 ring-white/60 shadow-lg"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full border-2 border-dashed border-white/60 bg-white/20 backdrop-blur-sm flex items-center justify-center text-white text-xs font-cute">
                      Chờ ghép đôi
                    </div>
                  )}
                </div>

                <h4 className="text-xl font-black font-cute mb-1">
                  {partnerProfile ? `${myProfile.name} & ${partnerProfile.name}` : (myProfile.name || 'Hành trình tình yêu')}
                </h4>

                <div className="my-3 py-2 px-4 rounded-2xl bg-white/20 backdrop-blur-sm inline-block">
                  <div className="text-4xl font-black font-cute">
                    {settings.coupleStartDate ? `${daysInLove} NGÀY` : '0 NGÀY'}
                  </div>
                  <div className="text-[11px] text-rose-100 uppercase tracking-wider">
                    {settings.coupleStartDate ? 'Đồng hành cùng nhau' : 'Chưa đặt ngày bắt đầu'}
                  </div>
                </div>

                <p className="text-xs italic text-rose-100 font-cute max-w-xs mx-auto leading-relaxed">
                  "{settings.customQuote || 'Cảm ơn vì đã luôn ở bên và trao cho anh/em một tình yêu dịu dàng nhất.'}"
                </p>

                <div className="mt-4 pt-3 border-t border-white/20 text-[10px] text-rose-200">
                  {settings.coupleStartDate ? `Từ ngày ${settings.coupleStartDate} • Mãi yêu thương 💖` : 'Tình yêu đẹp nhất bắt đầu từ hôm nay ✨'}
                </div>
              </div>

              {/* Close */}
              <button
                onClick={() => setIsShareCardModalOpen(false)}
                className="w-full py-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 font-bold text-xs"
              >
                Đóng
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ADD ANNIVERSARY MODAL */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-lg w-full my-auto bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-rose-200 dark:border-zinc-800 p-5 sm:p-7"
            >
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">⏳</span>
                  <h3 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 font-cute">
                    Thêm Ngày Kỷ Niệm Mới
                  </h3>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1.5 rounded-full text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddSubmit} className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                    Tên ngày kỷ niệm *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Sinh nhật người yêu, Kỷ niệm nụ hôn đầu..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border-0 text-sm text-zinc-800 dark:text-zinc-100 focus:ring-2 focus:ring-rose-400"
                  />
                </div>

                {/* Date & Category */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <DateInputVN
                      label="Ngày diễn ra"
                      required
                      value={date}
                      onChange={(val) => setDate(val)}
                      placeholder="dd/mm/yyyy"
                      inputClassName="!bg-zinc-100 dark:!bg-zinc-800 !border-0"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1 font-cute">
                      Phân loại
                    </label>
                    <select
                      value={category}
                      onChange={(e) => {
                        const cat = e.target.value as AnniversaryEvent['category'];
                        setCategory(cat);
                        const match = CATEGORIES.find((c) => c.id === cat);
                        if (match) setIcon(match.icon);
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-800 dark:text-zinc-100 border-0"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.icon} {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Repeat Yearly Toggle */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800">
                  <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                    Lặp lại hàng năm (như sinh nhật, lễ kỷ niệm)
                  </div>
                  <input
                    type="checkbox"
                    checked={repeatYearly}
                    onChange={(e) => setRepeatYearly(e.target.checked)}
                    className="w-4 h-4 rounded text-rose-500 focus:ring-rose-400"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                    Ghi chú ngọt ngào
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Gợi ý quà tặng hoặc kế hoạch chuẩn bị..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full p-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border-0 text-xs sm:text-sm text-zinc-800 dark:text-zinc-100 focus:ring-2 focus:ring-rose-400"
                  />
                </div>

                {/* Submit & Cancel Buttons */}
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold text-xs"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-bold text-xs shadow-md shadow-rose-300 dark:shadow-rose-950 transition active:scale-95"
                  >
                    💖 Lưu Ngày Kỷ Niệm
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
