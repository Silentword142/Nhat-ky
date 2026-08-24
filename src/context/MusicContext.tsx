import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { MusicTrack } from '../types';
import { soundService } from '../services/sound';
import { CoupleContext } from './CoupleContext';

export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|music\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regExp);
  if (match && match[1]) return match[1];

  if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) {
    return url.trim();
  }
  return null;
}

export const YOUTUBE_MUSIC_HUB: MusicTrack[] = [
  {
    id: 'yt-1',
    title: 'Những Bản Tình Ca Lofi Chill Nhẹ Nhàng 💖',
    artist: 'V-Pop Lofi Chill',
    url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
    youtubeId: 'jfKfPfyJRdk',
    source: 'youtube',
    coverImage: 'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=300&auto=format&fit=crop&q=80',
    isCustom: false,
  },
  {
    id: 'yt-2',
    title: 'Dương Cầm Tình Yêu & Viết Nhật Ký 🎹',
    artist: 'Relaxing Romantic Piano',
    url: 'https://www.youtube.com/watch?v=4xDzrJKXOOY',
    youtubeId: '4xDzrJKXOOY',
    source: 'youtube',
    coverImage: 'https://images.unsplash.com/photo-1520523839898-50712825e3a7?w=300&auto=format&fit=crop&q=80',
    isCustom: false,
  },
  {
    id: 'yt-3',
    title: 'Acoustic Guitar Tình Yêu Ngọt Ngào 🎸',
    artist: 'Acoustic Love Songs',
    url: 'https://www.youtube.com/watch?v=WPni755-Krg',
    youtubeId: 'WPni755-Krg',
    source: 'youtube',
    coverImage: 'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=300&auto=format&fit=crop&q=80',
    isCustom: false,
  },
  {
    id: 'yt-4',
    title: 'Sweet Love Coffee Shop Chill ☕',
    artist: 'Bossa & Lofi Beats',
    url: 'https://www.youtube.com/watch?v=e3L1PIY1pN8',
    youtubeId: 'e3L1PIY1pN8',
    source: 'youtube',
    coverImage: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=300&auto=format&fit=crop&q=80',
    isCustom: false,
  },
  {
    id: 'yt-5',
    title: 'Giai Điệu Tình Yêu Bất Hủ Cặp Đôi 🌸',
    artist: 'Romantic Memories',
    url: 'https://www.youtube.com/watch?v=kJQP7kiw5Fk',
    youtubeId: 'kJQP7kiw5Fk',
    source: 'youtube',
    coverImage: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=300&auto=format&fit=crop&q=80',
    isCustom: false,
  },
];

export const DEFAULT_PLAYLIST: MusicTrack[] = [
  ...YOUTUBE_MUSIC_HUB,
  {
    id: 'track-1',
    title: 'Giai Điệu Tình Yêu (Romantic Lofi)',
    artist: 'LoveSync Acoustic',
    url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3',
    coverImage: 'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=200&auto=format&fit=crop&q=80',
    source: 'audio',
    isCustom: false,
  },
  {
    id: 'track-2',
    title: 'Khúc Dương Cầm Ngọt Ngào (Sweet Piano)',
    artist: 'Love Ballads',
    url: 'https://cdn.pixabay.com/download/audio/2022/10/14/audio_9939f77c30.mp3',
    coverImage: 'https://images.unsplash.com/photo-1520523839898-50712825e3a7?w=200&auto=format&fit=crop&q=80',
    source: 'audio',
    isCustom: false,
  },
  {
    id: 'track-3',
    title: 'Mưa Chiều & Cafe Hẹn Hò',
    artist: 'Cozy Moments',
    url: 'https://cdn.pixabay.com/download/audio/2022/11/06/audio_2c55e94b21.mp3',
    coverImage: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=200&auto=format&fit=crop&q=80',
    source: 'audio',
    isCustom: false,
  },
  {
    id: 'track-4',
    title: 'Hòa Âm Guitar Mộc Lãng Mạn',
    artist: 'Acoustic Soul',
    url: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8bbfbffc9.mp3',
    coverImage: 'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=200&auto=format&fit=crop&q=80',
    source: 'audio',
    isCustom: false,
  },
];

interface MusicContextType {
  playlist: MusicTrack[];
  currentTrack: MusicTrack | null;
  isPlaying: boolean;
  volume: number;
  progress: number;
  duration: number;
  isMuted: boolean;
  isLooping: boolean;
  isPlayerOpen: boolean;
  playTrack: (track: MusicTrack) => void;
  togglePlay: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  seek: (seconds: number) => void;
  setVolumeLevel: (volume: number) => void;
  toggleMute: () => void;
  toggleLoop: () => void;
  setIsPlayerOpen: (open: boolean) => void;
  addCustomTrack: (track: Omit<MusicTrack, 'id' | 'isCustom' | 'addedAt'>) => void;
  addYouTubeTrack: (urlOrId: string, title?: string, artist?: string) => boolean;
  removeTrack: (id: string) => void;
}

