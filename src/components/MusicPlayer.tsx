import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Music,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Repeat,
  Plus,
  Trash2,
  X,
  Upload,
  Link as LinkIcon,
  Disc3,
  ListMusic,
  Maximize2,
  Minimize2,
  Sparkles,
  Heart,
  Youtube,
  Search,
  GripVertical,
} from 'lucide-react';
import { useMusic, YOUTUBE_MUSIC_HUB, extractYouTubeId } from '../context/MusicContext';
import { soundService } from '../services/sound';

export const MusicPlayer: React.FC = () => {
  const {
    playlist,
    currentTrack,
    isPlaying,
    volume,
    progress,
    duration,
    isMuted,
    isLooping,
    isPlayerOpen,
    playTrack,
    togglePlay,
    nextTrack,
    prevTrack,
    seek,
    setVolumeLevel,
    toggleMute,
    toggleLoop,
    setIsPlayerOpen,
    addCustomTrack,
    addYouTubeTrack,
    removeTrack,
  } = useMusic();

  const [activeTab, setActiveTab] = useState<'search' | 'playlist' | 'youtube_hub' | 'add'>('search');

  // Minimized floating widget mode (Bubble mode for mobile/desktop to save screen space)
  const [isWidgetMinimized, setIsWidgetMinimized] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('lovesync_music_widget_minimized');
      if (saved !== null) return JSON.parse(saved);
      if (typeof window !== 'undefined' && window.innerWidth < 640) {
        return true;
      }
    } catch {}
    return false;
  });

  const toggleWidgetMinimized = (val?: boolean) => {
    soundService.playPop();
    setIsWidgetMinimized((prev) => {
      const next = typeof val === 'boolean' ? val : !prev;
      try {
        localStorage.setItem('lovesync_music_widget_minimized', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // YouTube live search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // YouTube search / URL input state
  const [ytInputUrl, setYtInputUrl] = useState('');
  const [ytInputTitle, setYtInputTitle] = useState('');
  const [ytInputArtist, setYtInputArtist] = useState('');
  const [ytSuccessToast, setYtSuccessToast] = useState(false);
  const [addedToastMsg, setAddedToastMsg] = useState<string | null>(null);

  // Add custom file/url state
  const [newTitle, setNewTitle] = useState('');
  const [newArtist, setNewArtist] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file');
  const [fileAudioUrl, setFileAudioUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  // Search YouTube API
  const handleSearchYouTube = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    soundService.playPop();
    setIsSearching(true);
    setSearchError(null);

    try {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(searchQuery.trim())}`);
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        setSearchResults(data.results);
      } else {
        setSearchResults([]);
        setSearchError('Không tìm thấy bài hát. Bạn thử từ khóa khác hoặc dán link nhé.');
      }
    } catch (err) {
      console.error('Search YouTube error:', err);
      setSearchError('Lỗi kết nối tìm kiếm. Vui lòng thử lại.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddSearchResult = (item: any, playImmediately = true) => {
    soundService.playSparkle();
    const ok = addYouTubeTrack(item.youtubeId, item.title, item.artist);
    if (ok) {
      setAddedToastMsg(`Đã thêm "${item.title}" vào danh sách! 💖`);
      setTimeout(() => setAddedToastMsg(null), 3000);
    }
  };

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Handle local audio file upload
  const handleAudioFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    soundService.playPop();
    const url = URL.createObjectURL(file);
    setFileAudioUrl(url);
    setFileName(file.name);
    if (!newTitle) {
      setNewTitle(file.name.replace(/\.[^/.]+$/, ''));
    }
    if (!newArtist) {
      setNewArtist('Nhạc của chúng mình 💖');
    }
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalUrl = uploadMode === 'file' ? fileAudioUrl : newUrl.trim();
    if (!finalUrl) {
      alert('Vui lòng chọn file nhạc hoặc dán liên kết âm thanh');
      return;
    }

    addCustomTrack({
      title: newTitle.trim() || 'Bài hát tình yêu',
      artist: newArtist.trim() || 'Cặp đôi',
      url: finalUrl,
      coverImage: 'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=200&auto=format&fit=crop&q=80',
    });

    setNewTitle('');
    setNewArtist('');
    setNewUrl('');
    setFileAudioUrl(null);
    setFileName(null);
    setActiveTab('playlist');
  };

  // Handle YouTube addition
  const handleAddYouTubeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ytInputUrl.trim()) return;

    const success = addYouTubeTrack(ytInputUrl.trim(), ytInputTitle.trim(), ytInputArtist.trim());
    if (success) {
      setYtInputUrl('');
      setYtInputTitle('');
      setYtInputArtist('');
      setYtSuccessToast(true);
      setTimeout(() => setYtSuccessToast(false), 3000);
      setActiveTab('playlist');
    } else {
      alert('Không tìm thấy Video ID hoặc liên kết YouTube / YouTube Music hợp lệ. Vui lòng kiểm tra lại đường link!');
    }
  };

  const currentIsYouTube = currentTrack?.source === 'youtube' || !!currentTrack?.youtubeId;

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. DRAGGABLE FLOATING MINI PLAYER WIDGET (MINIMIZE & EXPAND MODES)        */}
      {/* ========================================================================= */}
      <motion.div
        drag
        dragMomentum={false}
        dragElastic={0.12}
        whileDrag={{ scale: 1.05, cursor: 'grabbing', zIndex: 60 }}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="fixed bottom-20 right-3 sm:bottom-6 sm:right-6 z-40 touch-none select-none"
      >
        {isWidgetMinimized ? (
          /* ========================================================= */
          /* CHẾ ĐỘ THU NHỎ (COMPACT ĐĨA NHẠC MINI TRÒN TINH GỌN)     */
          /* ========================================================= */
          <div className="relative group flex items-center">
            <div className="relative flex items-center p-1 rounded-full bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md shadow-2xl border border-rose-200/90 dark:border-zinc-700/90 hover:border-rose-400 dark:hover:border-rose-500/50 transition-all">
              {/* Spinning Vinyl Mini Disc */}
              <button
                onClick={() => {
                  soundService.playPop();
                  setIsPlayerOpen(true);
                }}
                className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden shrink-0 shadow-lg group/disc cursor-pointer active:scale-95 transition-transform"
                title={`Đang phát: ${currentTrack?.title || 'LoveSync Music'} (Bấm để mở trình phát)`}
              >
                <motion.div
                  animate={{ rotate: isPlaying ? 360 : 0 }}
                  transition={{ repeat: Infinity, duration: 6, ease: 'linear' }}
                  className="w-full h-full rounded-full bg-zinc-950 flex items-center justify-center p-1.5 border-2 border-zinc-800 shadow-inner"
                >
                  {/* Vinyl grooves rings */}
                  <div className="absolute inset-2 rounded-full border border-zinc-800/80 pointer-events-none" />
                  <div className="absolute inset-3 rounded-full border border-zinc-800/60 pointer-events-none" />

                  {currentTrack?.coverImage ? (
                    <img
                      src={currentTrack.coverImage}
                      alt="cover"
                      className="w-full h-full rounded-full object-cover ring-1 ring-zinc-700"
                    />
                  ) : (
                    <Disc3 className="w-7 h-7 text-rose-400" />
                  )}

                  {/* Vinyl Center Hole */}
                  <div className="absolute w-3 h-3 rounded-full bg-zinc-900 border-2 border-zinc-950 shadow-xs" />
                </motion.div>

                {/* Center hover overlay */}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/disc:opacity-100 transition rounded-full">
                  <Maximize2 className="w-4 h-4 text-white drop-shadow-md" />
                </div>
              </button>
            </div>
          </div>
        ) : (
          /* ========================================================= */
          /* CHẾ ĐỘ THANH NỔI ĐẦY ĐỦ (EXPANDED FLOATING BAR)           */
          /* ========================================================= */
          <div className="flex items-center gap-1.5 p-2 rounded-full bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md shadow-2xl border border-rose-200/90 dark:border-zinc-700/90 hover:border-rose-400 dark:hover:border-rose-500/50 transition-all select-none">
            {/* Drag Grip Handle */}
            <div
              className="pl-1 pr-0.5 text-zinc-400 hover:text-rose-500 dark:text-zinc-500 dark:hover:text-rose-400 cursor-grab active:cursor-grabbing flex items-center justify-center"
              title="Nhấn giữ và kéo thả để di chuyển vị trí phát nhạc khắp màn hình"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </div>

            {/* Vinyl Disc / Thumbnail Album Art */}
            <button
              onClick={() => {
                soundService.playPop();
                setIsPlayerOpen(true);
              }}
              className="relative w-11 h-11 rounded-full overflow-hidden shrink-0 shadow-inner group cursor-pointer"
              title="Mở trình phát nhạc tình yêu"
            >
              {/* Spinning Vinyl Texture */}
              <motion.div
                animate={{ rotate: isPlaying ? 360 : 0 }}
                transition={{ repeat: Infinity, duration: 6, ease: 'linear' }}
                className="w-full h-full rounded-full bg-zinc-900 flex items-center justify-center p-1 border-2 border-zinc-800"
              >
                {currentTrack?.coverImage ? (
                  <img
                    src={currentTrack.coverImage}
                    alt="cover"
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <Disc3 className="w-6 h-6 text-rose-400" />
                )}
              </motion.div>

              <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition rounded-full">
                <Maximize2 className="w-4 h-4 text-white" />
              </div>
            </button>

            {/* Song Info & Controls */}
            <div className="flex flex-col pr-1 max-w-[170px] sm:max-w-[240px]">
              <button
                onClick={() => {
                  soundService.playPop();
                  setIsPlayerOpen(true);
                }}
                className="text-left group cursor-pointer"
              >
                <div className="flex items-center gap-1">
                  {currentIsYouTube && <Youtube className="w-3 h-3 text-red-500 shrink-0" />}
                  <p className="text-xs font-bold text-zinc-800 dark:text-zinc-100 truncate group-hover:text-rose-500 transition">
                    {currentTrack?.title || 'Chưa chọn bài hát'}
                  </p>
                </div>
                <p className="text-[10px] text-zinc-400 truncate">
                  {currentTrack?.artist || 'LoveSync Music'}
                </p>
              </button>

              {/* Quick Play/Pause & Next buttons & Volume */}
              <div className="flex items-center gap-0.5 mt-0.5">
                <button
                  onClick={prevTrack}
                  className="p-1 text-zinc-500 hover:text-rose-500 rounded-full transition cursor-pointer shrink-0"
                  title="Bài trước"
                >
                  <SkipBack className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={togglePlay}
                  className="p-1.5 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-xs hover:scale-105 transition active:scale-95 cursor-pointer shrink-0"
                  title={isPlaying ? 'Tạm dừng bài hát' : 'Phát nhạc'}
                >
                  {isPlaying ? (
                    <Pause className="w-3.5 h-3.5" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current translate-x-0.2" />
                  )}
                </button>
                <button
                  onClick={nextTrack}
                  className="p-1 text-zinc-500 hover:text-rose-500 rounded-full transition cursor-pointer shrink-0"
                  title="Bài tiếp theo"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                </button>

                <div className="w-px h-3 bg-zinc-200 dark:bg-zinc-700 mx-1 shrink-0"></div>

                <button
                  onClick={toggleMute}
                  className="p-1 text-zinc-500 hover:text-rose-500 rounded-full transition cursor-pointer shrink-0"
                  title={isMuted ? 'Bật âm thanh' : 'Tắt tiếng'}
                >
                  {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-500" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => setVolumeLevel(Number(e.target.value))}
                  className="w-10 sm:w-16 accent-rose-500 h-1 bg-zinc-200 dark:bg-zinc-700 rounded-lg cursor-pointer shrink-0"
                  title="Âm lượng"
                />

                <button
                  onClick={() => {
                    soundService.playPop();
                    setIsPlayerOpen(true);
                  }}
                  className="p-1 text-rose-500 hover:text-rose-600 rounded-full transition cursor-pointer shrink-0 ml-0.5"
                  title="Mở danh sách nhạc"
                >
                  <ListMusic className="w-3.5 h-3.5" />
                </button>

                {/* Minimize Button */}
                <button
                  onClick={() => toggleWidgetMinimized(true)}
                  className="p-1 text-zinc-400 hover:text-rose-500 rounded-full transition cursor-pointer shrink-0 ml-0.5"
                  title="Thu nhỏ đĩa nhạc gọn gàng"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Hidden/Active YouTube iframe player stream - persistent across pause/play */}
      {currentTrack?.youtubeId && (
        <div className="fixed -top-96 -left-96 w-10 h-10 opacity-0 pointer-events-none z-[-1] overflow-hidden">
          <iframe
            key={currentTrack.youtubeId}
            id="lovesync_yt_stream"
            width="200"
            height="200"
            src={`https://www.youtube-nocookie.com/embed/${currentTrack.youtubeId}?enablejsapi=1&version=3&autoplay=1&origin=${typeof window !== 'undefined' ? window.location.origin : ''}`}
            title="YouTube Player"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. EXPANDED FULL-SCREEN MUSIC MODAL WITH YOUTUBE MUSIC HUB                */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isPlayerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-[32px] shadow-2xl border border-rose-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-rose-100 dark:border-zinc-800 flex items-center justify-between bg-gradient-to-r from-rose-50 to-pink-50 dark:from-zinc-800/80 dark:to-zinc-900/80">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-2xl bg-rose-500 text-white shadow-md">
                    <Music className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="font-bold text-base text-zinc-800 dark:text-zinc-100 flex items-center gap-1.5 font-cute">
                      <span>Không Gian Âm Nhạc Tình Yêu 💖</span>
                      <Sparkles className="w-4 h-4 text-amber-500" />
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Tìm kiếm bài hát YouTube như trên trình duyệt & phát nhạc cùng người yêu
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      soundService.playPop();
                      toggleWidgetMinimized();
                    }}
                    className="p-2 rounded-full hover:bg-rose-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-rose-500 transition cursor-pointer"
                    title={isWidgetMinimized ? 'Chuyển thanh phát nổi sang dạng mở rộng' : 'Chuyển thanh phát nổi sang dạng đĩa mini thu nhỏ'}
                  >
                    {isWidgetMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => {
                      soundService.playPop();
                      setIsPlayerOpen(false);
                    }}
                    className="p-2 rounded-full hover:bg-rose-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-rose-500 transition cursor-pointer"
                    title="Đóng cửa sổ âm nhạc"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Toast Alerts */}
              {addedToastMsg && (
                <div className="mx-4 mt-3 p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  <span>{addedToastMsg}</span>
                </div>
              )}

              {/* Current Track Playback Banner (Active Player Stage) */}
              <div className="p-4 sm:p-5 bg-radial from-rose-50/70 to-transparent dark:from-zinc-800/40 flex flex-col sm:flex-row items-center gap-4 sm:gap-5 border-b border-rose-100 dark:border-zinc-800">
                {/* Large Album Art */}
                <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-3xl overflow-hidden shadow-xl border-4 border-white dark:border-zinc-700 shrink-0 bg-zinc-900 group">
                  {currentTrack?.coverImage ? (
                    <img
                      src={currentTrack.coverImage}
                      alt="Cover"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-rose-400 to-pink-500 text-white">
                      <Music className="w-10 h-10" />
                    </div>
                  )}

                  {/* Vinyl rotating indicator */}
                  {isPlaying && (
                    <div className="absolute top-2 right-2 p-1 rounded-full bg-rose-500 text-white shadow-md animate-pulse">
                      <Heart className="w-3.5 h-3.5 fill-current" />
                    </div>
                  )}
                </div>

                {/* Track Details & Main Controls */}
                <div className="flex-1 w-full space-y-2.5">
                  <div>
                    <div className="flex items-center gap-2">
                      {currentIsYouTube && (
                        <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 font-bold text-[10px] flex items-center gap-1">
                          <Youtube className="w-3 h-3" />
                          <span>YouTube Music</span>
                        </span>
                      )}
                      <h4 className="font-bold text-sm sm:text-base text-zinc-800 dark:text-zinc-100 truncate font-cute">
                        {currentTrack?.title || 'Chưa chọn bài hát'}
                      </h4>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                      {currentTrack?.artist || 'LoveSync Player'}
                    </p>
                  </div>

                  {/* Progress Bar (for non-YouTube tracks) */}
                  {!currentIsYouTube && (
                    <div className="space-y-1">
                      <div className="relative w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden cursor-pointer">
                        <div
                          className="h-full bg-gradient-to-r from-rose-500 to-pink-500 rounded-full"
                          style={{
                            width: `${duration ? (progress / duration) * 100 : 0}%`,
                          }}
                        />
                        <input
                          type="range"
                          min={0}
                          max={duration || 100}
                          value={progress}
                          onChange={(e) => seek(Number(e.target.value))}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-zinc-400 font-bold">
                        <span>{formatTime(progress)}</span>
                        <span>{formatTime(duration)}</span>
                      </div>
                    </div>
                  )}

                  {/* Player Action Buttons */}
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={toggleLoop}
                        className={`p-2 rounded-xl text-xs transition cursor-pointer ${
                          isLooping
                            ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-500 font-bold'
                            : 'text-zinc-400 hover:text-zinc-600'
                        }`}
                        title={isLooping ? 'Đang lặp lại bài hát' : 'Bật lặp lại'}
                      >
                        <Repeat className="w-4 h-4" />
                      </button>

                      <button
                        onClick={toggleMute}
                        className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 text-xs transition cursor-pointer"
                        title={isMuted ? 'Bật âm thanh' : 'Tắt tiếng'}
                      >
                        {isMuted ? <VolumeX className="w-4 h-4 text-rose-500" /> : <Volume2 className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />}
                      </button>

                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={isMuted ? 0 : volume}
                        onChange={(e) => setVolumeLevel(Number(e.target.value))}
                        className="w-16 sm:w-20 accent-rose-500 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={prevTrack}
                        className="p-2 rounded-full hover:bg-rose-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition cursor-pointer"
                        title="Bài trước"
                      >
                        <SkipBack className="w-5 h-5" />
                      </button>

                      <button
                        onClick={togglePlay}
                        className="p-3 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white shadow-lg shadow-rose-200 dark:shadow-none hover:scale-105 active:scale-95 transition cursor-pointer"
                        title={isPlaying ? 'Tạm dừng' : 'Phát'}
                      >
                        {isPlaying ? (
                          <Pause className="w-5 h-5" />
                        ) : (
                          <Play className="w-5 h-5 fill-current translate-x-0.5" />
                        )}
                      </button>

                      <button
                        onClick={nextTrack}
                        className="p-2 rounded-full hover:bg-rose-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition cursor-pointer"
                        title="Bài tiếp theo"
                      >
                        <SkipForward className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex border-b border-rose-100 dark:border-zinc-800 px-3 sm:px-6 bg-zinc-50/50 dark:bg-zinc-900/50 overflow-x-auto">
                <button
                  onClick={() => {
                    soundService.playPop();
                    setActiveTab('search');
                  }}
                  className={`py-3 px-3.5 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    activeTab === 'search'
                      ? 'border-red-500 text-red-600 dark:text-red-400'
                      : 'border-transparent text-zinc-500 hover:text-zinc-700'
                  }`}
                >
                  <Search className="w-4 h-4 text-red-500" />
                  <span>Tìm Kiếm YouTube 🔍</span>
                </button>

                <button
                  onClick={() => {
                    soundService.playPop();
                    setActiveTab('playlist');
                  }}
                  className={`py-3 px-3.5 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    activeTab === 'playlist'
                      ? 'border-rose-500 text-rose-600 dark:text-rose-400'
                      : 'border-transparent text-zinc-500 hover:text-zinc-700'
                  }`}
                >
                  <ListMusic className="w-4 h-4" />
                  <span>Danh Sách ({playlist.length})</span>
                </button>

                <button
                  onClick={() => {
                    soundService.playPop();
                    setActiveTab('youtube_hub');
                  }}
                  className={`py-3 px-3.5 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    activeTab === 'youtube_hub'
                      ? 'border-rose-500 text-rose-600 dark:text-rose-400'
                      : 'border-transparent text-zinc-500 hover:text-zinc-700'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Gợi Ý Cặp Đôi 💖</span>
                </button>

                <button
                  onClick={() => {
                    soundService.playPop();
                    setActiveTab('add');
                  }}
                  className={`py-3 px-3.5 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    activeTab === 'add'
                      ? 'border-rose-500 text-rose-600 dark:text-rose-400'
                      : 'border-transparent text-zinc-500 hover:text-zinc-700'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  <span>Tải Lên / Link</span>
                </button>
              </div>

              {/* Tab Contents */}
              <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
                {/* 0. LIVE YOUTUBE SEARCH TAB */}
                {activeTab === 'search' && (
                  <div className="space-y-4">
                    {/* Search bar */}
                    <form onSubmit={handleSearchYouTube} className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
                        <input
                          type="text"
                          placeholder="Tìm bất kỳ bài hát, ca sĩ trên YouTube (vd: Ngày đầu tiên, Hoàng Dũng, Vũ, Die with a smile...)"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-10 pr-24 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/90 border border-red-200/80 dark:border-zinc-700 text-xs sm:text-sm text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-400"
                        />
                        <button
                          type="submit"
                          disabled={isSearching}
                          className="absolute right-1.5 top-1.5 bottom-1.5 px-4 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white font-bold text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer disabled:opacity-50"
                        >
                          {isSearching ? (
                            <span>Đang tìm...</span>
                          ) : (
                            <>
                              <Search className="w-3.5 h-3.5" />
                              <span>Tìm Kiếm</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Quick Suggestions Chips */}
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        <span className="text-[11px] text-zinc-400 font-bold">Gợi ý tìm nhanh:</span>
                        {['Ngày Đầu Tiên Đức Phúc', 'Hoàng Dũng', 'Vũ Lạ Lùng', 'AMEE Tình Bạn Diệu Kỳ', 'Die With A Smile', 'Lofi Tình Yêu'].map((sug) => (
                          <button
                            key={sug}
                            type="button"
                            onClick={() => {
                              setSearchQuery(sug);
                              fetch(`/api/youtube/search?q=${encodeURIComponent(sug)}`)
                                .then(r => r.json())
                                .then(d => d.results && setSearchResults(d.results));
                            }}
                            className="px-2.5 py-1 rounded-full bg-rose-50 dark:bg-zinc-800 hover:bg-rose-100 text-[11px] text-rose-600 dark:text-rose-300 font-medium transition cursor-pointer"
                          >
                            {sug}
                          </button>
                        ))}
                      </div>
                    </form>

                    {searchError && (
                      <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-300 border border-amber-200 text-xs font-bold">
                        {searchError}
                      </div>
                    )}

                    {/* Search Results List */}
                    {searchResults.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 px-1 flex items-center justify-between">
                          <span>Kết quả tìm kiếm ({searchResults.length} bài):</span>
                          <span className="text-[11px] text-red-500">YouTube Music Live</span>
                        </div>

                        <div className="grid grid-cols-1 gap-2">
                          {searchResults.map((item) => (
                            <div
                              key={item.id}
                              className="p-3 rounded-2xl bg-white dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 flex items-center justify-between gap-3 hover:border-red-300 transition group shadow-xs"
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-black">
                                  {item.coverImage ? (
                                    <img
                                      src={item.coverImage}
                                      alt={item.title}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-rose-400">
                                      <Music className="w-5 h-5" />
                                    </div>
                                  )}
                                  {item.duration && (
                                    <span className="absolute bottom-1 right-1 px-1 py-0.5 rounded-md bg-black/80 text-white font-mono text-[9px]">
                                      {item.duration}
                                    </span>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h5 className="font-bold text-xs sm:text-sm text-zinc-800 dark:text-zinc-100 truncate font-cute">
                                    {item.title}
                                  </h5>
                                  <p className="text-xs text-zinc-400 truncate">{item.artist}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleAddSearchResult(item, true)}
                                  className="px-3 py-1.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-xs flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-xs"
                                  title="Phát ngay bài này"
                                >
                                  <Play className="w-3.5 h-3.5 fill-current" />
                                  <span>Phát Ngay</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAddSearchResult(item, false)}
                                  className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-700 hover:bg-rose-100 text-zinc-600 dark:text-zinc-200 text-xs transition cursor-pointer"
                                  title="Thêm vào danh sách nhạc"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {/* 1. PLAYLIST TAB */}
                {activeTab === 'playlist' && (
                  <div className="space-y-2">
                    {playlist.map((track, idx) => {
                      const isCurrent = currentTrack?.id === track.id;
                      const isYt = track.source === 'youtube' || !!track.youtubeId;

                      return (
                        <div
                          key={track.id}
                          className={`p-3 rounded-2xl border transition flex items-center justify-between gap-3 ${
                            isCurrent
                              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 shadow-xs'
                              : 'bg-white dark:bg-zinc-800/60 border-zinc-100 dark:border-zinc-800 hover:bg-rose-50/40'
                          }`}
                        >
                          <div
                            onClick={() => playTrack(track)}
                            className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                          >
                            <div className="relative w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-zinc-900">
                              {track.coverImage ? (
                                <img src={track.coverImage} alt="Cover" className="w-full h-full object-cover" />
                              ) : (
                                <Disc3 className="w-full h-full p-2 text-rose-400" />
                              )}
                              {isCurrent && isPlaying && (
                                <div className="absolute inset-0 bg-rose-500/60 flex items-center justify-center">
                                  <Music className="w-4 h-4 text-white animate-bounce" />
                                </div>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                {isYt && <Youtube className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                                <p
                                  className={`text-xs font-bold truncate ${
                                    isCurrent ? 'text-rose-600 dark:text-rose-300' : 'text-zinc-800 dark:text-zinc-200'
                                  }`}
                                >
                                  {track.title}
                                </p>
                              </div>
                              <p className="text-[11px] text-zinc-400 truncate">{track.artist}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => playTrack(track)}
                              className={`p-2 rounded-xl transition cursor-pointer ${
                                isCurrent && isPlaying
                                  ? 'bg-rose-500 text-white'
                                  : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-rose-100'
                              }`}
                              title={isCurrent && isPlaying ? 'Tạm dừng' : 'Phát bài này'}
                            >
                              {isCurrent && isPlaying ? (
                                <Pause className="w-3.5 h-3.5" />
                              ) : (
                                <Play className="w-3.5 h-3.5 fill-current" />
                              )}
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                soundService.playPop();
                                removeTrack(track.id);
                              }}
                              className="p-2 rounded-xl text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition cursor-pointer"
                              title="Xóa bài hát này khỏi danh sách phát"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 2. YOUTUBE MUSIC HUB TAB */}
                {activeTab === 'youtube_hub' && (
                  <div className="space-y-5">
                    {/* Add by YouTube link / ID */}
                    <form onSubmit={handleAddYouTubeSubmit} className="p-4 rounded-2xl bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 space-y-3">
                      <div className="flex items-center gap-2">
                        <Youtube className="w-5 h-5 text-red-500" />
                        <h4 className="font-bold text-xs text-zinc-800 dark:text-zinc-100">
                          Thêm Bài Hát Từ YouTube / YouTube Music
                        </h4>
                      </div>

                      <div className="space-y-2">
                        <div className="relative">
                          <input
                            type="text"
                            required
                            placeholder="Dán link YouTube (youtube.com/watch?v=... hoặc music.youtube.com/...)"
                            value={ytInputUrl}
                            onChange={(e) => setYtInputUrl(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-800 dark:text-zinc-100 focus:ring-2 focus:ring-red-400 placeholder:text-zinc-400 pr-20"
                          />
                          <button
                            type="submit"
                            className="absolute right-1.5 top-1.5 bottom-1.5 px-3 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold text-[11px] flex items-center gap-1 transition active:scale-95 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Thêm Ngay</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            placeholder="Tên bài hát (tùy chọn)..."
                            value={ytInputTitle}
                            onChange={(e) => setYtInputTitle(e.target.value)}
                            className="px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400"
                          />
                          <input
                            type="text"
                            placeholder="Ca sĩ / Kênh (tùy chọn)..."
                            value={ytInputArtist}
                            onChange={(e) => setYtInputArtist(e.target.value)}
                            className="px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400"
                          />
                        </div>
                      </div>
                    </form>

                    {/* Featured Curated YouTube Playlists */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-amber-500" />
                          <span>Tuyển Tập Lãng Mạn Chọn Lọc (YouTube Music):</span>
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {YOUTUBE_MUSIC_HUB.map((item) => (
                          <div
                            key={item.id}
                            className="p-3 rounded-2xl bg-white dark:bg-zinc-800 border border-rose-100 dark:border-zinc-700 shadow-xs flex items-center gap-3 hover:shadow-md transition"
                          >
                            {item.coverImage ? (
                              <img
                                src={item.coverImage}
                                alt={item.title}
                                className="w-14 h-14 rounded-xl object-cover shrink-0 shadow-xs"
                              />
                            ) : (
                              <div className="w-14 h-14 rounded-xl bg-zinc-800 flex items-center justify-center text-rose-400 shrink-0">
                                <Music className="w-6 h-6" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-zinc-800 dark:text-zinc-100 truncate">
                                {item.title}
                              </p>
                              <p className="text-[11px] text-zinc-400 truncate">{item.artist}</p>

                              <button
                                onClick={() => playTrack(item)}
                                className="mt-1 px-3 py-1 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold text-[10px] flex items-center gap-1 transition cursor-pointer"
                              >
                                <Play className="w-3 h-3 fill-current" />
                                <span>Phát Bài Này</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. ADD CUSTOM AUDIO TAB */}
                {activeTab === 'add' && (
                  <form onSubmit={handleAddSubmit} className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                      <button
                        type="button"
                        onClick={() => setUploadMode('file')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                          uploadMode === 'file'
                            ? 'bg-rose-500 text-white shadow-xs'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
                        }`}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Tải file MP3 / M4A từ máy</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setUploadMode('url')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                          uploadMode === 'url'
                            ? 'bg-rose-500 text-white shadow-xs'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
                        }`}
                      >
                        <LinkIcon className="w-3.5 h-3.5" />
                        <span>Dán link trực tiếp</span>
                      </button>
                    </div>

                    {uploadMode === 'file' ? (
                      <div className="space-y-2">
                        <label className="block p-6 rounded-2xl border-2 border-dashed border-rose-300 dark:border-zinc-700 bg-rose-50/50 dark:bg-zinc-800/40 text-center cursor-pointer hover:bg-rose-100/50 transition">
                          <Upload className="w-8 h-8 text-rose-500 mx-auto mb-2" />
                          <span className="text-xs font-bold text-zinc-700 dark:text-zinc-200 block">
                            {fileName ? `Đã chọn: ${fileName}` : 'Bấm để chọn file âm thanh (MP3, WAV, AAC, M4A)'}
                          </span>
                          <span className="text-[11px] text-zinc-400 mt-1 block">
                            File âm thanh được phát trực tiếp trên trình duyệt của bạn
                          </span>
                          <input
                            type="file"
                            accept="audio/*"
                            onChange={handleAudioFileUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                          Đường link file âm thanh (URL MP3):
                        </label>
                        <input
                          type="url"
                          placeholder="https://example.com/song.mp3"
                          value={newUrl}
                          onChange={(e) => setNewUrl(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-800 dark:text-zinc-100 focus:ring-2 focus:ring-rose-400 placeholder:text-zinc-400"
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Tên bài hát:</label>
                        <input
                          type="text"
                          required
                          placeholder="Ví dụ: Bài ca tình yêu đôi ta"
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-800 dark:text-zinc-100 focus:ring-2 focus:ring-rose-400 placeholder:text-zinc-400"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Nghệ sĩ / Ca sĩ:</label>
                        <input
                          type="text"
                          placeholder="Ví dụ: Chúng mình 💖"
                          value={newArtist}
                          onChange={(e) => setNewArtist(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-800 dark:text-zinc-100 focus:ring-2 focus:ring-rose-400 placeholder:text-zinc-400"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-bold text-xs sm:text-sm shadow-md shadow-rose-200 transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Thêm Vào Danh Sách Nhạc 💖</span>
                    </button>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
