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

// Only one direct-MP3 track is kept here — the other three previously hardcoded Pixabay CDN
// links have gone dead (404) since they were first added; Pixabay download links aren't stable
// long-term. The YouTube Music Hub tracks above are the reliable, actively-maintained default
// catalog — a broken default track was a real, concrete cause of "trình phát nhạc không hoạt
// động" for anyone whose player happened to land on one of them.
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

// Target element id that MusicPlayer.tsx always renders (hidden, off-screen) so the official
// YouTube IFrame Player API has a stable place to mount its player into on first use.
export const YT_PLAYER_TARGET_ID = 'lovesync_yt_player_target';

const YT_API_SCRIPT_ID = 'lovesync-youtube-iframe-api';

// Loads the official YouTube IFrame Player API script exactly once and resolves with the global
// `YT` namespace once it's ready. A bare `<iframe src=".../embed/...?enablejsapi=1">` driven by
// hand-rolled postMessage calls (the previous approach) never actually receives any events back
// and often silently ignores commands too — the embedded player only talks JSON postMessage once
// it's been initialized through this real API, which is also what makes onStateChange/onReady
// reliable instead of guesswork.
let ytApiPromise: Promise<any> | null = null;
function loadYouTubeIframeApi(): Promise<any> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if ((window as any).YT && (window as any).YT.Player) {
    return Promise.resolve((window as any).YT);
  }
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise((resolve) => {
    const prevCallback = (window as any).onYouTubeIframeAPIReady;
    (window as any).onYouTubeIframeAPIReady = () => {
      if (typeof prevCallback === 'function') prevCallback();
      resolve((window as any).YT);
    };
    if (!document.getElementById(YT_API_SCRIPT_ID)) {
      const tag = document.createElement('script');
      tag.id = YT_API_SCRIPT_ID;
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }
  });
  return ytApiPromise;
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

  // Which song is playing is still worth remembering per-account (cheap, a single id string) —
  // but the playlist itself has exactly one source of truth: the room's shared playlist below.
  // An older version also mirrored the *entire* playlist array onto each profile, which meant
  // every single Firestore write from either partner (not just music-related ones) kept
  // re-embedding that whole array via broadcastRoomChanges — wasted bandwidth/quota, and a second
  // copy of the data that could disagree with the room's actual shared list. Removed.
  useEffect(() => {
    if (updateMyProfile && currentTrack) {
      if (myProfile && myProfile.musicCurrentTrackId !== currentTrack.id) {
        updateMyProfile({ musicCurrentTrackId: currentTrack.id });
      }
    }
  }, [currentTrack?.id, myProfile?.musicCurrentTrackId, updateMyProfile]);

  // The couple's shared playlist lives in the room document (see coupleContext.roomPlaylist /
  // updateRoomPlaylist) — adding or removing a track here updates it for both accounts.
  const persistPlaylist = (updatedPlaylist: MusicTrack[]) => {
    try {
      localStorage.setItem(STORAGE_KEY_PLAYLIST, JSON.stringify(updatedPlaylist));
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

  // Mirrors of state that the one-time YT.Player event callbacks below need to read without
  // going stale (those callbacks are registered once, when the player is created).
  const volumeRef = useRef(volume);
  const isMutedRef = useRef(isMuted);
  const isLoopingRef = useRef(isLooping);
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { isLoopingRef.current = isLooping; }, [isLooping]);

  // Real YT.Player instance (created once) + whether it has fired onReady yet. Loading a video
  // before the player is ready queues it here instead of silently dropping the request.
  const ytPlayerRef = useRef<any>(null);
  const ytReadyRef = useRef(false);
  const pendingYtActionRef = useRef<{ videoId: string; autoplay: boolean } | null>(null);

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

  // Create the real YouTube IFrame Player once, targeting the hidden container MusicPlayer.tsx
  // always renders. A raw `<iframe enablejsapi=1>` driven by hand-written postMessage calls (the
  // previous approach) never actually receives events back and often ignores commands too — only
  // a player created through this real API reliably answers play/pause/seek and reports state.
  useEffect(() => {
    let cancelled = false;
    loadYouTubeIframeApi().then((YT) => {
      if (cancelled || !YT || ytPlayerRef.current) return;
      const target = document.getElementById(YT_PLAYER_TARGET_ID);
      if (!target) return;
      try {
        ytPlayerRef.current = new YT.Player(YT_PLAYER_TARGET_ID, {
          height: '1',
          width: '1',
          playerVars: { autoplay: 0, controls: 0, disablekb: 1, playsinline: 1, rel: 0 },
          events: {
            onReady: () => {
              ytReadyRef.current = true;
              try {
                const p = ytPlayerRef.current;
                p.setVolume(Math.round((isMutedRef.current ? 0 : volumeRef.current) * 100));
                if (isMutedRef.current) p.mute();
              } catch {}
              const pending = pendingYtActionRef.current;
              if (pending) {
                pendingYtActionRef.current = null;
                try {
                  if (pending.autoplay) ytPlayerRef.current.loadVideoById(pending.videoId);
                  else ytPlayerRef.current.cueVideoById(pending.videoId);
                } catch {}
              }
            },
            onStateChange: (e: any) => {
              const state = e?.data;
              if (state === 1 || state === 3) {
                setIsPlaying(true);
              } else if (state === 2) {
                setIsPlaying(false);
              } else if (state === 0) {
                if (isLoopingRef.current) {
                  try {
                    ytPlayerRef.current.seekTo(0, true);
                    ytPlayerRef.current.playVideo();
                  } catch {}
                } else {
                  setIsPlaying(false);
                  nextTrackRef.current();
                }
              }
            },
            onError: () => {
              // Video removed/private/region-blocked — skip forward instead of stalling silently.
              nextTrackRef.current();
            },
          },
        });
      } catch (err) {
        console.warn('YouTube player init error:', err);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Poll playback position for the current YouTube track — the IFrame API doesn't push time
  // updates on its own the way the native <audio> element's `timeupdate` event does.
  useEffect(() => {
    const isYouTube = currentTrack?.source === 'youtube' || !!currentTrack?.youtubeId;
    if (!isYouTube || !isPlaying) return;
    const interval = setInterval(() => {
      const p = ytPlayerRef.current;
      if (!p || typeof p.getCurrentTime !== 'function') return;
      try {
        const cur = p.getCurrentTime();
        const dur = p.getDuration();
        if (typeof cur === 'number' && !isNaN(cur)) setProgress(cur);
        if (typeof dur === 'number' && dur > 0) setDuration(dur);
      } catch {}
    }, 500);
    return () => clearInterval(interval);
  }, [currentTrack?.id, isPlaying]);

  useEffect(() => {
    if (!currentTrack) return;

    const isNewTrack = currentTrackIdRef.current !== currentTrack.id;
    currentTrackIdRef.current = currentTrack.id;

    const isYouTube = currentTrack.source === 'youtube' || !!currentTrack.youtubeId;

    if (isYouTube && currentTrack.youtubeId) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (isNewTrack) {
        setProgress(0);
        setDuration(0);
        if (ytReadyRef.current && ytPlayerRef.current) {
          try {
            if (isPlaying) ytPlayerRef.current.loadVideoById(currentTrack.youtubeId);
            else ytPlayerRef.current.cueVideoById(currentTrack.youtubeId);
          } catch {}
        } else {
          pendingYtActionRef.current = { videoId: currentTrack.youtubeId, autoplay: isPlaying };
        }
      } else if (isPlaying && ytReadyRef.current) {
        try {
          ytPlayerRef.current.playVideo();
        } catch {}
      }
    } else {
      if (ytReadyRef.current && ytPlayerRef.current) {
        try {
          ytPlayerRef.current.pauseVideo();
        } catch {}
      }
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
    if (ytReadyRef.current && ytPlayerRef.current) {
      try {
        ytPlayerRef.current.setVolume(Math.round(effectiveVolume * 100));
        if (isMuted) ytPlayerRef.current.mute();
        else ytPlayerRef.current.unMute();
      } catch {}
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
      }
      // YouTube playback is handled by the currentTrack-changed effect above — it knows whether
      // the player is ready yet (queuing the load otherwise) so there's no risk of a race here.
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

      if (isYouTube && ytReadyRef.current && ytPlayerRef.current) {
        try {
          ytPlayerRef.current.pauseVideo();
        } catch {}
      }
    } else {
      setIsPlaying(true);
      if (!isYouTube && audioRef.current) {
        audioRef.current.volume = isMuted ? 0 : volume;
        audioRef.current.play().catch((err) => {
          console.warn('Audio resume error:', err);
        });
      } else if (isYouTube) {
        if (ytReadyRef.current && ytPlayerRef.current) {
          try {
            ytPlayerRef.current.playVideo();
          } catch {}
        } else if (currentTrack.youtubeId) {
          pendingYtActionRef.current = { videoId: currentTrack.youtubeId, autoplay: true };
        }
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
    } else if (isYouTube && ytReadyRef.current && ytPlayerRef.current) {
      try {
        ytPlayerRef.current.seekTo(seconds, true);
        setProgress(seconds);
      } catch {}
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
    if (ytReadyRef.current && ytPlayerRef.current) {
      try {
        ytPlayerRef.current.setVolume(Math.round(clamped * 100));
      } catch {}
    }
  };

  const toggleMute = () => {
    soundService.playPop();
    setIsMuted((prev) => {
      const nextVal = !prev;
      if (audioRef.current) {
        audioRef.current.volume = nextVal ? 0 : volume;
      }
      if (ytReadyRef.current && ytPlayerRef.current) {
        try {
          if (nextVal) ytPlayerRef.current.mute();
          else ytPlayerRef.current.unMute();
        } catch {}
      }
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
