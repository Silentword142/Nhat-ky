import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Palette,
  Volume2,
  VolumeX,
  Sparkles,
  Share2,
  Copy,
  Check,
  Moon,
  Sun,
  User,
  ShieldCheck,
  Download,
  Upload,
  RefreshCw,
  Heart,
  BookHeart,
  Wifi,
  WifiOff,
  CheckCircle2,
  Radio,
  Users,
  FolderSync,
  ExternalLink,
  Cloud,
  CloudOff,
  LogOut,
  Trash2,
  AlertTriangle,
  Lock,
  KeyRound,
  Eye,
} from 'lucide-react';
import { useCouple } from '../context/CoupleContext';
import { THEMES } from '../utils/theme';
import { soundService } from '../services/sound';
import { compressImageFile, CUTE_AVATARS } from '../utils/image';
import { DEFAULT_AVATAR_ME, DEFAULT_AVATAR_PARTNER } from '../services/mockData';
import { getOAuthClientId, setCustomOAuthClientId, DEFAULT_PROD_CLIENT_ID, getAccessToken, googleSignIn, getYouTubeApiKey, setCustomYouTubeApiKey } from '../services/googleAuth';
import {
  getCustomPhotosFolder,
  setCustomPhotosFolder,
  clearCustomPhotosFolder,
  extractDriveFolderId,
  getFolderDetails,
} from '../services/googleDrive';
import { AvatarCropModal } from '../components/AvatarCropModal';
import { PartnerProfileModal } from '../components/PartnerProfileModal';
import { DateInputVN } from '../components/DateInputVN';
import { changePasswordWithoutOld, getCurrentAuthUser } from '../services/auth';

