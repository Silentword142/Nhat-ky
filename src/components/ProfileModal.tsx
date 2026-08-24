import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Upload, Check, Camera, Smile, MapPin, Sparkles, Crop } from 'lucide-react';
import { useCouple } from '../context/CoupleContext';
import { soundService } from '../services/sound';
import { compressImageFile, CUTE_AVATARS } from '../utils/image';
import { DEFAULT_AVATAR_ME } from '../services/mockData';
import { AvatarCropModal } from './AvatarCropModal';
import { formatDateVN } from '../utils/date';

const MOOD_EMOJIS = ['🥰', '💖', '🥺', '🥳', '🌸', '✨', '☕', '🍜', '😴', '👑', '🧸', '🍓'];

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { myProfile, updateMyProfile } = useCouple();

  const [name, setName] = useState(myProfile.name);
  const [nickname, setNickname] = useState(myProfile.nickname);
  const [avatar, setAvatar] = useState(myProfile.avatar);
  const [mood, setMood] = useState(myProfile.mood || '🥰');
  const [statusText, setStatusText] = useState(myProfile.statusText || '');
  const [locationEmoji, setLocationEmoji] = useState(myProfile.locationEmoji || '📍 Việt Nam');
  const [birthday, setBirthday] = useState(myProfile.birthday || '');
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  // Avatar Cropper Modal State
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [rawImageForCrop, setRawImageForCrop] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    soundService.playPop();
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setRawImageForCrop(result);
        setCropModalOpen(true);
      }
    };
    reader.readAsDataURL(file);
    // Reset file input value so same image can be re-selected if needed
    e.target.value = '';
  };

  const handleCropComplete = (croppedDataUrl: string) => {
    setAvatar(croppedDataUrl);
    setCropModalOpen(false);
    setRawImageForCrop(null);
  };

  const handleSelectPreset = (url: string) => {
    soundService.playPop();
    setAvatar(url);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    soundService.playSparkle();

    updateMyProfile({
      name: name.trim() || 'Người yêu',
      nickname: nickname.trim(),
      avatar,
      mood,
      statusText: statusText.trim(),
      locationEmoji: locationEmoji.trim(),
      birthday: birthday || undefined,
    });

    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      setIsSaving(false);
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-[32px] p-6 shadow-2xl border border-rose-100 dark:border-zinc-800 space-y-5 max-h-[90vh] overflow-y-auto"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-500">
              <Camera className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-base text-zinc-900 dark:text-white font-cute">
                Đổi Ảnh Đại Diện & Hồ Sơ 💖
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Tải ảnh từ máy hoặc chọn ảnh đại diện dễ thương
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Avatar Preview & Upload Trigger */}
          <div className="flex flex-col items-center justify-center py-2 space-y-3">
            <div className="relative group cursor-pointer">
              <img
                src={avatar || DEFAULT_AVATAR_ME}
                alt="Avatar Preview"
                className="w-24 h-24 rounded-full object-cover ring-4 ring-rose-400/60 shadow-xl shadow-rose-200/50 dark:shadow-none"
              />
              <label className="absolute inset-0 rounded-full bg-black/40 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer">
                <Camera className="w-6 h-6 mb-1" />
                <span className="text-[10px] font-bold">Đổi ảnh</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              <span className="absolute bottom-0 right-0 p-1.5 rounded-full bg-rose-500 text-white shadow-md text-sm">
                {mood}
              </span>
            </div>

            {/* Direct Upload Button */}
            <label className="px-4 py-2 rounded-full bg-rose-50 dark:bg-zinc-800 hover:bg-rose-100 dark:hover:bg-zinc-700 text-rose-600 dark:text-rose-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition shadow-xs">
              <Upload className="w-3.5 h-3.5" />
              <span>Tải ảnh từ điện thoại / máy tính 📷</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* Preset Cute Avatars */}
          <div>
            <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-2 font-cute">
              Hoặc chọn ảnh đại diện có sẵn:
            </label>
            <div className="grid grid-cols-4 gap-2">
              {CUTE_AVATARS.map((url, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSelectPreset(url)}
                  className={`relative aspect-square rounded-2xl overflow-hidden border-2 transition ${
                    avatar === url
                      ? 'border-rose-500 ring-2 ring-rose-300 scale-105 shadow-md'
                      : 'border-transparent hover:scale-105 opacity-80 hover:opacity-100'
                  }`}
                >
                  <img src={url} alt="preset" className="w-full h-full object-cover" />
                  {avatar === url && (
                    <div className="absolute inset-0 bg-rose-500/20 flex items-center justify-center">
                      <Check className="w-4 h-4 text-white drop-shadow-md" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Name & Nickname */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1 font-cute">
                Tên hiển thị
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-800 dark:text-zinc-100 border-0 focus:ring-2 focus:ring-rose-400 font-cute"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1 font-cute">
                Biệt danh
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-800 dark:text-zinc-100 border-0 focus:ring-2 focus:ring-rose-400 font-cute"
              />
            </div>
          </div>

          {/* Mood Emoji Chips */}
          <div>
            <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1.5 font-cute">
              Cảm xúc hôm nay:
            </label>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {MOOD_EMOJIS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    soundService.playPop();
                    setMood(m);
                  }}
                  className={`p-2 rounded-xl text-sm transition ${
                    mood === m
                      ? 'bg-rose-500 text-white scale-110 shadow-sm'
                      : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-rose-50'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Status text & location */}
          <div>
            <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1 font-cute">
              Dòng trạng thái yêu thương
            </label>
            <input
              type="text"
              value={statusText}
              onChange={(e) => setStatusText(e.target.value)}
              placeholder="Hạnh phúc bên người yêu..."
              className="w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-800 dark:text-zinc-100 border-0 focus:ring-2 focus:ring-rose-400 font-cute"
            />
          </div>

          {/* Birthday Settings (Auto updates anniversaries) */}
          <div className="p-3 rounded-2xl bg-rose-50/60 dark:bg-zinc-800/50 border border-rose-100 dark:border-zinc-700 space-y-2.5">
            <label className="block text-xs font-bold text-rose-600 dark:text-rose-400 font-cute flex items-center gap-1.5">
              <span>🎂</span>
              <span>Cập Nhật Ngày Sinh Của Bạn (Tự động vào sự kiện)</span>
            </label>
            <div>
              <input
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 text-xs text-zinc-800 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 focus:ring-2 focus:ring-rose-400"
              />
              {birthday && (
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono mt-1 block">
                  Ngày sinh: <strong className="text-rose-500">{formatDateVN(birthday)}</strong>
                </span>
              )}
            </div>
          </div>

          {/* Footer Action Buttons */}
          <div className="pt-2 flex items-center justify-between">
            {success ? (
              <span className="text-xs font-bold text-emerald-500 flex items-center gap-1">
                <Check className="w-4 h-4" /> Đã cập nhật ảnh đại diện! 💖
              </span>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs font-bold hover:bg-zinc-200"
              >
                Đóng
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-[#FF758F] to-[#FF9A9E] hover:from-[#ff607e] hover:to-[#ff8d92] text-white font-bold text-xs shadow-md shadow-rose-200 dark:shadow-rose-950 transition active:scale-95 cursor-pointer"
              >
                {isSaving ? 'Đang lưu...' : 'Lưu Thay Đổi ✨'}
              </button>
            </div>
          </div>
        </form>

        {/* Interactive Image Cropper Modal */}
        <AvatarCropModal
          isOpen={cropModalOpen}
          imageSrc={rawImageForCrop}
          onClose={() => {
            setCropModalOpen(false);
            setRawImageForCrop(null);
          }}
          onCropComplete={handleCropComplete}
        />
      </motion.div>
    </div>
  );
};
