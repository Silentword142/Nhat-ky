import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  X,
  Lock,
  User,
  LogIn,
  UserPlus,
  LogOut,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Smartphone,
  Trash2,
  ArrowRight,
  Cloud,
  HardDrive,
  RefreshCw,
  FolderOpen,
} from 'lucide-react';
import { useCouple } from '../context/CoupleContext';
import { soundService } from '../services/sound';
import { DEFAULT_AVATAR_ME } from '../services/mockData';
import { DateInputVN } from './DateInputVN';
import {
  registerAccount,
  loginAccount,
  loginWithGoogle,
  changePasswordWithoutOld,
  getCurrentAuthUser,
  getStoredWebAccounts,
  saveStoredWebAccounts,
  StoredAccountRecord,
} from '../services/auth';
import {
  loadAccountsVaultFromDrive,
  saveAccountsVaultToDrive,
  loadCoupleDataFromDrive,
  saveCoupleDataToDrive,
  APP_FOLDER_NAME,
} from '../services/googleDrive';
import { googleSignIn, getAccessToken } from '../services/googleAuth';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const {
    myProfile,
    settings,
    updateMyProfile,
    updateSettings,
    setRoomCode,
    clearAllUserDataAndLogout,
    loginWithUserAccount,
    isGoogleDriveConnected,
    googleUser,
    connectGoogleDrive,
    saveToGoogleDriveNow,
    loadFromGoogleDriveNow,
    googleDriveFolderUrl,
    googleDriveLastSavedAt,
  } = useCouple();

  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'change_password'>('register');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDriveLoading, setIsDriveLoading] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState<Record<string, StoredAccountRecord>>({});

  // Reload saved web accounts & sync with Google Drive if available
  useEffect(() => {
    if (isOpen) {
      const stored = getStoredWebAccounts();
      setSavedAccounts(stored);
      setErrorMsg(null);
      setSuccessMsg(null);
      setIsLoading(false);

      // If Google Drive is already connected, auto-check and restore vault
      if (isGoogleDriveConnected) {
        getAccessToken().then((token) => {
          if (token) {
            loadAccountsVaultFromDrive(token).then((res) => {
              if (res.success && res.accounts && Object.keys(res.accounts).length > 0) {
                const merged = { ...getStoredWebAccounts(), ...res.accounts };
                saveStoredWebAccounts(merged);
                setSavedAccounts(merged);
              }
            }).catch(() => {});
          }
        });
      }
    }
  }, [isOpen, isGoogleDriveConnected]);

  if (!isOpen) return null;

  const currentAuth = getCurrentAuthUser();
  const isLoggedIn = !!currentAuth?.username || !!myProfile.email || (myProfile.authProvider && myProfile.authProvider !== 'guest');

  // Handle Google Drive First Login / Vault Restore
  const handleConnectGoogleDriveFirst = async () => {
    setIsDriveLoading(true);
    setErrorMsg(null);
    try {
      soundService.playPop();
      const res = await googleSignIn();
      if (!res || !res.accessToken) {
        setIsDriveLoading(false);
        return;
      }

      soundService.playSparkle();
      const token = res.accessToken;

      // 1. Fetch saved accounts from Google Drive vault
      const vaultRes = await loadAccountsVaultFromDrive(token);
      let localAccounts = getStoredWebAccounts();

      if (vaultRes.success && vaultRes.accounts && Object.keys(vaultRes.accounts).length > 0) {
        localAccounts = { ...localAccounts, ...vaultRes.accounts };
        saveStoredWebAccounts(localAccounts);
        setSavedAccounts(localAccounts);
        setSuccessMsg(`Đã kết nối Google Drive & tải về ${Object.keys(vaultRes.accounts).length} tài khoản! ☁️✨`);
      } else {
        // Backup local accounts to drive vault
        if (Object.keys(localAccounts).length > 0) {
          await saveAccountsVaultToDrive(token, localAccounts);
        }
        setSuccessMsg('Đã kết nối Google Drive thành công! Thư mục lưu trữ an toàn đã sẵn sàng ☁️💖');
      }

      // 2. Also try restoring room data from Google Drive
      try {
        await loadFromGoogleDriveNow();
      } catch {}

      setTimeout(() => {
        setIsDriveLoading(false);
        setSuccessMsg(null);
      }, 2000);
    } catch (err: any) {
      console.error('Google Drive Auth Error:', err);
      setIsDriveLoading(false);
      setErrorMsg(err.message || 'Không thể kết nối Google Drive.');
    }
  };

  // Handle Account Registration (Also saves to Google Drive)
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim().toLowerCase();
    if (!cleanUser) {
      setErrorMsg('Vui lòng nhập tên tài khoản.');
      return;
    }
    if (cleanUser.length < 2) {
      setErrorMsg('Tên tài khoản cần có ít nhất 2 ký tự.');
      return;
    }
    if (!password.trim() || password.length < 4) {
      setErrorMsg('Mật khẩu cần tối thiểu 4 ký tự.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      soundService.playPop();
      const user = await registerAccount(
        cleanUser,
        password,
        displayName.trim() || cleanUser,
        birthday,
        roomCodeInput.trim()
      );
      soundService.playSparkle();

      loginWithUserAccount(user);

      const allAccounts = getStoredWebAccounts();
      setSavedAccounts(allAccounts);

      // Auto backup accounts registry to Google Drive if connected
      const token = await getAccessToken();
      if (token) {
        saveAccountsVaultToDrive(token, allAccounts).catch(() => {});
        saveToGoogleDriveNow().catch(() => {});
      }

      setSuccessMsg('Đăng ký & lưu trữ dữ liệu tài khoản thành công! 💖✨');
      setTimeout(() => {
        setSuccessMsg(null);
        setIsLoading(false);
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error('Register error:', err);
      setIsLoading(false);
      setErrorMsg(err.message || 'Không thể tạo tài khoản. Vui lòng thử lại.');
    }
  };

  // Handle Account Login (With Google Drive synchronization)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim().toLowerCase();
    if (!cleanUser || !password.trim()) {
      setErrorMsg('Vui lòng nhập tên tài khoản và mật khẩu.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    try {
      soundService.playPop();
      const user = await loginAccount(cleanUser, password);
      soundService.playSparkle();

      loginWithUserAccount(user);

      const allAccounts = getStoredWebAccounts();
      setSavedAccounts(allAccounts);

      // Sync to Google Drive
      const token = await getAccessToken();
      if (token) {
        saveAccountsVaultToDrive(token, allAccounts).catch(() => {});
      }

      setSuccessMsg(`Đăng nhập thành công! Chào mừng ${user.displayName || user.username} 💖`);
      setTimeout(() => {
        setSuccessMsg(null);
        setIsLoading(false);
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error('Login error:', err);
      setIsLoading(false);
      setErrorMsg(err.message || 'Tên tài khoản hoặc mật khẩu không chính xác.');
    }
  };

  // Quick Google Sign In
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      soundService.playPop();
      const user = await loginWithGoogle(settings.roomCode);
      if (!user) {
        setIsLoading(false);
        return;
      }

      soundService.playSparkle();

      if (user.roomCode) {
        setRoomCode(user.roomCode);
      }

      updateMyProfile({
        name: user.displayName || myProfile.name,
        avatar: user.photoURL || myProfile.avatar,
        email: user.email || undefined,
        authProvider: 'google',
      });

      updateSettings({
        accountEmail: user.email || undefined,
        roomCode: user.roomCode || settings.roomCode,
      });

      setSuccessMsg('Đăng nhập Google thành công! 💖');
      setTimeout(() => {
        setSuccessMsg(null);
        setIsLoading(false);
        onClose();
      }, 1000);
    } catch (err: any) {
      setIsLoading(false);
      if (
        err?.code !== 'auth/popup-closed-by-user' &&
        err?.code !== 'auth/cancelled-popup-request' &&
        !err?.message?.includes('popup-closed-by-user')
      ) {
        console.warn('Google Auth notice:', err);
        setErrorMsg('Đăng nhập Google thất bại: ' + (err.message || ''));
      }
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    soundService.playPop();
    setIsLoading(true);
    try {
      await clearAllUserDataAndLogout();
      setSuccessMsg('Đã đăng xuất tài khoản.');
      setTimeout(() => {
        setSuccessMsg(null);
        setIsLoading(false);
        onClose();
      }, 800);
    } catch (err: any) {
      setIsLoading(false);
      setErrorMsg('Lỗi đăng xuất: ' + err.message);
    }
  };

  // Handle Direct Password Change (No Old Password Required)
  const handleChangePasswordDirectly = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim().toLowerCase();
    if (!cleanUser) {
      setErrorMsg('Vui lòng nhập tên tài khoản cần đổi mật khẩu.');
      return;
    }
    if (!password.trim() || password.length < 4) {
      setErrorMsg('Mật khẩu mới cần tối thiểu 4 ký tự.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Xác nhận mật khẩu mới không khớp.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      soundService.playPop();
      const res = await changePasswordWithoutOld(cleanUser, password);
      soundService.playSparkle();
      setSuccessMsg(res.message || 'Đã đổi mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới.');
      setPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setActiveTab('login');
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể đổi mật khẩu. Vui lòng kiểm tra lại tên tài khoản.');
    } finally {
      setIsLoading(false);
    }
  };

  // Quick Select Saved Account
  const handleSelectSavedAccount = (acc: StoredAccountRecord) => {
    soundService.playPop();
    setUsername(acc.username);
    setPassword('');
    setActiveTab('login');
    setErrorMsg(null);
  };

  // Delete a saved account from web browser & Google Drive
  const handleDeleteSavedAccount = async (e: React.MouseEvent, accUsername: string) => {
    e.stopPropagation();
    soundService.playPop();
    const updated = { ...savedAccounts };
    delete updated[accUsername];
    saveStoredWebAccounts(updated);
    setSavedAccounts(updated);

    const token = await getAccessToken();
    if (token) {
      saveAccountsVaultToDrive(token, updated).catch(() => {});
    }
  };

  const savedAccountList: StoredAccountRecord[] = Object.values(savedAccounts);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-[32px] p-5 sm:p-6 shadow-2xl border border-rose-200 dark:border-zinc-800 space-y-4 max-h-[92vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-rose-100 dark:border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 rounded-2xl bg-gradient-to-tr from-rose-500 to-pink-500 text-white shadow-md shadow-rose-200 dark:shadow-none">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100 font-cute">
                {isLoggedIn ? 'Tài Khoản Của Bạn 💖' : 'Đăng Nhập & Đồng Bộ Google Drive'}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Lưu trữ vĩnh viễn và đồng bộ toàn bộ dữ liệu tình yêu
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Google Drive Status Banner / Requirement Box */}
        <div className={`p-3.5 rounded-2xl border transition ${
          isGoogleDriveConnected
            ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60'
            : 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/60'
        }`}>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-xl ${isGoogleDriveConnected ? 'bg-emerald-500 text-white' : 'bg-blue-500 text-white'}`}>
                <Cloud className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-1.5">
                  <span>Google Drive Đám Mây</span>
                  {isGoogleDriveConnected ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 font-bold">
                      Đã kết nối ☁️
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-bold">
                      Khuyên dùng trước
                    </span>
                  )}
                </h4>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {isGoogleDriveConnected
                    ? `Đang lưu tự động tại thư mục "${APP_FOLDER_NAME}"`
                    : 'Đăng nhập Google Drive trước để tự động lấy lại toàn bộ tài khoản & kỷ niệm'}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-2">
            {!isGoogleDriveConnected ? (
              <button
                type="button"
                disabled={isDriveLoading}
                onClick={handleConnectGoogleDriveFirst}
                className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition cursor-pointer active:scale-98 disabled:opacity-50"
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>{isDriveLoading ? 'Đang kết nối & tải dữ liệu...' : 'Đăng Nhập Google Drive để lấy dữ liệu về'}</span>
              </button>
            ) : (
              <div className="w-full flex items-center justify-between gap-2 text-[11px]">
                <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                  {googleUser?.email ? `Tài khoản: ${googleUser.email}` : 'Đã sẵn sàng đồng bộ vĩnh viễn'}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    soundService.playPop();
                    setIsDriveLoading(true);
                    try {
                      await loadFromGoogleDriveNow();
                      setSuccessMsg('Đã làm mới dữ liệu từ Google Drive thành công! ☁️✨');
                      setTimeout(() => setSuccessMsg(null), 1500);
                    } catch {}
                    setIsDriveLoading(false);
                  }}
                  disabled={isDriveLoading}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isDriveLoading ? 'animate-spin' : ''}`} />
                  <span>Đồng bộ lại</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-300 text-xs font-bold flex items-center gap-2 border border-red-200 dark:border-red-900/50 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 border border-emerald-200 dark:border-emerald-900/50 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* 1. Logged In State View */}
        {isLoggedIn ? (
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-2xl bg-rose-50/70 dark:bg-zinc-800/80 border border-rose-200/60 dark:border-zinc-700 flex items-center gap-3">
              <img
                src={myProfile.avatar || DEFAULT_AVATAR_ME}
                alt="Avatar"
                className="w-14 h-14 rounded-full object-cover ring-2 ring-rose-400"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-100 truncate">
                    {myProfile.name || 'Người dùng'}
                  </h4>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300 text-[10px] font-bold">
                    Đã đăng nhập
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                  Tài khoản: <span className="font-bold font-mono text-zinc-700 dark:text-zinc-300">{currentAuth?.username || myProfile.email || 'Người dùng web'}</span>
                </p>
                <div className="text-[11px] font-mono font-bold text-rose-500 mt-1">
                  Mã phòng đôi: {settings.roomCode}
                </div>
              </div>
            </div>

            {/* Google Drive Status Link */}
            {googleDriveFolderUrl && (
              <a
                href={googleDriveFolderUrl}
                target="_blank"
                rel="noreferrer"
                className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/70 dark:border-zinc-700/60 text-xs flex items-center justify-between text-blue-600 dark:text-blue-400 hover:underline"
              >
                <span className="flex items-center gap-1.5">
                  <FolderOpen className="w-4 h-4" />
                  <span>Mở thư mục Google Drive của bạn:</span>
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            )}

            {/* Logout and Change Password buttons */}
            <div className="pt-2 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  soundService.playPop();
                  if (currentAuth?.username) {
                    setUsername(currentAuth.username);
                  }
                  setActiveTab('change_password');
                  setErrorMsg(null);
                }}
                className="px-4 py-2.5 rounded-2xl bg-rose-50 hover:bg-rose-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-rose-600 dark:text-rose-300 border border-rose-200/70 dark:border-zinc-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <KeyRound className="w-4 h-4" />
                <span>Đổi Mật Khẩu</span>
              </button>
              
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={handleLogout}
                  className="px-4 py-2.5 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 text-xs font-bold flex items-center gap-1.5 hover:bg-red-100 transition cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Đăng Xuất</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* 2. Login, Register & Change Password Forms */
          <div className="space-y-4">
            {/* Tabs */}
            <div className="grid grid-cols-3 p-1 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-xs font-bold gap-1">
              <button
                type="button"
                onClick={() => {
                  soundService.playPop();
                  setActiveTab('register');
                  setErrorMsg(null);
                }}
                className={`py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1 ${
                  activeTab === 'register'
                    ? 'bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span className="truncate">Tạo TK</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundService.playPop();
                  setActiveTab('login');
                  setErrorMsg(null);
                }}
                className={`py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1 ${
                  activeTab === 'login'
                    ? 'bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span className="truncate">Đăng Nhập</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundService.playPop();
                  setActiveTab('change_password');
                  setErrorMsg(null);
                }}
                className={`py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1 ${
                  activeTab === 'change_password'
                    ? 'bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span className="truncate">Đổi MK</span>
              </button>
            </div>

            {/* Quick Google Sign In */}
            <button
              type="button"
              disabled={isLoading}
              onClick={handleGoogleLogin}
              className="w-full py-2.5 px-4 rounded-2xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-bold flex items-center justify-center gap-2.5 transition shadow-xs cursor-pointer active:scale-98"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z"
                />
                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3 0-.8.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12 0 14.8s.7 5.1 1.9 7.5l3.7-2.9z"
                />
                <path
                  fill="#34A853"
                  d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16.5C3.7 20.2 7.5 23.5 12 23.5z"
                />
              </svg>
              <span>Đăng nhập nhanh với Google</span>
            </button>

            <div className="relative flex items-center justify-center">
              <div className="border-t border-zinc-200 dark:border-zinc-800 w-full" />
              <span className="bg-white dark:bg-zinc-900 px-3 text-[11px] text-zinc-400 font-bold uppercase">
                hoặc tài khoản mật khẩu
              </span>
            </div>

            {/* Saved Accounts on Web / Google Drive Quick Selector */}
            {savedAccountList.length > 0 && activeTab === 'login' && (
              <div className="p-3 rounded-2xl bg-rose-50/50 dark:bg-zinc-800/60 border border-rose-100 dark:border-zinc-700">
                <div className="text-[11px] font-bold text-zinc-600 dark:text-zinc-300 flex items-center gap-1.5 mb-2">
                  <Smartphone className="w-3.5 h-3.5 text-rose-500" />
                  <span>Tài khoản đã lấy về từ Google Drive / Web:</span>
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {savedAccountList.map((acc) => (
                    <div
                      key={acc.username}
                      onClick={() => handleSelectSavedAccount(acc)}
                      className="group flex items-center justify-between p-2 rounded-xl bg-white dark:bg-zinc-800 hover:bg-rose-100/50 dark:hover:bg-zinc-700 border border-zinc-200/70 dark:border-zinc-700 cursor-pointer transition"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-rose-500 text-white flex items-center justify-center font-bold text-xs">
                          {acc.displayName ? acc.displayName.charAt(0).toUpperCase() : acc.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{acc.displayName || acc.username}</p>
                          <p className="text-[10px] text-zinc-400 font-mono">@{acc.username}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-rose-500 font-bold flex items-center gap-0.5 group-hover:underline">
                          Chọn <ArrowRight className="w-3 h-3" />
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteSavedAccount(e, acc.username)}
                          title="Xóa khỏi danh sách lưu"
                          className="p-1 text-zinc-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* REGISTER FORM */}
            {activeTab === 'register' && (
              <form onSubmit={handleRegister} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Tên của bạn / Biệt danh (Tùy chọn)
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Ví dụ: Hoàng Long, Bé Miu..."
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Tên tài khoản (Tự chọn bất kỳ, không cần Gmail) *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: hoanglong142, mylove..."
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Mật khẩu (tối thiểu 4 ký tự) *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                      type="password"
                      required
                      placeholder="Nhập mật khẩu..."
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-400"
                    />
                  </div>
                </div>

                {/* User Birthday field */}
                <div>
                  <DateInputVN
                    label="🎂 Ngày sinh của bạn (Tùy chọn)"
                    value={birthday}
                    onChange={(val) => setBirthday(val)}
                    placeholder="dd/mm/yyyy"
                    showZodiac={true}
                    inputClassName="!rounded-2xl !bg-zinc-50 dark:!bg-zinc-800/80"
                  />
                </div>

                {/* Room Code */}
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Mã phòng đôi riêng biệt (Tự chọn hoặc để hệ thống tự tạo)
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Ví dụ: LOVE-9233 (hoặc để trống)..."
                      value={roomCodeInput}
                      onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                      className="w-full pl-10 pr-4 py-2 rounded-2xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-xs font-mono font-bold text-zinc-800 dark:text-zinc-100 focus:outline-none uppercase"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-bold text-xs sm:text-sm shadow-md shadow-rose-200 dark:shadow-rose-950 flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer disabled:opacity-50"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{isLoading ? 'Đang tạo tài khoản...' : 'Lập Tài Khoản & Lưu Google Drive 💖'}</span>
                </button>
              </form>
            )}

            {/* LOGIN FORM */}
            {activeTab === 'login' && (
              <form onSubmit={handleLogin} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Tên tài khoản *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                      type="text"
                      required
                      placeholder="Nhập tên tài khoản..."
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Mật khẩu *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                      type="password"
                      required
                      placeholder="Nhập mật khẩu..."
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-400"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-bold text-xs sm:text-sm shadow-md shadow-rose-200 dark:shadow-rose-950 flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer disabled:opacity-50"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{isLoading ? 'Đang đăng nhập...' : 'Đăng Nhập Vào Web 💖'}</span>
                </button>
              </form>
            )}

            {/* DIRECT CHANGE PASSWORD FORM (No Old Password Required) */}
            {activeTab === 'change_password' && (
              <form onSubmit={handleChangePasswordDirectly} className="space-y-3">
                <div className="p-3 rounded-2xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40 text-xs text-rose-700 dark:text-rose-300">
                  <p className="font-bold flex items-center gap-1.5 mb-0.5">
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Đổi Mật Khẩu Nhanh Trực Tiếp</span>
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Không cần nhập lại mật khẩu cũ. Chỉ cần nhập tên tài khoản và mật khẩu mới bạn muốn đặt.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Tên tài khoản cần đổi mật khẩu *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                      type="text"
                      required
                      placeholder="Nhập tên tài khoản của bạn..."
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Mật khẩu mới (tối thiểu 4 ký tự) *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                      type="password"
                      required
                      placeholder="Nhập mật khẩu mới..."
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Xác nhận lại mật khẩu mới *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                      type="password"
                      required
                      placeholder="Nhập lại mật khẩu mới..."
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-400"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-bold text-xs sm:text-sm shadow-md shadow-rose-200 dark:shadow-rose-950 flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer disabled:opacity-50"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>{isLoading ? 'Đang cập nhật...' : 'Cập Nhật Mật Khẩu Mới Ngay 🔑'}</span>
                </button>
              </form>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
};