export const SettingsView: React.FC = () => {
  const {
    myProfile,
    partnerProfile,
    settings,
    updateMyProfile,
    updateSettings,
    exportData,
    importData,
    syncStatus,
    lastSyncedAt,
    isPartnerOnline,
    partnerAccountInfo,
    googleUser,
    isGoogleDriveConnected,
    isGoogleDriveSyncing,
    googleDriveFolderUrl,
    googleDriveFolderName,
    connectGoogleDrive,
    disconnectGoogleDrive,
    syncNow,
    setRoomCode,
    changeCoupleRoomCode,
    leaveCoupleRoom,
    unlinkPartnerAccount,
    clearAllUserDataAndLogout,
    clearAllSystemAndLocalData,
  } = useCouple();

  const currentTheme = THEMES[settings.theme] || THEMES.sakura;

  // Profile states
  const [name, setName] = useState(myProfile.name);
  const [nickname, setNickname] = useState(myProfile.nickname || '');
  const [avatar, setAvatar] = useState(myProfile.avatar);
  const [statusText, setStatusText] = useState(myProfile.statusText);
  const [locationEmoji, setLocationEmoji] = useState(myProfile.locationEmoji);
  const [birthday, setBirthday] = useState(myProfile.birthday || '');
  const [isProfileSaved, setIsProfileSaved] = useState(false);

  // Partner Profile Modal state
  const [showPartnerModal, setShowPartnerModal] = useState(false);

  // Direct Password Change State (No old password required)
  const currentAuth = getCurrentAuthUser();
  const [pwdUsername, setPwdUsername] = useState(currentAuth?.username || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdSuccessMsg, setPwdSuccessMsg] = useState<string | null>(null);
  const [pwdErrorMsg, setPwdErrorMsg] = useState<string | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = (pwdUsername || currentAuth?.username || '').trim().toLowerCase();
    if (!cleanUser) {
      setPwdErrorMsg('Vui lòng nhập tên tài khoản cần đổi mật khẩu.');
      return;
    }
    if (!newPassword.trim() || newPassword.length < 4) {
      setPwdErrorMsg('Mật khẩu mới cần tối thiểu 4 ký tự.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPwdErrorMsg('Xác nhận mật khẩu mới không khớp.');
      return;
    }

    setPwdLoading(true);
    setPwdErrorMsg(null);
    try {
      soundService.playPop();
      const res = await changePasswordWithoutOld(cleanUser, newPassword);
      soundService.playSparkle();
      setPwdSuccessMsg(res.message || 'Đã đổi mật khẩu thành công! Không cần nhập lại mật khẩu cũ.');
      setNewPassword('');
      setConfirmNewPassword('');
      setTimeout(() => setPwdSuccessMsg(null), 4000);
    } catch (err: any) {
      setPwdErrorMsg(err.message || 'Không thể đổi mật khẩu. Vui lòng kiểm tra lại.');
    } finally {
      setPwdLoading(false);
    }
  };

  // Danger Zone / Clear Data States
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearType, setClearType] = useState<'device' | 'all'>('all');
  const [isClearing, setIsClearing] = useState(false);
  const [clearSuccessMsg, setClearSuccessMsg] = useState('');

  // Avatar Crop Modal state for Settings
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [rawImageForCrop, setRawImageForCrop] = useState<string | null>(null);

  // Keep form values in sync with myProfile updates
  React.useEffect(() => {
    setName(myProfile.name);
    setNickname(myProfile.nickname || '');
    setAvatar(myProfile.avatar);
    setStatusText(myProfile.statusText);
    setLocationEmoji(myProfile.locationEmoji);
    setBirthday(myProfile.birthday || '');
  }, [myProfile]);

  // Pairing & Live Sync states
  const [roomCodeInput, setRoomCodeInput] = useState(settings.roomCode);
  const [hasCopiedCode, setHasCopiedCode] = useState(false);
  const [hasCopiedLink, setHasCopiedLink] = useState(false);
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [isChangingRoom, setIsChangingRoom] = useState(false);
  const [syncSuccessNotice, setSyncSuccessNotice] = useState<string | null>(null);
  const [driveActionNotice, setDriveActionNotice] = useState<string | null>(null);

  // Anniversary date setting
  const [startDateInput, setStartDateInput] = useState(settings.coupleStartDate);

  // Google OAuth Client ID custom configuration
  const [customClientIdInput, setCustomClientIdInput] = useState(getOAuthClientId());
  const [isSavedClientId, setIsSavedClientId] = useState(false);
  const [showOAuthSettings, setShowOAuthSettings] = useState(false);

  // Custom Google Drive Photos Folder Setting in SettingsView
  const [customPhotosFolderInput, setCustomPhotosFolderInput] = useState(() => {
    const cf = getCustomPhotosFolder();
    return cf?.url || cf?.id || '';
  });
  const [customPhotosFolderName, setCustomPhotosFolderName] = useState(() => {
    const cf = getCustomPhotosFolder();
    return cf?.name || '';
  });
  const [isVerifyingDriveFolder, setIsVerifyingDriveFolder] = useState(false);
  const [showDriveFolderSettings, setShowDriveFolderSettings] = useState(false);
  const [customFolderSaveNotice, setCustomFolderSaveNotice] = useState<string | null>(null);
  const [customFolderErrorNotice, setCustomFolderErrorNotice] = useState<string | null>(null);
  const [activePhotosFolder, setActivePhotosFolder] = useState(() => getCustomPhotosFolder());

  const handleSavePhotosFolderSetting = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const input = customPhotosFolderInput.trim();
    if (!input) {
      clearCustomPhotosFolder();
      setActivePhotosFolder(null);
      setCustomFolderErrorNotice(null);
      setCustomFolderSaveNotice('✓ Đã đặt lại về thư mục Album Ảnh mặc định của LoveSync!');
      soundService.playSparkle();
      setTimeout(() => setCustomFolderSaveNotice(null), 4000);
      return;
    }

    const folderId = extractDriveFolderId(input);
    if (!folderId) {
      setCustomFolderErrorNotice('Đường dẫn không hợp lệ. Vui lòng dán link Google Drive hoặc Folder ID.');
      return;
    }

    try {
      setIsVerifyingDriveFolder(true);
      setCustomFolderErrorNotice(null);
      setCustomFolderSaveNotice(null);

      let token = await getAccessToken();
      if (!token) {
        const res = await googleSignIn();
        token = res?.accessToken || null;
      }
      if (!token) {
        setCustomFolderErrorNotice('Chưa kết nối Google Drive. Vui lòng kết nối Google Drive trước.');
        return;
      }

      const details = await getFolderDetails(token, folderId);
      if (!details) {
        setCustomFolderErrorNotice('Không tìm thấy thư mục hoặc chưa cấp quyền truy cập thư mục này. Vui lòng kiểm tra quyền trên Google Drive.');
        return;
      }

      const finalName = customPhotosFolderName.trim() || details.name;
      const saved = setCustomPhotosFolder(details.id, finalName);
      setActivePhotosFolder(saved);
      soundService.playSparkle();
      setCustomFolderSaveNotice(`✓ Đã đổi đường dẫn lưu ảnh sang thư mục "${finalName}"!`);
      setTimeout(() => setCustomFolderSaveNotice(null), 4000);
    } catch (err: any) {
      setCustomFolderErrorNotice(err.message || 'Lỗi kiểm tra thư mục Google Drive.');
    } finally {
      setIsVerifyingDriveFolder(false);
    }
  };

  const handleResetPhotosFolderSetting = () => {
    clearCustomPhotosFolder();
    setActivePhotosFolder(null);
    setCustomPhotosFolderInput('');
    setCustomPhotosFolderName('');
    setCustomFolderErrorNotice(null);
    setCustomFolderSaveNotice('✓ Đã khôi phục về thư mục Album Ảnh mặc định của LoveSync!');
    soundService.playPop();
    setTimeout(() => setCustomFolderSaveNotice(null), 4000);
  };

  const handleSaveCustomClientId = (e: React.FormEvent) => {
    e.preventDefault();
    setCustomOAuthClientId(customClientIdInput);
    setIsSavedClientId(true);
    setDriveActionNotice('Đã lưu Google OAuth Client ID thành công!');
    setTimeout(() => setIsSavedClientId(false), 3000);
    setTimeout(() => setDriveActionNotice(null), 5000);
  };

  const handleResetClientId = () => {
    setCustomClientIdInput(DEFAULT_PROD_CLIENT_ID);
    setCustomOAuthClientId(DEFAULT_PROD_CLIENT_ID);
    setDriveActionNotice('Đã đặt lại Client ID mặc định!');
    setTimeout(() => setDriveActionNotice(null), 4000);
  };

  // YouTube Data API v3 key — needed for in-app song search since this is a static site with no
  // backend to proxy the request through.
  const [customYouTubeKeyInput, setCustomYouTubeKeyInput] = useState(getYouTubeApiKey());
  const [isSavedYouTubeKey, setIsSavedYouTubeKey] = useState(false);
  const [showYouTubeKeySettings, setShowYouTubeKeySettings] = useState(false);

  const handleSaveYouTubeApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    setCustomYouTubeApiKey(customYouTubeKeyInput);
    setIsSavedYouTubeKey(true);
    setDriveActionNotice('Đã lưu YouTube API Key thành công! Thử tìm kiếm bài hát lại nhé 🎵');
    setTimeout(() => setIsSavedYouTubeKey(false), 3000);
    setTimeout(() => setDriveActionNotice(null), 5000);
  };

  const handleClearYouTubeApiKey = () => {
    setCustomYouTubeKeyInput('');
    setCustomYouTubeApiKey('');
    setDriveActionNotice('Đã xóa YouTube API Key.');
    setTimeout(() => setDriveActionNotice(null), 4000);
  };

  // Backup & Import
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Copy Room Code
  const handleCopyCode = () => {
    navigator.clipboard.writeText(settings.roomCode);
    setHasCopiedCode(true);
    soundService.playPop();
    setTimeout(() => setHasCopiedCode(false), 2000);
  };

  // Generate & Copy 1-Click Invite Link
  const getInviteLink = () => {
    let origin = window.location.origin;
    // If in dev environment, convert to shared preview url so partner can access publicly
    if (origin.includes('ais-dev-')) {
      origin = origin.replace('ais-dev-', 'ais-pre-');
    }
    const pathname = window.location.pathname.replace(/\/+$/, '');
    return `${origin}${pathname || ''}?room=${encodeURIComponent(settings.roomCode)}`;
  };

  const handleCopyInviteLink = () => {
    soundService.playSparkle();
    navigator.clipboard.writeText(getInviteLink());
    setHasCopiedLink(true);
    setSyncSuccessNotice('Đã sao chép link ghép đôi! Hãy gửi link này cho người yêu.');
    setTimeout(() => {
      setHasCopiedLink(false);
      setSyncSuccessNotice(null);
    }, 4000);
  };

  // Save Room Code / Switch Room (WITH AUTO-MIGRATION OF PARTNER & DATA)
  const handleSaveRoomCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = roomCodeInput.trim().toUpperCase();
    if (!cleanCode) return;

    try {
      setIsChangingRoom(true);
      await changeCoupleRoomCode(cleanCode);
      soundService.playSparkle();
      setSyncSuccessNotice(`Đã đổi sang mã phòng "${cleanCode}"! Hệ thống đã tự động chuyển dữ liệu và đồng bộ tài khoản người yêu sang phòng mới.`);
      setTimeout(() => setSyncSuccessNotice(null), 4500);
    } catch (err: any) {
      setSyncSuccessNotice(`Lỗi: ${err.message || 'Không thể đổi mã phòng'}`);
    } finally {
      setIsChangingRoom(false);
    }
  };

  // Leave current couple room and create a clean private room
  const handleLeaveRoom = async () => {
    if (!window.confirm('Bạn có muốn rời khỏi phòng này và trở về phòng riêng không?')) return;
    try {
      setIsChangingRoom(true);
      await leaveCoupleRoom();
      soundService.playPop();
      setSyncSuccessNotice('Đã rời khỏi phòng và chuyển về phòng riêng biệt.');
      setTimeout(() => setSyncSuccessNotice(null), 3500);
    } catch (err: any) {
      setSyncSuccessNotice(`Lỗi: ${err.message || 'Không thể rời phòng'}`);
    } finally {
      setIsChangingRoom(false);
    }
  };

  // Unlink Partner
  const handleUnlinkPartner = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn hủy liên kết với tài khoản này không? Sau khi hủy, đối phương sẽ được gỡ khỏi Header và bạn sẽ chuyển về phòng riêng.')) return;
    try {
      await unlinkPartnerAccount();
      setSyncSuccessNotice('Đã hủy liên kết thành công! Đối phương đã được gỡ khỏi Header và chuyển về phòng riêng biệt.');
      setTimeout(() => setSyncSuccessNotice(null), 4000);
    } catch (err) {}
  };

  // Google Drive Handlers
  const handleConnectDrive = async () => {
    try {
      setDriveActionNotice('Đang mở cửa sổ đăng nhập Google Drive...');
      const ok = await connectGoogleDrive();
      if (ok) {
        setDriveActionNotice(`Đã kết nối Google Drive! Ảnh bạn tải lên Album ảnh sẽ được lưu vào thư mục "${googleDriveFolderName}". 🎉`);
        setTimeout(() => setDriveActionNotice(null), 5000);
      } else {
        setDriveActionNotice('Cửa sổ Google đã đóng hoặc chưa hoàn tất cấp quyền. Bạn có thể nhấn lại để thử lại nhé.');
        setTimeout(() => setDriveActionNotice(null), 6000);
      }
    } catch (err: any) {
      console.error('Drive connection error:', err);
      if (
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request' ||
        err?.message?.includes('popup-closed-by-user')
      ) {
        setDriveActionNotice('Cửa sổ đăng nhập Google đã đóng. Nhấn "Kết Nối Google Drive Ngay" để đăng nhập lại.');
      } else if (err?.code === 'auth/popup-blocked') {
        setDriveActionNotice('Trình duyệt đã chặn cửa sổ bật lên (popup). Vui lòng cho phép popup trong thanh địa chỉ và thử lại.');
      } else {
        setDriveActionNotice(`Lỗi kết nối: ${err.message || 'Không thể kết nối Google Drive. Vui lòng thử lại.'}`);
      }
      setTimeout(() => setDriveActionNotice(null), 7000);
    }
  };

  const handleDisconnectDrive = async () => {
    if (!window.confirm('Bạn có muốn ngắt kết nối Google Drive không?')) return;
    await disconnectGoogleDrive();
    setDriveActionNotice('Đã ngắt kết nối Google Drive.');
    setTimeout(() => setDriveActionNotice(null), 3000);
  };

  // Manual Instant Sync
  const handleManualSync = async () => {
    setIsManualSyncing(true);
    soundService.playPop();
    const ok = await syncNow();
    setIsManualSyncing(false);
    if (ok) {
      setSyncSuccessNotice('Đã đồng bộ toàn bộ dữ liệu thời gian thực thành công!');
      setTimeout(() => setSyncSuccessNotice(null), 3500);
    }
  };

  // Save Couple Anniversary Date
  const handleSaveAnniversary = (e: React.FormEvent) => {
    e.preventDefault();
    soundService.playPop();
    updateSettings({ coupleStartDate: startDateInput });
    setSyncSuccessNotice('Đã lưu ngày bắt đầu yêu!');
    setTimeout(() => setSyncSuccessNotice(null), 3000);
  };

  // Handle Avatar file upload with cropping
  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    e.target.value = '';
  };

  const handleCropComplete = (croppedDataUrl: string) => {
    setAvatar(croppedDataUrl);
    setCropModalOpen(false);
    setRawImageForCrop(null);
    // Immediately update profile avatar as well for quick sync
    updateMyProfile({ avatar: croppedDataUrl });
  };

  // Save Profile
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    soundService.playSparkle();
    updateMyProfile({
      name: name.trim() || 'Người yêu',
      nickname: nickname.trim(),
      avatar,
      statusText: statusText.trim(),
      locationEmoji: locationEmoji.trim(),
      birthday: birthday || undefined,
    });

    setIsProfileSaved(true);
    setSyncSuccessNotice('Đã cập nhật hồ sơ và ngày sinh nhật vào hệ thống sự kiện!');
    setTimeout(() => {
      setIsProfileSaved(false);
      setSyncSuccessNotice(null);
    }, 3500);
  };

  // Export JSON backup
  const handleExport = () => {
    soundService.playSparkle();
    const dataStr = exportData();
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lovesync-backup-${settings.roomCode}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import JSON backup
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const success = importData(text);
        if (success) {
          soundService.playSparkle();
          setImportStatus('Khôi phục dữ liệu thành công! 💖');
        } else {
          setImportStatus('Tệp không hợp lệ.');
        }
      } catch {
        setImportStatus('Lỗi khi đọc tệp sao lưu.');
      }
      setTimeout(() => setImportStatus(null), 3000);
    };
    reader.readAsText(file);
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-3 sm:px-6 pb-24 sm:pb-12 space-y-6">
      {/* 1. REAL-TIME INSTANT WEB SYNC (LIVE COUPLE ROOM) */}
      <div className={`rounded-[32px] ${currentTheme.cardBg} border ${currentTheme.borderSubtle} p-6 sm:p-8 shadow-xl shadow-rose-100/30 dark:shadow-none`}>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-rose-500 via-pink-500 to-rose-400 flex items-center justify-center text-white shadow-md shadow-rose-200 dark:shadow-none">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-serif italic font-bold text-[#333] dark:text-[#f4effa]">
                Đồng Bộ Trực Tiếp & Tức Thì (Real-Time Web Sync)
              </h3>
              <p className="text-xs text-[#888] dark:text-zinc-400 font-cute">
                Tự động đồng bộ nhật ký, ảnh kỷ niệm, thiệp viết tay ngay lập tức giữa 2 thiết bị
              </p>
            </div>
          </div>

          {/* Connection Status Pill */}
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full font-medium text-xs shadow-xs ${
                syncStatus === 'connected'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                  : 'bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  syncStatus === 'connected' ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'
                }`}
              />
              <span className="font-bold">
                {syncStatus === 'connected' ? '🟢 Đang đồng bộ trực tiếp' : '🟡 Đang kết nối...'}
              </span>
            </div>

            {/* Partner Status Pill */}
            <div
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold ${
                isPartnerOnline
                  ? 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>{isPartnerOnline ? 'Người yêu đang online 💑' : 'Người yêu chưa mở app'}</span>
            </div>
          </div>
        </div>

        {syncSuccessNotice && (
          <div className="mb-5 p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2 font-cute">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
            <span>{syncSuccessNotice}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Room Code & 1-Click Secret Link Card */}
          <div className="p-5 sm:p-6 rounded-3xl bg-[#FFF5F7] dark:bg-zinc-800/40 border border-[#FFE4E9] dark:border-zinc-700/60 flex flex-col justify-between space-y-4">
            <div>
              <div className="text-xs font-bold text-[#FF758F] uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Mã Phòng Của Hai Bạn</span>
                <span className="text-[10px] text-zinc-400 normal-case font-normal">Tự động kết nối tức thì</span>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 px-4 py-3 rounded-2xl bg-white dark:bg-zinc-900 border border-[#FFE4E9] dark:border-zinc-700 font-mono text-lg font-extrabold text-[#FF758F] text-center tracking-widest shadow-inner">
                  {settings.roomCode}
                </div>
                <button
                  onClick={handleCopyCode}
                  className="px-4 py-3 rounded-2xl bg-gradient-to-r from-[#FF758F] to-[#FF9A9E] hover:from-[#ff607e] hover:to-[#ff8d92] text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-rose-200 dark:shadow-rose-950 transition active:scale-95 whitespace-nowrap cursor-pointer"
                >
                  {hasCopiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{hasCopiedCode ? 'Đã chép' : 'Sao chép mã'}</span>
                </button>
              </div>

              {/* 1-Click Secret Link for Partner */}
              <div className="pt-3 border-t border-[#FFE4E9] dark:border-zinc-700/50">
                <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-1 font-cute">
                  <Sparkles className="w-3.5 h-3.5 text-[#FF758F]" />
                  <span>Link Ghép Đôi 1-Chạm (Gửi Cho Người Yêu)</span>
                </div>
                <button
                  onClick={handleCopyInviteLink}
                  className="w-full py-3 px-4 rounded-2xl bg-white dark:bg-zinc-900 border-2 border-dashed border-[#FF758F] hover:bg-rose-50/50 text-[#FF758F] dark:text-[#FF9A9E] font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95 shadow-xs cursor-pointer"
                >
                  {hasCopiedLink ? <Check className="w-4 h-4 text-emerald-500" /> : <Share2 className="w-4 h-4" />}
                  <span>{hasCopiedLink ? '✅ Đã sao chép link ghép đôi!' : '🔗 Sao Chép Link Ghép Đôi Tức Thì'}</span>
                </button>
              </div>
            </div>

            <p className="text-[11px] text-[#888] dark:text-zinc-400 leading-relaxed font-cute">
              💡 <strong>Rất đơn giản:</strong> Bạn chỉ cần bấm nút <strong>"Sao Chép Link Ghép Đôi"</strong> và gửi link cho đối phương. Người ấy mở link là 2 máy sẽ tự động kết nối chung 1 phòng và đồng bộ ngay lập tức!
            </p>
          </div>

          {/* Change Room Code & Sync Status */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between space-y-4">
            <form onSubmit={handleSaveRoomCode} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5 font-cute">
                  Đổi Mã Phòng Mới (Tự Chuyển Cả Dữ Liệu & Người Yêu)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={roomCodeInput}
                    onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                    placeholder="Ví dụ: LOVE99, PHONG-ANH-EM"
                    className="flex-1 px-4 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-mono font-bold text-zinc-800 dark:text-zinc-100 focus:ring-2 focus:ring-[#FF758F] outline-hidden uppercase"
                  />
                  <button
                    type="submit"
                    disabled={isChangingRoom}
                    className="px-4 py-2.5 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shadow-md shadow-rose-200 dark:shadow-none transition active:scale-95 cursor-pointer whitespace-nowrap disabled:opacity-50"
                  >
                    {isChangingRoom ? 'Đang đổi...' : 'Đổi Phòng 🚀'}
                  </button>
                </div>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium block mt-1.5 leading-snug font-cute">
                  ✨ Khi bạn đổi mã phòng, tài khoản của người yêu và toàn bộ ảnh/nhật ký sẽ tự động chuyển sang mã phòng mới cùng bạn!
                </span>
              </div>
            </form>

            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
              <div className="flex items-center justify-between text-xs font-cute text-zinc-600 dark:text-zinc-400">
                <span>Lần đồng bộ gần nhất:</span>
                <span className="font-bold text-zinc-800 dark:text-zinc-200">
                  {lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString('vi-VN') : 'Vừa xong'}
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleManualSync}
                  disabled={isManualSyncing}
                  className="flex-1 py-2.5 px-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isManualSyncing ? 'animate-spin' : ''}`} />
                  <span>{isManualSyncing ? 'Đang kiểm tra...' : 'Đồng Bộ Lại (Sync Now)'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleLeaveRoom}
                  disabled={isChangingRoom}
                  className="px-3.5 py-2.5 rounded-2xl bg-rose-50 hover:bg-rose-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer border border-rose-200/60 dark:border-zinc-700 disabled:opacity-50"
                  title="Rời khỏi phòng ghép đôi hiện tại và chuyển sang phòng riêng"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Rời phòng</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* COUPLE CONNECTION & UNLINK CARD */}
        <div className="mt-5 p-5 rounded-3xl bg-gradient-to-br from-rose-50/80 via-pink-50/40 to-white dark:from-zinc-800/80 dark:to-zinc-900 border border-rose-200/70 dark:border-zinc-700">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">💑</span>
              <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 font-cute">
                Trạng Thái Ghép Đôi & Quản Lý Liên Kết (Couple Connection)
              </h4>
            </div>
            {partnerProfile ? (
              <span className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Đã kết nối với: {partnerProfile.name || 'Người thương'}
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-xs font-bold border border-amber-300 dark:border-amber-800">
                Chưa có người yêu tham gia phòng
              </span>
            )}
          </div>

          {partnerProfile ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-zinc-800/70 border border-rose-100 dark:border-zinc-700/60 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full ring-2 ring-rose-400 overflow-hidden shadow-sm flex items-center justify-center bg-rose-100">
                  <img
                    src={partnerProfile.avatar || DEFAULT_AVATAR_ME}
                    alt="Partner Avatar"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <div className="font-bold text-sm text-zinc-800 dark:text-zinc-100 flex items-center gap-1.5">
                    <span>{partnerProfile.name || 'Người thương'}</span>
                    {partnerProfile.nickname && (
                      <span className="text-xs text-rose-500 font-cute">({partnerProfile.nickname})</span>
                    )}
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-medium ml-1">
                      {isPartnerOnline ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">● Đang Online</span>
                      ) : (
                        <span className="text-zinc-400">○ Ngoại tuyến</span>
                      )}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-cute mt-0.5">
                    {partnerProfile.statusText || 'Hai bạn đang kết nối chung phòng'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleUnlinkPartner}
                className="px-4 py-2 text-xs font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 rounded-xl transition cursor-pointer self-end sm:self-center shadow-xs flex items-center gap-1.5 active:scale-95"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Hủy Liên Kết Đối Phương</span>
              </button>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-white dark:bg-zinc-800/70 border border-rose-100 dark:border-zinc-700/60 space-y-2">
              <p className="text-xs text-zinc-600 dark:text-zinc-300 font-cute leading-relaxed">
                Để kết nối với người yêu, bạn chỉ cần gửi <strong>Mã Phòng</strong> ({settings.roomCode}) hoặc <strong>Link Ghép Đôi 1-Chạm</strong> ở phía trên. Khi đối phương truy cập, hệ thống sẽ tự động ghép đôi và lưu trữ thông tin hai bạn.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopyInviteLink}
                  className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shadow-sm transition active:scale-95 flex items-center gap-1.5"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Sao Chép Link Ghép Đôi</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* GOOGLE DRIVE — PHOTO FILE STORAGE ONLY */}
        <div className="mt-5 p-5 rounded-3xl bg-gradient-to-br from-blue-50/80 via-indigo-50/30 to-white dark:from-zinc-800/80 dark:to-zinc-900 border border-blue-200/80 dark:border-blue-900/50">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-xs">
                <FolderSync className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 font-cute flex items-center gap-1.5">
                  <span>Lưu Trữ Ảnh Google Drive</span>
                  <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-mono font-semibold">
                    Google Drive API
                  </span>
                </h4>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-cute">
                  Ảnh bạn tải lên Album ảnh được lưu vào thư mục riêng <span className="font-semibold text-blue-600 dark:text-blue-400 font-mono">"{googleDriveFolderName}"</span> trên Google Drive của bạn — bắt buộc phải kết nối trước khi tải ảnh. Nhật ký, thư tay, ngày kỷ niệm và cài đặt luôn nằm trên Firebase, không liên quan tới Drive.
                </p>
              </div>
            </div>

            {isGoogleDriveConnected ? (
              <span className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Đã kết nối: {googleUser?.email || 'Google Drive'}
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs font-bold border border-zinc-300 dark:border-zinc-700 flex items-center gap-1">
                <CloudOff className="w-3.5 h-3.5" /> Chưa kết nối Drive
              </span>
            )}
          </div>

          {driveActionNotice && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-3 p-3 rounded-2xl bg-blue-100/90 dark:bg-blue-950/70 border border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-200 text-xs font-cute font-medium flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-blue-500 shrink-0" />
              <span>{driveActionNotice}</span>
            </motion.div>
          )}

          {isGoogleDriveConnected ? (
            <div className="space-y-3">
              {googleDriveFolderUrl && (
                <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-800/80 border border-blue-100 dark:border-zinc-700 text-xs">
                  <a
                    href={googleDriveFolderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 font-bold hover:underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Mở thư mục ảnh trên Google Drive</span>
                  </a>
                </div>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleDisconnectDrive}
                  className="px-3 py-2 text-xs text-zinc-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 rounded-xl transition cursor-pointer flex items-center gap-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Ngắt kết nối</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-white dark:bg-zinc-800/70 border border-blue-100 dark:border-zinc-700/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="text-xs text-zinc-600 dark:text-zinc-300 font-cute space-y-1">
                <p className="font-semibold text-zinc-800 dark:text-zinc-100">
                  Kết nối để tải ảnh lên Album ảnh
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Bắt buộc kết nối Google Drive trước khi tải bất kỳ ảnh nào lên — ảnh gốc được lưu trong Drive của chính bạn.
                </p>
              </div>
              <button
                type="button"
                onClick={handleConnectDrive}
                disabled={isGoogleDriveSyncing}
                className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md shadow-blue-200 dark:shadow-none transition active:scale-95 cursor-pointer whitespace-nowrap disabled:opacity-50 flex items-center gap-2"
              >
                <Cloud className={`w-4 h-4 ${isGoogleDriveSyncing ? 'animate-spin' : ''}`} />
                <span>{isGoogleDriveSyncing ? 'Đang kết nối...' : 'Kết Nối Google Drive Ngay 📁'}</span>
              </button>
            </div>
          )}

          {/* Advanced OAuth Client ID setting for custom deployments (Render, Vercel, custom domain) */}
          <div className="mt-4 pt-3 border-t border-blue-100/80 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setShowOAuthSettings(!showOAuthSettings)}
              className="text-[11px] text-blue-600 hover:text-blue-700 dark:text-blue-400 font-semibold font-cute flex items-center justify-between w-full p-2 rounded-xl hover:bg-blue-50 dark:hover:bg-zinc-800/60 transition cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <span>⚙️</span>
                <span>Cấu hình Google OAuth Client ID (Dành cho Render / Web riêng / Tên miền tùy chỉnh)</span>
              </span>
              <span className="text-xs">{showOAuthSettings ? '▲ Thu gọn' : '▼ Mở rộng'}</span>
            </button>

            {showOAuthSettings && (
              <form onSubmit={handleSaveCustomClientId} className="mt-3 p-4 rounded-2xl bg-white/95 dark:bg-zinc-800/95 border border-blue-200 dark:border-zinc-700 space-y-3.5 text-xs shadow-xs">
                {/* Current Origin Notice */}
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/60 space-y-1.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-[11px] font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1 font-cute">
                      <span>🌐 Tên miền Web hiện tại (Origin):</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        soundService.playSparkle();
                        navigator.clipboard.writeText(typeof window !== 'undefined' ? window.location.origin : '');
                        setDriveActionNotice('Đã sao chép tên miền vào bộ nhớ tạm!');
                        setTimeout(() => setDriveActionNotice(null), 3000);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Sao chép tên miền</span>
                    </button>
                  </div>
                  <code className="block px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-blue-200 dark:border-zinc-700 font-mono text-[11px] text-blue-700 dark:text-blue-300 font-bold select-all break-all">
                    {typeof window !== 'undefined' ? window.location.origin : 'https://moonandcloud-3.onrender.com'}
                  </code>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 font-cute mb-1">
                    Google OAuth 2.0 Client ID:
                  </label>
                  <input
                    type="text"
                    value={customClientIdInput}
                    onChange={(e) => setCustomClientIdInput(e.target.value)}
                    placeholder="xxxx-xxxxxxxx.apps.googleusercontent.com"
                    className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-400"
                  />
                </div>

                {/* Step by step instructions for fix origin_mismatch */}
                <div className="p-3 rounded-xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200 space-y-1.5 font-cute leading-relaxed">
                  <div className="font-bold flex items-center gap-1 text-amber-800 dark:text-amber-300">
                    <span>🛠️ Hướng dẫn sửa "Lỗi 400: origin_mismatch":</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 pl-1">
                    <li>
                      Mở <strong>Google Cloud Console</strong> &rarr; Vào <strong>APIs & Services &rarr; Credentials</strong>.
                    </li>
                    <li>
                      Bấm vào <strong>OAuth 2.0 Client ID</strong> bạn đang dùng (hoặc tạo mới loại <em>Web application</em>).
                    </li>
                    <li>
                      Tại mục <strong>Authorized JavaScript origins</strong> (Nguồn gốc JavaScript được uỷ quyền), bấm <strong>+ ADD URI</strong> và dán: <code className="px-1 py-0.5 rounded bg-white dark:bg-zinc-800 font-mono text-[10px] text-blue-600 dark:text-blue-400 font-bold select-all">{typeof window !== 'undefined' ? window.location.origin : 'https://moonandcloud-3.onrender.com'}</code>
                    </li>
                    <li>
                      Bấm <strong>SAVE (Lưu)</strong> và dán Client ID vào ô bên trên rồi bấm <strong>Lưu Client ID</strong>.
                    </li>
                  </ol>
                </div>

                <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-cute">
                    💡 Bạn cũng có thể thiết lập biến <code className="font-mono text-blue-600">VITE_GOOGLE_CLIENT_ID</code> trên Render.
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleResetClientId}
                      className="px-3 py-1.5 text-[11px] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-xl transition cursor-pointer"
                    >
                      Đặt lại mặc định
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isSavedClientId ? 'Đã Lưu!' : 'Lưu Client ID'}</span>
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>

          {/* YouTube Data API v3 Key — needed for in-app song search on a static site */}
          <div className="mt-4 pt-3 border-t border-blue-100/80 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setShowYouTubeKeySettings(!showYouTubeKeySettings)}
              className="text-[11px] text-red-600 hover:text-red-700 dark:text-red-400 font-semibold font-cute flex items-center justify-between w-full p-2 rounded-xl hover:bg-red-50 dark:hover:bg-zinc-800/60 transition cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <span>🎵</span>
                <span>Cấu hình YouTube API Key (Để Tìm Kiếm Bài Hát)</span>
              </span>
              <span className="text-xs">{showYouTubeKeySettings ? '▲ Thu gọn' : '▼ Mở rộng'}</span>
            </button>

            {showYouTubeKeySettings && (
              <form onSubmit={handleSaveYouTubeApiKey} className="mt-3 p-4 rounded-2xl bg-white/95 dark:bg-zinc-800/95 border border-red-200 dark:border-zinc-700 space-y-3.5 text-xs shadow-xs">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 font-cute mb-1">
                    YouTube Data API v3 Key:
                  </label>
                  <input
                    type="text"
                    value={customYouTubeKeyInput}
                    onChange={(e) => setCustomYouTubeKeyInput(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-red-400"
                  />
                </div>

                <div className="p-3 rounded-xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200 space-y-1.5 font-cute leading-relaxed">
                  <div className="font-bold flex items-center gap-1 text-amber-800 dark:text-amber-300">
                    <span>🛠️ Cách lấy Key miễn phí (mất khoảng 2 phút):</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 pl-1">
                    <li>
                      Mở <strong>Google Cloud Console</strong> → cùng project bạn đã dùng để tạo Google OAuth Client ID ở trên.
                    </li>
                    <li>
                      Vào <strong>APIs & Services → Library</strong>, tìm <strong>"YouTube Data API v3"</strong> và bấm <strong>Enable</strong>.
                    </li>
                    <li>
                      Vào <strong>APIs & Services → Credentials</strong> → <strong>+ CREATE CREDENTIALS → API key</strong>.
                    </li>
                    <li>
                      (Khuyến nghị) Bấm vào Key vừa tạo → <strong>Application restrictions</strong> → chọn <strong>Websites</strong> → thêm tên miền web hiện tại của bạn để tránh bị người khác lấy trộm Key.
                    </li>
                    <li>
                      Dán Key vào ô bên trên rồi bấm <strong>Lưu Key</strong>.
                    </li>
                  </ol>
                  <div className="pt-1">
                    Gói miễn phí cho phép khoảng 100 lượt tìm kiếm/ngày — đủ dùng cho một cặp đôi. Key này chỉ dùng để tìm kiếm bài hát, không có quyền truy cập dữ liệu cá nhân nào khác.
                  </div>
                </div>

                <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-cute">
                    💡 Bạn cũng có thể thiết lập biến <code className="font-mono text-red-600">VITE_YOUTUBE_API_KEY</code> lúc build.
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleClearYouTubeApiKey}
                      className="px-3 py-1.5 text-[11px] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-xl transition cursor-pointer"
                    >
                      Xóa Key
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-[11px] shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isSavedYouTubeKey ? 'Đã Lưu!' : 'Lưu Key'}</span>
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>

          {/* Custom Google Drive Photos Folder Setting */}
          <div className="mt-3 pt-3 border-t border-blue-100/80 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setShowDriveFolderSettings(!showDriveFolderSettings)}
              className="text-[11px] text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 font-semibold font-cute flex items-center justify-between w-full p-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-zinc-800/60 transition cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <span>📁</span>
                <span>Đổi Đường Dẫn / Link Thư Mục Lưu Ảnh Google Drive (Tùy Chỉnh Thư Mục)</span>
              </span>
              <span className="text-xs">{showDriveFolderSettings ? '▲ Thu gọn' : '▼ Mở rộng'}</span>
            </button>

            {showDriveFolderSettings && (
              <form onSubmit={handleSavePhotosFolderSetting} className="mt-3 p-4 rounded-2xl bg-white/95 dark:bg-zinc-800/95 border border-indigo-200 dark:border-zinc-700 space-y-3.5 text-xs shadow-xs">
                {/* Active Folder Status */}
                <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/60 space-y-1.5">
                  <span className="text-[11px] font-bold text-indigo-900 dark:text-indigo-200 block font-cute">
                    📂 Thư mục ảnh hiện tại:
                  </span>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200 break-all">
                      {activePhotosFolder?.name || '📷 Album Ảnh & Kỷ Niệm (Mặc định trong LoveSync)'}
                    </div>
                    {activePhotosFolder?.url && (
                      <a
                        href={activePhotosFolder.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[10px] font-bold hover:bg-indigo-700 transition flex items-center gap-1 shrink-0"
                      >
                        <span>Mở Drive</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  {activePhotosFolder?.id && (
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
                      Folder ID: {activePhotosFolder.id}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 font-cute mb-1">
                    🔗 Dán đường link thư mục Google Drive mới hoặc Folder ID:
                  </label>
                  <input
                    type="text"
                    value={customPhotosFolderInput}
                    onChange={(e) => {
                      setCustomPhotosFolderInput(e.target.value);
                      setCustomFolderErrorNotice(null);
                      setCustomFolderSaveNotice(null);
                    }}
                    placeholder="https://drive.google.com/drive/folders/1aBcDeFgHiJkLmNoP... hoặc 1aBcDe..."
                    className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-400"
                  />
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 block">
                    💡 Bạn có thể dán toàn bộ đường link thư mục (URL trên trình duyệt khi mở thư mục Drive) hoặc dán Folder ID.
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 font-cute mb-1">
                    🏷️ Đặt tên hiển thị cho thư mục (tùy chọn):
                  </label>
                  <input
                    type="text"
                    value={customPhotosFolderName}
                    onChange={(e) => setCustomPhotosFolderName(e.target.value)}
                    placeholder="Ví dụ: Kho Ảnh Kỷ Niệm 2026"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-400 font-cute"
                  />
                </div>

                {customFolderErrorNotice && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{customFolderErrorNotice}</span>
                  </div>
                )}

                {customFolderSaveNotice && (
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{customFolderSaveNotice}</span>
                  </div>
                )}

                {/* Instructions */}
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200 space-y-1 font-cute">
                  <span className="font-bold block">💡 Hướng dẫn lấy link thư mục Google Drive:</span>
                  <ol className="list-decimal list-inside space-y-0.5 pl-1">
                    <li>Vào Google Drive trên web hoặc app.</li>
                    <li>Mở thư mục bạn muốn lưu ảnh ➔ Sao chép link trên thanh địa chỉ hoặc bấm Chia sẻ ➔ Sao chép liên kết.</li>
                    <li>Dán vào ô bên trên và bấm <strong>Kiểm Tra & Lưu Thư Mục</strong>.</li>
                  </ol>
                </div>

                <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleResetPhotosFolderSetting}
                    className="px-3 py-1.5 text-[11px] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-xl transition cursor-pointer"
                  >
                    Khôi phục mặc định
                  </button>
                  <button
                    type="submit"
                    disabled={isVerifyingDriveFolder}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isVerifyingDriveFolder ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Đang kiểm tra...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Kiểm Tra & Lưu Thư Mục</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* 2. ANNIVERSARY DATE SETTING */}
      <div className={`rounded-3xl ${currentTheme.cardBg} border ${currentTheme.borderSubtle} p-5 sm:p-7 shadow-md`}>
        <div className="flex items-center gap-2 mb-4">
          <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
          <h3 className="text-base sm:text-lg font-bold text-zinc-800 dark:text-zinc-100 font-cute">
            Ngày Bắt Đầu Yêu & Kỷ Niệm
          </h3>
        </div>

        <form onSubmit={handleSaveAnniversary} className="flex flex-col sm:flex-row items-end gap-3">
          <div className="flex-1 w-full">
            <DateInputVN
              label="Ngày hai bạn chính thức yêu nhau (Dùng để đếm ngày yêu thời gian thực):"
              value={startDateInput}
              onChange={(val) => setStartDateInput(val)}
              placeholder="dd/mm/yyyy"
              inputClassName="!px-4 !py-2.5 !rounded-2xl !bg-zinc-50 dark:!bg-zinc-800 font-bold"
            />
          </div>
          <button
            type="submit"
            className="w-full sm:w-auto px-6 py-2.5 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shadow-md shadow-rose-200 dark:shadow-none transition active:scale-95 cursor-pointer whitespace-nowrap mb-6"
          >
            Lưu Ngày Yêu 💖
          </button>
        </form>
      </div>

      {/* 3. THEME & APPEARANCE CUSTOMIZATION */}
      <div className={`rounded-3xl ${currentTheme.cardBg} border ${currentTheme.borderSubtle} p-5 sm:p-7 shadow-md`}>
        <div className="flex items-center gap-2 mb-4">
          <Palette className="w-5 h-5 text-rose-500" />
          <h3 className="text-base sm:text-lg font-bold text-zinc-800 dark:text-zinc-100 font-cute">
            Tùy Chỉnh Chủ Đề & Giao Diện
          </h3>
        </div>

        {/* Theme Palette Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
          {Object.values(THEMES).map((theme) => {
            const isSelected = settings.theme === theme.id;
            const isHighContrast = theme.id.startsWith('high_contrast');

            return (
              <button
                key={theme.id}
                onClick={() => {
                  soundService.playPop();
                  updateSettings({ theme: theme.id });
                }}
                className={`p-3.5 rounded-2xl border text-left transition relative overflow-hidden flex flex-col justify-between cursor-pointer ${
                  isSelected
                    ? 'border-rose-500 ring-2 ring-rose-400 bg-rose-50/60 dark:bg-rose-950/30 shadow-md'
                    : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/40 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xl">{theme.emoji}</span>
                  <div className="flex items-center gap-1">
                    {isHighContrast && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold">
                        Độ tương phản cao
                      </span>
                    )}
                    <span
                      className="w-5 h-5 rounded-full border-2 border-white shadow-xs"
                      style={{ backgroundColor: theme.primaryColor }}
                    />
                  </div>
                </div>
                <div>
                  <h4 className="font-bold text-xs sm:text-sm text-zinc-800 dark:text-zinc-100 font-cute">
                    {theme.name}
                  </h4>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-1 mt-0.5">
                    {theme.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Switches: Dark Mode, Sound Effects, Floating Particles */}
        <div className="space-y-3 pt-2 border-t border-zinc-200 dark:border-zinc-800">
          {/* Dark mode switch */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40">
            <div className="flex items-center gap-2.5">
              {settings.isDarkMode ? (
                <Moon className="w-5 h-5 text-indigo-400" />
              ) : (
                <Sun className="w-5 h-5 text-amber-500" />
              )}
              <div>
                <div className="text-xs sm:text-sm font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                  <span>Chế độ Tối (Dark Mode)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-semibold">
                    Độc lập hoàn toàn, không đồng bộ theo máy
                  </span>
                </div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Bật/tắt giao diện tối trực tiếp tại đây mà không bị ảnh hưởng bởi cài đặt sáng/tối của điện thoại
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                soundService.playPop();
                updateSettings({ isDarkMode: !settings.isDarkMode });
              }}
              className={`w-12 h-6 rounded-full transition relative p-0.5 cursor-pointer ${
                settings.isDarkMode ? 'bg-rose-500' : 'bg-zinc-300 dark:bg-zinc-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  settings.isDarkMode ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Sound Effects switch */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40">
            <div className="flex items-center gap-2.5">
              {settings.soundEnabled ? (
                <Volume2 className="w-5 h-5 text-rose-500" />
              ) : (
                <VolumeX className="w-5 h-5 text-zinc-400" />
              )}
              <div>
                <div className="text-xs sm:text-sm font-bold text-zinc-800 dark:text-zinc-100">
                  Âm thanh lãng mạn (Sound Effects)
                </div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Âm thanh nhịp tim, mở thư tình, tiếng chuông lật sách
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => soundService.playHeartbeat()}
                className="px-2.5 py-1 text-[11px] font-bold rounded-xl bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 cursor-pointer"
              >
                Thử tiếng 🎵
              </button>
              <button
                onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
                className={`w-12 h-6 rounded-full transition relative p-0.5 cursor-pointer ${
                  settings.soundEnabled ? 'bg-rose-500' : 'bg-zinc-300 dark:bg-zinc-700'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    settings.soundEnabled ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Floating Particles switch */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <div>
                <div className="text-xs sm:text-sm font-bold text-zinc-800 dark:text-zinc-100">
                  Hiệu ứng cánh hoa & trái tim bay (Floating Particles)
                </div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Cánh hoa anh đào và trái tim bay lượn nhẹ nhàng
                </div>
              </div>
            </div>
            <button
              onClick={() => updateSettings({ floatingParticles: !settings.floatingParticles })}
              className={`w-12 h-6 rounded-full transition relative p-0.5 cursor-pointer ${
                settings.floatingParticles ? 'bg-rose-500' : 'bg-zinc-300 dark:bg-zinc-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  settings.floatingParticles ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* 4. PROFILE CUSTOMIZATION */}
      <div className={`rounded-3xl ${currentTheme.cardBg} border ${currentTheme.borderSubtle} p-5 sm:p-7 shadow-md`}>
        <div className="flex items-center gap-2 mb-4">
          <User className="w-5 h-5 text-rose-500" />
          <h3 className="text-base sm:text-lg font-bold text-zinc-800 dark:text-zinc-100 font-cute">
            Hồ Sơ Của Bạn
          </h3>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img
                src={avatar || DEFAULT_AVATAR_ME}
                alt="Avatar"
                className="w-16 h-16 rounded-full object-cover ring-4 ring-rose-400/50"
              />
              <label className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-rose-500 text-white cursor-pointer hover:bg-rose-600 transition shadow-md">
                <Upload className="w-3.5 h-3.5" />
                <input type="file" accept="image/*" onChange={handleAvatarFile} className="hidden" />
              </label>
            </div>

            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                  Tên hiển thị
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-800 dark:text-zinc-100 border-0"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                  Biệt danh người yêu gọi
                </label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-800 dark:text-zinc-100 border-0"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                Dòng trạng thái yêu thương
              </label>
              <input
                type="text"
                value={statusText}
                onChange={(e) => setStatusText(e.target.value)}
                placeholder="Ví dụ: Đang nhớ người yêu..."
                className="w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-800 dark:text-zinc-100 border-0"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                Địa điểm / Emoji vị trí
              </label>
              <input
                type="text"
                value={locationEmoji}
                onChange={(e) => setLocationEmoji(e.target.value)}
                placeholder="Ví dụ: 📍 Hà Nội"
                className="w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-800 dark:text-zinc-100 border-0"
              />
            </div>
          </div>

          {/* Birthday Configuration */}
          <div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-zinc-800/40 border border-rose-100 dark:border-zinc-700/60 space-y-3">
            <div className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5 font-cute">
              <span>🎂</span>
              <span>Cập Nhật Ngày Sinh Nhật Của Bạn (Tự Động Tạo Sự Kiện Đếm Ngược)</span>
            </div>
            <div>
              <DateInputVN
                label="Ngày sinh của bạn:"
                value={birthday}
                onChange={(val) => setBirthday(val)}
                placeholder="dd/mm/yyyy"
                showZodiac={true}
                inputClassName="!bg-white dark:!bg-zinc-900"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            {isProfileSaved ? (
              <span className="text-xs font-bold text-emerald-500 flex items-center gap-1">
                <Check className="w-4 h-4" /> Đã lưu thông tin hồ sơ!
              </span>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPartnerModal(true)}
                className="px-4 py-2.5 rounded-2xl bg-rose-50 hover:bg-rose-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-rose-600 dark:text-rose-300 border border-rose-200/70 dark:border-zinc-700 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                <span>Xem Hồ Sơ Người Ấy</span>
              </button>

              <button
                type="submit"
                className="px-6 py-2.5 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shadow-md shadow-rose-200 dark:shadow-rose-950 transition active:scale-95 cursor-pointer"
              >
                Lưu Hồ Sơ 💖
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* 5. DIRECT PASSWORD CHANGE CARD (No Old Password Required) */}
      <div className={`rounded-3xl ${currentTheme.cardBg} border ${currentTheme.borderSubtle} p-5 sm:p-7 shadow-md`}>
        <div className="flex items-center gap-2 mb-3">
          <KeyRound className="w-5 h-5 text-rose-500" />
          <h3 className="text-base sm:text-lg font-bold text-zinc-800 dark:text-zinc-100 font-cute">
            Đổi Mật Khẩu Nhanh (Không Cần Mật Khẩu Cũ)
          </h3>
        </div>

        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4 font-cute">
          Bạn có thể thay đổi mật khẩu trực tiếp bất cứ lúc nào mà không cần nhớ lại mật khẩu cũ.
        </p>

        {pwdSuccessMsg && (
          <div className="mb-4 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-700 dark:text-emerald-300 font-cute flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{pwdSuccessMsg}</span>
          </div>
        )}

        {pwdErrorMsg && (
          <div className="mb-4 p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs font-bold text-red-600 dark:text-red-300 font-cute flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{pwdErrorMsg}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1 font-cute">
                Tên tài khoản *
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  required
                  placeholder="Nhập tên tài khoản..."
                  value={pwdUsername}
                  onChange={(e) => setPwdUsername(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1 font-cute">
                Mật khẩu mới (tối thiểu 4 ký tự) *
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="password"
                  required
                  placeholder="Mật khẩu mới..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1 font-cute">
                Xác nhận mật khẩu mới *
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="password"
                  required
                  placeholder="Nhập lại mật khẩu mới..."
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-400"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={pwdLoading}
              className="px-6 py-2.5 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shadow-md shadow-rose-200 dark:shadow-rose-950 transition active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{pwdLoading ? 'Đang đổi...' : 'Cập Nhật Mật Khẩu Ngay 🔑'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 5. BACKUP & RESTORE DATA */}
      <div className={`rounded-[32px] ${currentTheme.cardBg} border ${currentTheme.borderSubtle} p-6 sm:p-8 shadow-xl shadow-rose-100/30 dark:shadow-none`}>
        <div className="flex items-center gap-2 mb-3">
          <Download className="w-5 h-5 text-[#FF758F]" />
          <h3 className="text-base sm:text-lg font-serif italic font-bold text-[#333] dark:text-[#f4effa]">
            Sao Lưu & Khôi Phục Dữ Liệu Ngoại Tuyến
          </h3>
        </div>

        <p className="text-xs text-[#888] dark:text-zinc-400 mb-4 font-cute">
          Xuất toàn bộ nhật ký, ảnh kỷ niệm, thiệp viết tay và ngày kỷ niệm ra file JSON để lưu giữ an toàn trên máy tính hoặc điện thoại của bạn.
        </p>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleExport}
            className="px-5 py-2.5 rounded-full bg-[#FFF5F7] dark:bg-zinc-800 hover:bg-[#FFE4E9] border border-[#FFE4E9] text-[#FF758F] font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#FF758F]" />
            <span>Xuất Sao Lưu (JSON)</span>
          </button>

          <label className="px-5 py-2.5 rounded-full bg-white dark:bg-zinc-800 hover:bg-[#FFF5F7] border border-[#FFE4E9] text-zinc-700 dark:text-zinc-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition">
            <Upload className="w-4 h-4 text-emerald-500" />
            <span>Nhập File Sao Lưu</span>
            <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
          </label>

          {importStatus && (
            <span className="text-xs font-bold text-[#FF758F] animate-pulse">{importStatus}</span>
          )}
        </div>
      </div>

      {/* 6. DANGER ZONE & CLEAR ALL DATA */}
      <div className={`rounded-[32px] bg-red-50/40 dark:bg-red-950/20 border border-red-200/70 dark:border-red-900/50 p-6 sm:p-8 shadow-sm`}>
        <div className="flex items-center gap-2 mb-3">
          <Trash2 className="w-5 h-5 text-red-500" />
          <h3 className="text-base sm:text-lg font-serif italic font-bold text-red-700 dark:text-red-400">
            Quản Lý & Xóa Dữ Liệu Hệ Thống
          </h3>
        </div>

        <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-5 font-cute leading-relaxed">
          Nếu bạn gặp sự cố không đồng bộ giữa các thiết bị hoặc muốn bắt đầu lại hoàn toàn từ đầu, bạn có thể xóa bộ nhớ máy hoặc làm sạch toàn bộ dữ liệu trên hệ thống máy chủ.
        </p>

        {clearSuccessMsg && (
          <div className="mb-4 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-700 dark:text-emerald-300 font-cute flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{clearSuccessMsg}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setClearType('device');
              setShowClearModal(true);
            }}
            className="px-5 py-2.5 rounded-2xl bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer shadow-xs"
          >
            <LogOut className="w-4 h-4 text-zinc-500" />
            <span>Đăng Xuất & Xóa Bộ Nhớ Máy Này</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setClearType('all');
              setShowClearModal(true);
            }}
            className="px-5 py-2.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer shadow-md shadow-red-200 dark:shadow-none"
          >
            <Trash2 className="w-4 h-4" />
            <span>Xóa Toàn Bộ Dữ Liệu Web & Máy Chủ (Reset All)</span>
          </button>
        </div>
      </div>

      {/* Clear Confirmation Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/60 flex items-center justify-center text-red-500 mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100 font-cute">
                {clearType === 'all'
                  ? 'Xác Nhận Xóa Toàn Bộ Dữ Liệu Web & Máy Chủ?'
                  : 'Đăng Xuất & Xóa Bộ Nhớ Trên Máy Này?'}
              </h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-cute leading-relaxed">
                {clearType === 'all'
                  ? 'Hành động này sẽ xóa sạch tài khoản, phòng ghép đôi, nhật ký và ảnh trên máy chủ. Bạn có thể đăng ký tài khoản mới tinh sau khi xóa.'
                  : 'Dữ liệu lưu trữ cục bộ trên trình duyệt này sẽ được làm sạch. Dữ liệu tài khoản của bạn trên máy chủ vẫn còn nguyên.'}
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={isClearing}
                onClick={() => setShowClearModal(false)}
                className="flex-1 py-2.5 rounded-2xl border border-zinc-300 dark:border-zinc-700 font-bold text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer disabled:opacity-50"
              >
                Hủy Bỏ
              </button>

              <button
                type="button"
                disabled={isClearing}
                onClick={async () => {
                  try {
                    setIsClearing(true);
                    if (clearType === 'all') {
                      await clearAllSystemAndLocalData();
                      setClearSuccessMsg('Đã xóa toàn bộ dữ liệu máy chủ và làm mới ứng dụng thành công!');
                    } else {
                      await clearAllUserDataAndLogout();
                      setClearSuccessMsg('Đã đăng xuất và làm sạch bộ nhớ cục bộ.');
                    }
                    setShowClearModal(false);
                    setTimeout(() => {
                      window.location.reload();
                    }, 800);
                  } catch (err: any) {
                    alert('Lỗi: ' + (err.message || 'Không thể xóa dữ liệu.'));
                  } finally {
                    setIsClearing(false);
                  }
                }}
                className="flex-1 py-2.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition active:scale-95 cursor-pointer shadow-md disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isClearing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang Xóa...</span>
                  </>
                ) : (
                  <span>Đồng Ý Xóa</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Avatar Cropper */}
      <AvatarCropModal
        isOpen={cropModalOpen}
        imageSrc={rawImageForCrop}
        onClose={() => {
          setCropModalOpen(false);
          setRawImageForCrop(null);
        }}
        onCropComplete={handleCropComplete}
      />

      {/* Partner Profile Modal */}
      <PartnerProfileModal
        isOpen={showPartnerModal}
        onClose={() => setShowPartnerModal(false)}
      />
    </div>
  );
};