const MusicContext = createContext<MusicContextType | undefined>(undefined);

const STORAGE_KEY_PLAYLIST = 'lovesync_full_playlist_v3';

export function sendYouTubeIframeCommand(command: string, args: any[] = []) {
  try {
    const iframe = document.getElementById('lovesync_yt_stream') as HTMLIFrameElement | null;
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage(
        JSON.stringify({
          event: 'command',
          func: command,
          args: args,
        }),
        '*'
      );
      if (command === 'pauseVideo') {
        iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
      } else if (command === 'playVideo') {
        iframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
      }
    }
  } catch (e) {
    console.warn('YouTube postMessage error:', e);
  }
}

export const MusicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const coupleContext = useContext(CoupleContext);
  const myProfile = coupleContext?.myProfile;
  const updateMyProfile = coupleContext?.updateMyProfile;

  const [playlist, setPlaylist] = useState<MusicTrack[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PLAYLIST);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error loading custom playlist:', e);
    }
    return DEFAULT_PLAYLIST;
  });

  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0.7);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isPlayerOpen, setIsPlayerOpen] = useState<boolean>(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentTrackIdRef = useRef<string | null>(null);

  const currentTrack: MusicTrack | null = playlist[currentTrackIndex] || playlist[0] || null;

  const hasSyncedProfileRef = useRef(false);
  useEffect(() => {
    if (myProfile && !hasSyncedProfileRef.current) {
      if (myProfile.id && myProfile.authProvider !== 'guest') {
        let shouldUpdate = false;
        let newPlaylist = playlist;
        
        if (myProfile.musicPlaylist && Array.isArray(myProfile.musicPlaylist) && myProfile.musicPlaylist.length > 0) {
          newPlaylist = myProfile.musicPlaylist;
          shouldUpdate = true;
        }
        
        if (shouldUpdate) {
          setPlaylist(newPlaylist);
          try {
            localStorage.setItem(STORAGE_KEY_PLAYLIST, JSON.stringify(newPlaylist));
          } catch {}
        }

        if (myProfile.musicCurrentTrackId) {
          const idx = newPlaylist.findIndex((t: any) => t.id === myProfile.musicCurrentTrackId);
          if (idx !== -1 && idx !== currentTrackIndex) {
            setCurrentTrackIndex(idx);
          }
        }
        
        hasSyncedProfileRef.current = true;
      }
    }
  }, [myProfile, playlist, currentTrackIndex]);

  useEffect(() => {
    if (updateMyProfile && currentTrack) {
      if (myProfile && myProfile.musicCurrentTrackId !== currentTrack.id) {
        updateMyProfile({ musicCurrentTrackId: currentTrack.id });
      }
    }
  }, [currentTrack?.id, myProfile?.musicCurrentTrackId, updateMyProfile]);

  const persistPlaylist = (updatedPlaylist: MusicTrack[]) => {
    try {
      localStorage.setItem(STORAGE_KEY_PLAYLIST, JSON.stringify(updatedPlaylist));
      if (updateMyProfile) {
        updateMyProfile({ musicPlaylist: updatedPlaylist });
      }
      if (coupleContext?.updateRoomPlaylist) {
        coupleContext.updateRoomPlaylist(updatedPlaylist);
      }
    } catch (e) {
      console.error('Failed to save playlist:', e);
    }
  };

  // Sync incoming playlist from couple room / Google Drive restore
  useEffect(() => {
    if (coupleContext?.roomPlaylist && Array.isArray(coupleContext.roomPlaylist) && coupleContext.roomPlaylist.length > 0) {
      const currentIds = playlist.map((t) => t.id).join(',');
      const newIds = coupleContext.roomPlaylist.map((t) => t.id).join(',');
      if (currentIds !== newIds) {
        setPlaylist(coupleContext.roomPlaylist);
        try {
          localStorage.setItem(STORAGE_KEY_PLAYLIST, JSON.stringify(coupleContext.roomPlaylist));
        } catch {}
      }
    }
  }, [coupleContext?.roomPlaylist]);

  const nextTrack = useCallback(() => {
    if (playlist.length === 0) return;
    soundService.playPop();
    setCurrentTrackIndex((prev) => (prev + 1) % playlist.length);
    setIsPlaying(true);
  }, [playlist.length]);

  const nextTrackRef = useRef(nextTrack);
  useEffect(() => {
    nextTrackRef.current = nextTrack;
  }, [nextTrack]);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.volume = volume;
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      setProgress(audio.currentTime);
      if (!isNaN(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };

    const handleEnded = () => {
      if (isLooping) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        nextTrack();
      }
    };

    const handleLoadedMetadata = () => {
      if (!isNaN(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };

    const handleAudioPlay = () => {
      setIsPlaying(true);
    };

    const handleAudioPause = () => {
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('play', handleAudioPlay);
    audio.addEventListener('playing', handleAudioPlay);
    audio.addEventListener('pause', handleAudioPause);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('play', handleAudioPlay);
      audio.removeEventListener('playing', handleAudioPlay);
      audio.removeEventListener('pause', handleAudioPause);
    };
  }, []);

  // Listen for YouTube iframe playback state events to keep isPlaying 100% in sync
  useEffect(() => {
    const handleWindowMessage = (event: MessageEvent) => {
      try {
        let payload = event.data;
        if (typeof payload === 'string') {
          try {
            payload = JSON.parse(payload);
          } catch {}
        }
        if (payload && typeof payload === 'object') {
          // YT Player State: 1 = PLAYING, 2 = PAUSED, 0 = ENDED, 3 = BUFFERING
          if (payload.event === 'onStateChange' || payload.info !== undefined) {
            const pState = typeof payload.info === 'number' ? payload.info : payload.info?.playerState;
            if (pState === 1 || pState === 3) {
              setIsPlaying(true);
            } else if (pState === 2) {
              setIsPlaying(false);
            } else if (pState === 0) {
              setIsPlaying(false);
              nextTrack();
            }
          } else if (payload.event === 'infoDelivery' && payload.info) {
            if (payload.info.playerState === 1 || payload.info.playerState === 3) {
              setIsPlaying(true);
            } else if (payload.info.playerState === 2) {
              setIsPlaying(false);
            }
            if (typeof payload.info.currentTime === 'number') {
              setProgress(payload.info.currentTime);
            }
            if (typeof payload.info.duration === 'number' && payload.info.duration > 0) {
              setDuration(payload.info.duration);
            }
          }
        }
      } catch (e) {
        // Ignore parsing errors
      }
    };

    window.addEventListener('message', handleWindowMessage);
    return () => {
      window.removeEventListener('message', handleWindowMessage);
    };
  }, [nextTrack]);

  useEffect(() => {
    if (!currentTrack) return;

    const isNewTrack = currentTrackIdRef.current !== currentTrack.id;
    currentTrackIdRef.current = currentTrack.id;

    const isYouTube = currentTrack.source === 'youtube' || !!currentTrack.youtubeId;

    if (isYouTube) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (isNewTrack && isPlaying) {
        setTimeout(() => {
          sendYouTubeIframeCommand('playVideo');
          sendYouTubeIframeCommand('setVolume', [isMuted ? 0 : Math.round(volume * 100)]);
        }, 300);
      }
    } else {
      if (audioRef.current && currentTrack.url) {
        if (isNewTrack) {
          audioRef.current.src = currentTrack.url;
          audioRef.current.currentTime = 0;
          setProgress(0);
          audioRef.current.load();
        }

        audioRef.current.volume = isMuted ? 0 : volume;

        if (isPlaying) {
          audioRef.current.play().catch((err) => {
            console.log('Audio autoplay handled:', err);
          });
        }
      }
    }
  }, [currentTrackIndex, playlist]);

  useEffect(() => {
    const effectiveVolume = isMuted ? 0 : volume;
    if (audioRef.current) {
      audioRef.current.volume = effectiveVolume;
    }
    sendYouTubeIframeCommand('setVolume', [Math.round(effectiveVolume * 100)]);
    if (isMuted) {
      sendYouTubeIframeCommand('mute');
    } else {
      sendYouTubeIframeCommand('unMute');
    }
  }, [volume, isMuted]);

  const playTrack = (track: MusicTrack) => {
    const idx = playlist.findIndex((t) => t.id === track.id);
    if (idx !== -1) {
      if (currentTrack?.id === track.id) {
        togglePlay();
        return;
      }
      setCurrentTrackIndex(idx);
      setIsPlaying(true);

      const isYouTube = track.source === 'youtube' || !!track.youtubeId;

      if (!isYouTube && audioRef.current && track.url) {
        if (currentTrackIdRef.current !== track.id) {
          audioRef.current.src = track.url;
          audioRef.current.currentTime = 0;
        }
        audioRef.current.volume = isMuted ? 0 : volume;
        audioRef.current.play().catch(() => {});
      } else if (isYouTube) {
        setTimeout(() => {
          sendYouTubeIframeCommand('playVideo');
          sendYouTubeIframeCommand('setVolume', [isMuted ? 0 : Math.round(volume * 100)]);
        }, 200);
      }
    }
  };

  const togglePlay = () => {
    if (!currentTrack) return;
    soundService.playPop();

    const isYouTube = currentTrack.source === 'youtube' || !!currentTrack.youtubeId;

    if (isPlaying) {
      setIsPlaying(false);
      if (audioRef.current) {
        audioRef.current.pause();
      }
      try {
        const audios = document.querySelectorAll('audio');
        audios.forEach((a) => a.pause());
      } catch {}

      if (isYouTube) {
        sendYouTubeIframeCommand('pauseVideo');
      }
    } else {
      setIsPlaying(true);
      if (!isYouTube && audioRef.current) {
        audioRef.current.volume = isMuted ? 0 : volume;
        audioRef.current.play().catch((err) => {
          console.warn('Audio resume error:', err);
        });
      } else if (isYouTube) {
        sendYouTubeIframeCommand('playVideo');
        sendYouTubeIframeCommand('setVolume', [isMuted ? 0 : Math.round(volume * 100)]);
      }
    }
  };

  const prevTrack = () => {
    if (playlist.length === 0) return;
    soundService.playPop();
    setCurrentTrackIndex((prev) => (prev - 1 + playlist.length) % playlist.length);
    setIsPlaying(true);
  };

  const seek = (seconds: number) => {
    const isYouTube = currentTrack?.source === 'youtube' || !!currentTrack?.youtubeId;
    if (!isYouTube && audioRef.current) {
      audioRef.current.currentTime = seconds;
      setProgress(seconds);
    } else if (isYouTube) {
      sendYouTubeIframeCommand('seekTo', [seconds, true]);
      setProgress(seconds);
    }
  };

  const setVolumeLevel = (val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    setVolume(clamped);
    if (clamped > 0 && isMuted) {
      setIsMuted(false);
    }
    if (audioRef.current) {
      audioRef.current.volume = clamped;
    }
    sendYouTubeIframeCommand('setVolume', [Math.round(clamped * 100)]);
  };

  const toggleMute = () => {
    soundService.playPop();
    setIsMuted((prev) => {
      const nextVal = !prev;
      if (audioRef.current) {
        audioRef.current.volume = nextVal ? 0 : volume;
      }
      sendYouTubeIframeCommand(nextVal ? 'mute' : 'unMute');
      return nextVal;
    });
  };

  const toggleLoop = () => {
    soundService.playPop();
    setIsLooping((prev) => !prev);
  };

  const addCustomTrack = (trackData: Omit<MusicTrack, 'id' | 'isCustom' | 'addedAt'>) => {
    soundService.playSparkle();
    const ytId = extractYouTubeId(trackData.url);
    const newTrack: MusicTrack = {
      ...trackData,
      id: `custom_${Date.now()}`,
      isCustom: true,
      source: ytId ? 'youtube' : trackData.source || 'audio',
      youtubeId: ytId || trackData.youtubeId,
      addedAt: Date.now(),
    };
    const updated = [newTrack, ...playlist];
    setPlaylist(updated);
    persistPlaylist(updated);
    playTrack(newTrack);
  };

  const addYouTubeTrack = (urlOrId: string, title?: string, artist?: string): boolean => {
    const ytId = extractYouTubeId(urlOrId);
    if (!ytId) return false;
    soundService.playSparkle();
    const newTrack: MusicTrack = {
      id: `yt_${ytId}_${Date.now()}`,
      title: title?.trim() || `YouTube Music #${ytId.slice(0, 5)}`,
      artist: artist?.trim() || 'YouTube Music Hub',
      url: `https://www.youtube.com/watch?v=${ytId}`,
      source: 'youtube',
      youtubeId: ytId,
      coverImage: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
      isCustom: true,
      addedAt: Date.now(),
    };
    const updated = [newTrack, ...playlist];
    setPlaylist(updated);
    persistPlaylist(updated);
    playTrack(newTrack);
    return true;
  };

  const removeTrack = (id: string) => {
    soundService.playPop();
    const updated = playlist.filter((t) => t.id !== id);
    setPlaylist(updated);
    persistPlaylist(updated);
    if (currentTrack?.id === id) {
      setCurrentTrackIndex(0);
      if (isPlaying && audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  return (
    <MusicContext.Provider
      value={{
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
      }}
    >
      {children}
    </MusicContext.Provider>
  );
};

export const useMusic = (): MusicContextType => {
  const context = useContext(MusicContext);
  if (!context) {
    throw new Error('useMusic must be used within a MusicProvider');
  }
  return context;
};
