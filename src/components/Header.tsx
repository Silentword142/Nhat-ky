import React, { useState, useEffect } from 'react';
import { Heart, Moon, Sun, Lock, Palette, Radio, Send, Sparkles, Wifi, WifiOff, ShieldCheck, Cloud, RefreshCw, MonitorDown, X, CheckCircle2, ChevronRight, Camera, UserCheck, LogIn, UserPlus } from 'lucide-react';
import { useCouple } from '../context/CoupleContext';
import { THEMES } from '../utils/theme';
import { soundService } from '../services/sound';
import { ProfileModal } from './ProfileModal';
import { PartnerProfileModal } from './PartnerProfileModal';
import { AuthModal } from './AuthModal';
import { DEFAULT_AVATAR_ME, DEFAULT_AVATAR_PARTNER } from '../services/mockData';

export const Header: React.FC = () => {
  const {
    myProfile,
    partnerProfile,
    settings,
    daysInLove,
    loveDuration,
    isPartnerOnline,
    syncStatus,
    sendHeartbeat,
    updateSettings,
    isGoogleDriveConnected,
    googleDriveLastSavedAt,
    isGoogleDriveSyncing,
    connectGoogleDrive,
  } = useCouple();

  const [showHeartMenu, setShowHeartMenu] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showPartnerProfileModal, setShowPartnerProfileModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [customPulseMsg, setCustomPulseMsg] = useState('');

  const currentTheme = THEMES[settings.theme] || THEMES.sakura;

  useEffect(() => {
    // Check if already in standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    soundService.playPop();
    if (installPrompt) {
      installPrompt.prompt();
      const choiceResult = await installPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setIsInstalled(true);
        setInstallPrompt(null);
        setShowInstallModal(false);
      }
    } else {
      setShowInstallModal(true);
    }
  };

  const handleSendTap = (type: 'heart' | 'hug' | 'kiss' | 'miss_you') => {
    soundService.playHeartbeat();
    sendHeartbeat(type, customPulseMsg || undefined);
    setCustomPulseMsg('');
    setShowHeartMenu(false);
  };

  return (
    <header className="relative w-full z-30 pt-3 pb-2 px-3 sm:px-6">
      <div className={`max-w-5xl mx-auto ${currentTheme.cardBg} rounded-[32px] sm:rounded-[40px] p-4 sm:p-6 shadow-xl border ${currentTheme.cardBorder} transition-all duration-300`}>
        {/* Top bar: Security Badge, Sync Status, Theme & Dark Mode */}
        <div className="flex items-center justify-between gap-2 mb-4 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            {/* E2EE Security status badge */}
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${currentTheme.accentBadge} font-medium shadow-xs`}
              title="Mã hóa đầu cuối AES-256 kích hoạt. Dữ liệu chỉ giải mã trên thiết bị của hai bạn."
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span className="hidden sm:inline">Bảo mật mã hóa đầu cuối</span>
              <span className="font-bold text-[10px] uppercase tracking-wider">AES-256</span>
            </div>

            {/* Sync connection status */}
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-medium text-[11px] ${
                syncStatus === 'connected'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/40'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/40'
              }`}
            >
              {syncStatus === 'connected' ? (
                <>
                  <Wifi className="w-3.5 h-3.5" />
                  <span>Real-time Sync</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5" />
                  <span>Đang kết nối lại...</span>
                </>
              )}
            </div>

            {/* Room Code Badge */}
            <div
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-mono font-bold text-[11px]"
              style={{
                backgroundColor: `${currentTheme.primaryColor}18`,
                color: currentTheme.primaryColor,
                border: `1px solid ${currentTheme.primaryColor}35`,
              }}
              title="Mã phòng kết nối hiện tại"
            >
              <span>Phòng: {settings.roomCode}</span>
            </div>

            {/* Google Drive Status Badge (click to connect instantly when not yet linked) */}
            <button
              type="button"
              onClick={() => {
                if (isGoogleDriveConnected || isGoogleDriveSyncing) return;
                soundService.playPop();
                connectGoogleDrive().catch(() => {});
              }}
              className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-medium text-[11px] transition ${
                isGoogleDriveConnected
                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/40 cursor-default'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer active:scale-95'
              }`}
              title={
                isGoogleDriveConnected
                  ? `Google Drive đã kết nối (Lưu lúc ${googleDriveLastSavedAt || 'gần đây'})`
                  : 'Bấm để kết nối và tự động sao lưu dữ liệu lên Google Drive'
              }
            >
              <span>📁</span>
              <span>
                {isGoogleDriveSyncing
                  ? 'Đang kết nối...'
                  : isGoogleDriveConnected
                  ? 'Google Drive: Đã lưu'
                  : 'Google Drive: Bấm để bật'}
              </span>
            </button>
          </div>

          {/* Controls: Theme & Dark Mode */}
          <div className="flex items-center gap-2">
            {/* Theme Selector Button */}
            <div className="relative">
              <button
                onClick={() => setShowThemeMenu(!showThemeMenu)}
                className={`px-3.5 py-1.5 rounded-full ${currentTheme.cardBg} border ${currentTheme.cardBorder} text-zinc-800 dark:text-zinc-100 hover:bg-black/5 dark:hover:bg-white/10 transition flex items-center gap-1.5 text-xs font-semibold shadow-xs cursor-pointer`}
                title="Đổi giao diện"
              >
                <Palette className="w-3.5 h-3.5" style={{ color: currentTheme.primaryColor }} />
                <span className="hidden md:inline">Giao diện</span>
              </button>

              {showThemeMenu && (
                <div className="absolute right-0 mt-2 w-64 p-2 rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl border border-zinc-200 dark:border-zinc-800 z-50 max-h-96 overflow-y-auto">
                  <div className="text-xs font-bold text-zinc-600 dark:text-zinc-300 px-2 py-1 mb-1">
                    Chọn chủ đề nghệ thuật
                  </div>
                  <div className="grid grid-cols-1 gap-1">
                    {Object.values(THEMES).map((t) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          updateSettings({ theme: t.id });
                          setShowThemeMenu(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition cursor-pointer ${
                          settings.theme === t.id
                            ? `${t.buttonPrimary} font-bold`
                            : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-100'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span>{t.emoji}</span>
                          <span className="truncate">{t.name}</span>
                        </span>
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-white/50 shrink-0"
                          style={{ backgroundColor: t.primaryColor }}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Account & Login Button */}
            <button
              onClick={() => {
                soundService.playPop();
                setShowAuthModal(true);
              }}
              className={`px-3 py-1.5 rounded-full border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
                settings.accountEmail || myProfile.email || myProfile.authProvider === 'username' || myProfile.authProvider === 'google'
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-300'
                  : `${currentTheme.accentBadge} hover:opacity-90`
              }`}
              title={
                settings.accountEmail || myProfile.email
                  ? `Tài khoản: ${settings.accountEmail || myProfile.email}`
                  : 'Đăng nhập / Lập tài khoản để tránh nhầm lẫn dữ liệu'
              }
            >
              {settings.accountEmail || myProfile.email || myProfile.authProvider === 'username' || myProfile.authProvider === 'google' ? (
                <>
                  <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="hidden sm:inline truncate max-w-[90px]">{myProfile.name || 'Tài khoản'}</span>
                  <span className="sm:hidden">TK</span>
                </>
              ) : (
                <>
                  <LogIn className="w-3.5 h-3.5" style={{ color: currentTheme.primaryColor }} />
                  <span>Đăng Nhập / TK</span>
                </>
              )}
            </button>

            {/* Install Desktop App Button */}
            {!isInstalled && (
              <button
                onClick={handleInstallClick}
                className={`px-3.5 py-1.5 rounded-full ${currentTheme.buttonPrimary} font-bold text-xs shadow-md flex items-center gap-1.5 transition active:scale-95 cursor-pointer`}
                title="Cài đặt LoveSync ra màn hình máy tính (Desktop)"
              >
                <MonitorDown className="w-3.5 h-3.5 animate-bounce" />
                <span>Cài ra Desktop 💻</span>
              </button>
            )}

            {/* Dark Mode Toggle */}
            <button
              onClick={() => {
                soundService.playPop();
                updateSettings({ isDarkMode: !settings.isDarkMode });
              }}
              className={`p-2 rounded-full ${currentTheme.cardBg} border ${currentTheme.cardBorder} text-zinc-800 dark:text-zinc-100 hover:bg-black/5 dark:hover:bg-white/10 transition shadow-xs cursor-pointer`}
              title={settings.isDarkMode ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
            >
              {settings.isDarkMode ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-500" />
              )}
            </button>
          </div>
        </div>

        {/* Artistic Headline & Couple Section */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-1">
          {/* User 1 (Me) */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div
              onClick={() => {
                soundService.playPop();
                setShowProfileModal(true);
              }}
              className="relative group cursor-pointer"
              title="Bấm để đổi ảnh đại diện và hồ sơ 💖"
            >
              <img
                src={myProfile.avatar || DEFAULT_AVATAR_ME}
                alt={myProfile.name || 'Bạn'}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover shadow-lg group-hover:scale-105 transition duration-300"
                style={{
                  boxShadow: `0 0 0 3px ${currentTheme.primaryColor}55`,
                }}
              />
              <div className="absolute inset-0 rounded-full bg-black/35 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                <Camera className="w-5 h-5 drop-shadow-md" />
              </div>
              <span className="absolute -bottom-1 -right-1 text-lg drop-shadow-sm" title="Cảm xúc">
                {myProfile.mood || '🌸'}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3
                  onClick={() => {
                    soundService.playPop();
                    setShowProfileModal(true);
                  }}
                  className="font-serif italic font-bold text-zinc-900 dark:text-zinc-50 text-lg sm:text-xl cursor-pointer transition"
                  style={{ ':hover': { color: currentTheme.primaryColor } } as any}
                  title="Chỉnh sửa tên"
                >
                  {myProfile.name || 'Bạn'}
                </h3>
                {myProfile.nickname && (
                  <span className="text-xs font-semibold" style={{ color: currentTheme.primaryColor }}>
                    ({myProfile.nickname})
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 truncate max-w-[170px] font-cute">
                {myProfile.statusText || 'Chưa cập nhật lời nhắn'}
              </p>
              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                <span>{myProfile.locationEmoji || '📍 Chưa cập nhật'}</span>
                <button
                  onClick={() => {
                    soundService.playPop();
                    setShowProfileModal(true);
                  }}
                  className="hover:underline flex items-center gap-0.5 font-bold cursor-pointer"
                  style={{ color: currentTheme.primaryColor }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full animate-pulse"
                    style={{ backgroundColor: currentTheme.primaryColor }}
                  />{' '}
                  Đổi ảnh
                </button>
              </div>
            </div>
          </div>

          {/* Center Heart and Days in Love */}
          <div className="flex flex-col items-center justify-center my-1 md:my-0 text-center">
            {/* Days in love badge */}
            <div className="relative group mb-1">
              <div className={`px-5 py-2 rounded-full ${currentTheme.buttonPrimary} text-white shadow-lg flex items-center gap-2`}>
                <Heart className="w-4 h-4 fill-white animate-pulse" />
                <span className="font-serif italic font-black text-base sm:text-lg tracking-wide">
                  {settings.coupleStartDate ? `${daysInLove} NGÀY BÊN NHAU` : '0 NGÀY BÊN NHAU'}
                </span>
                <Sparkles className="w-3.5 h-3.5 text-amber-200" />
              </div>
            </div>

            {/* Live timer detail */}
            <div className="text-[11px] text-zinc-600 dark:text-zinc-400 font-mono flex items-center gap-1">
              <span>{loveDuration.hours}h</span>:
              <span>{loveDuration.minutes}m</span>:
              <span className="font-bold" style={{ color: currentTheme.primaryColor }}>
                {loveDuration.seconds}s
              </span>
            </div>

            {/* Send Heartbeat Pulse Button */}
            <div className="relative mt-2">
              <button
                onClick={() => setShowHeartMenu(!showHeartMenu)}
                className={`px-4 py-1.5 rounded-full ${currentTheme.accentBadge} text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shadow-xs cursor-pointer`}
              >
                <Radio className="w-3.5 h-3.5 animate-pulse" style={{ color: currentTheme.primaryColor }} />
                Gửi Nhịp Tim 💖
              </button>

              {/* Heart Pulse Menu */}
              {showHeartMenu && (
                <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-64 p-3 rounded-3xl bg-white dark:bg-zinc-900 shadow-2xl border border-zinc-200 dark:border-zinc-800 z-50 text-left">
                  <div className="text-xs font-bold text-zinc-800 dark:text-zinc-100 mb-2 font-serif italic">
                    Chạm gửi yêu thương tức thì:
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 mb-2.5">
                    <button
                      onClick={() => handleSendTap('miss_you')}
                      className={`p-2 rounded-2xl ${currentTheme.accentBadge} text-xs font-semibold text-left transition flex items-center gap-1.5 cursor-pointer`}
                    >
                      <span>🥺</span> Nhớ người yêu
                    </button>
                    <button
                      onClick={() => handleSendTap('hug')}
                      className={`p-2 rounded-2xl ${currentTheme.accentBadge} text-xs font-semibold text-left transition flex items-center gap-1.5 cursor-pointer`}
                    >
                      <span>🫂</span> Ôm thật chặt
                    </button>
                    <button
                      onClick={() => handleSendTap('kiss')}
                      className={`p-2 rounded-2xl ${currentTheme.accentBadge} text-xs font-semibold text-left transition flex items-center gap-1.5 cursor-pointer`}
                    >
                      <span>💋</span> Hôn ngọt ngào
                    </button>
                    <button
                      onClick={() => handleSendTap('heart')}
                      className={`p-2 rounded-2xl ${currentTheme.accentBadge} text-xs font-semibold text-left transition flex items-center gap-1.5 cursor-pointer`}
                    >
                      <span>💖</span> Rung động
                    </button>
                  </div>

                  <div className="flex gap-1">
                    <input
                      type="text"
                      placeholder="Lời nhắn kèm..."
                      value={customPulseMsg}
                      onChange={(e) => setCustomPulseMsg(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none"
                    />
                    <button
                      onClick={() => handleSendTap('heart')}
                      className={`p-1.5 rounded-xl ${currentTheme.buttonPrimary} text-white transition cursor-pointer`}
                      title="Gửi"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* User 2 (Partner) */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            {partnerProfile ? (
              <>
                <div className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {partnerProfile.nickname && (
                      <span className="text-xs font-semibold" style={{ color: currentTheme.primaryColor }}>
                        ({partnerProfile.nickname})
                      </span>
                    )}
                    <h3
                      onClick={() => {
                        soundService.playPop();
                        setShowPartnerProfileModal(true);
                      }}
                      className="font-serif italic font-bold text-zinc-900 dark:text-zinc-50 text-lg sm:text-xl cursor-pointer hover:opacity-80 transition"
                      title="Bấm để xem thông tin người ấy 💖"
                    >
                      {partnerProfile.name || 'Người thương'}
                    </h3>
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-300 truncate max-w-[170px] font-cute">
                    {partnerProfile.statusText || 'Chưa cập nhật lời nhắn'}
                  </p>
                  <div className="flex items-center justify-end gap-2 mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                    <span className="flex items-center gap-1">
                      {isPartnerOnline ? (
                        <span className="text-emerald-500 flex items-center gap-1 font-medium">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                          Đang Online
                        </span>
                      ) : (
                        <span className="text-zinc-400">Ngoại tuyến</span>
                      )}
                    </span>
                    <button
                      onClick={() => {
                        soundService.playPop();
                        setShowPartnerProfileModal(true);
                      }}
                      className="hover:underline flex items-center gap-0.5 font-bold cursor-pointer"
                      style={{ color: currentTheme.primaryColor }}
                    >
                      <span>Xem hồ sơ</span>
                    </button>
                  </div>
                </div>

                <div
                  onClick={() => {
                    soundService.playPop();
                    setShowPartnerProfileModal(true);
                  }}
                  className="relative group cursor-pointer"
                  title="Bấm để xem hồ sơ và gửi yêu thương đến người ấy 💖"
                >
                  <img
                    src={partnerProfile.avatar || DEFAULT_AVATAR_PARTNER}
                    alt={partnerProfile.name || 'Partner'}
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover shadow-lg group-hover:scale-105 transition duration-300 ring-2 ring-rose-300/50 dark:ring-rose-700/50"
                    style={{
                      boxShadow: `0 0 0 3px ${currentTheme.secondaryColor}55`,
                    }}
                  />
                  <span className="absolute -bottom-1 -left-1 text-lg drop-shadow-sm" title="Cảm xúc">
                    {partnerProfile.mood || '💖'}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <h3 className="font-serif italic font-medium text-zinc-600 dark:text-zinc-300 text-base sm:text-lg">
                      Chưa kết nối
                    </h3>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-[170px] font-cute">
                    Chờ ghép đôi cùng người ấy...
                  </p>
                  <div className="flex items-center justify-end gap-2 mt-0.5 text-[11px]">
                    <span className="flex items-center gap-1 text-zinc-400">
                      <span className="w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                      Chưa ghép đôi
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    soundService.playPop();
                    setShowAuthModal(true);
                  }}
                  className="relative group w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-dashed border-zinc-300 dark:border-zinc-700 bg-black/5 dark:bg-white/5 flex flex-col items-center justify-center hover:opacity-80 transition cursor-pointer"
                  title="Bấm để ghép đôi với người ấy"
                >
                  <UserPlus className="w-5 h-5 group-hover:scale-110 transition" style={{ color: currentTheme.primaryColor }} />
                  <span className="text-[9px] font-bold mt-0.5" style={{ color: currentTheme.primaryColor }}>Ghép đôi</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Desktop App Install Guide Modal */}
      {showInstallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-[32px] p-6 shadow-2xl border border-rose-100 dark:border-zinc-800 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-500 flex items-center justify-center">
                  <MonitorDown className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-zinc-900 dark:text-white font-cute">
                    Cài Đặt LoveSync Ra Màn Hình Desktop 💻
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Ứng dụng độc lập, mở ngay ngoài màn hình không cần gõ lệnh
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowInstallModal(false)}
                className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Direct 1-Click Browser Install Button if supported */}
            {installPrompt && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-950/40 dark:to-pink-950/40 border border-rose-200 dark:border-rose-800 text-center space-y-2">
                <p className="text-xs font-bold text-rose-800 dark:text-rose-200">
                  Trình duyệt của bạn đã sẵn sàng cài đặt!
                </p>
                <button
                  onClick={handleInstallClick}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-bold text-sm shadow-lg shadow-rose-200 dark:shadow-rose-950 transition active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <MonitorDown className="w-4 h-4" />
                  <span>Bấm Vào Đây Để Cài Đặt Ngay ✨</span>
                </button>
              </div>
            )}

            {/* Visual 2-Step Guide for Chrome / Edge / Windows */}
            <div className="space-y-3 text-xs text-zinc-700 dark:text-zinc-300 font-cute">
              <div className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <span>Cách cài đặt trên Google Chrome & Microsoft Edge (3 giây):</span>
              </div>

              <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 space-y-2">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-rose-500 text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <div>
                    <strong>Nhìn lên góc trên bên phải thanh địa chỉ trình duyệt:</strong>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Bấm vào biểu tượng <strong>Màn hình tải xuống 💻 (Cài đặt LoveSync / Install)</strong> ngay cạnh ngôi sao dấu trang.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 space-y-2">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-rose-500 text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <div>
                    <strong>Hoặc bấm dấu 3 chấm `⋮` ở góc phải trình duyệt:</strong>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Chọn <strong>"Lưu và chia sẻ" (Save and share)</strong> $\rightarrow$ Chọn <strong>"Cài đặt ứng dụng LoveSync"</strong> (hoặc "Tạo lối tắt / Create shortcut").
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowInstallModal(false)}
                className="px-5 py-2 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold text-xs hover:bg-zinc-200 transition cursor-pointer"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile & Avatar Edit Modal */}
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />

      {/* Partner Profile View Modal */}
      <PartnerProfileModal
        isOpen={showPartnerProfileModal}
        onClose={() => setShowPartnerProfileModal(false)}
      />

      {/* User Account & Login / Register Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </header>
  );
};
