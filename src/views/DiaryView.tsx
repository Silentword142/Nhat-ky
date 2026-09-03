import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  Calendar as CalendarIcon,
  Trash2,
  Image as ImageIcon,
  MapPin,
  X,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Maximize2,
  Check,
  Edit3,
  Save,
  Clock,
  ArrowRight,
  Bell,
  AlertTriangle,
  User,
  FolderX,
  Droplet,
  Sparkles,
  Activity,
  Heart,
} from 'lucide-react';
import { useCouple } from '../context/CoupleContext';
import { DiaryEntry, DailyCycleLog, CycleSettings } from '../types';
import { THEMES } from '../utils/theme';
import { soundService } from '../services/sound';
import { ImageLightbox, LightboxImageItem } from '../components/ImageLightbox';
import { compressImageFile } from '../utils/image';
import { CycleTrackerModal } from '../components/CycleTrackerModal';
import { getDayCycleInfo } from '../utils/cycle';
import { formatDateVN } from '../utils/date';

const MOODS = [
  { emoji: '🥰', label: 'Hạnh phúc' },
  { emoji: '💖', label: 'Yêu thương' },
  { emoji: '🥺', label: 'Nhớ người yêu' },
  { emoji: '🥳', label: 'Vui vẻ' },
  { emoji: '☕', label: 'Hẹn hò cafe' },
  { emoji: '🎬', label: 'Xem phim' },
  { emoji: '✈️', label: 'Du lịch' },
  { emoji: '🍜', label: 'Ăn uống' },
  { emoji: '😴', label: 'Muốn ôm' },
  { emoji: '🌸', label: 'Bình yên' },
];

const WEATHERS = [
  { emoji: '☀️', label: 'Nắng ấm' },
  { emoji: '🌧️', label: 'Mưa lãng mạn' },
  { emoji: '⛅', label: 'Mát mẻ' },
  { emoji: '🌙', label: 'Đêm sao' },
  { emoji: '❄️', label: 'Se lạnh' },
  { emoji: '🌈', label: 'Cầu vồng' },
];

const QUICK_REACTIONS = ['❤️', '🥰', '🫂', '💋', '💌', '🌸'];

// Strict limit: 16 lines per single notebook page
const MAX_LINES_PER_PAGE = 16;
const CHARS_PER_LINE_ESTIMATE = 44;

export const DiaryView: React.FC = () => {
  const {
    diaries = [],
    myProfile,
    partnerProfile,
    settings,
    anniversaries = [],
    addDiary,
    updateDiary,
    deleteDiary,
    deleteAllDayDiaries,
    addDiaryReaction,
    updateSettings,
    sendHeartbeat,
  } = useCouple();

  const currentTheme = THEMES[settings?.theme] || THEMES.sakura;

  // Menstrual Cycle State & Modal
  const [isCycleModalOpen, setIsCycleModalOpen] = useState(false);

  const cycleSettings: CycleSettings = useMemo(
    () => settings.cycleSettings || { cycleLength: 28, periodDuration: 5, enabled: true },
    [settings.cycleSettings]
  );
  const cycleLogs: Record<string, DailyCycleLog> = useMemo(
    () => settings.cycleLogs || {},
    [settings.cycleLogs]
  );

  const handleSaveCycleLog = (date: string, log: DailyCycleLog) => {
    const updated = { ...cycleLogs, [date]: log };
    updateSettings({ cycleLogs: updated });
  };

  const handleSaveCycleSettings = (newSettings: CycleSettings) => {
    updateSettings({ cycleSettings: newSettings });
  };

  const handleSendPartnerCareAction = (actionText: string) => {
    sendHeartbeat('hug', actionText);
  };

  // Selected calendar date (YYYY-MM-DD)
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Cycle Info for Selected Date
  const selectedDayCycleInfo = useMemo(() => {
    return getDayCycleInfo(selectedDate, cycleSettings, cycleLogs);
  }, [selectedDate, cycleSettings, cycleLogs]);

  // Calendar month state
  const [currentCalDate, setCurrentCalDate] = useState<Date>(() => new Date());

  // Page index WITHIN the selected day
  const [dayPageIndex, setDayPageIndex] = useState<number>(0);
  const [pageTurnDirection, setPageTurnDirection] = useState<'next' | 'prev'>('next');
  const [pageMode, setPageMode] = useState<'view' | 'write'>('write');
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [isFlipping, setIsFlipping] = useState(false);
  const isTurningPageRef = useRef(false);

  // Editor State
  const [inlineTitle, setInlineTitle] = useState('');
  const [inlineContent, setInlineContent] = useState('');
  const [inlineTime, setInlineTime] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [inlineMood, setInlineMood] = useState(MOODS[0]);
  const [inlineWeather, setInlineWeather] = useState(WEATHERS[0]);
  const [inlineLocation, setInlineLocation] = useState('');
  const [inlinePhotos, setInlinePhotos] = useState<string[]>([]);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);

  // Delete notification banner state
  const [deleteToast, setDeleteToast] = useState<{ show: boolean; msg: string }>({
    show: false,
    msg: '',
  });

  // Delete single page confirmation modal state
  const [entryToDelete, setEntryToDelete] = useState<DiaryEntry | null>(null);

  // Delete entire day confirmation modal state
  const [isDeleteEntireDayModalOpen, setIsDeleteEntireDayModalOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Universal Lightbox Zoom state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<LightboxImageItem[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Format date display safely (DD/MM/YYYY)
  const formatDisplayDate = (dStr?: string) => {
    return formatDateVN(dStr);
  };

  // Filter all diary entries belonging to the SELECTED DATE ONLY
  const selectedDayEntries = useMemo(() => {
    if (!Array.isArray(diaries)) return [];
    return diaries
      .filter((d) => d && d.date === selectedDate)
      .sort((a, b) => {
        if (a?.pageNumber && b?.pageNumber) {
          return a.pageNumber - b.pageNumber;
        }
        return (a?.createdAt || 0) - (b?.createdAt || 0);
      });
  }, [diaries, selectedDate]);

  // Current page entry of the day
  const currentDayEntry: DiaryEntry | undefined = selectedDayEntries[dayPageIndex];

  // Whenever selectedDate changes, reset day page index & mode
  useEffect(() => {
    setDayPageIndex(0);
    if (selectedDayEntries.length > 0) {
      setPageMode('view');
      setEditingEntryId(null);
    } else {
      setPageMode('write');
      setEditingEntryId(null);
      setInlineTitle('');
      setInlineContent('');
      setInlinePhotos([]);
      setInlineLocation('');
    }
  }, [selectedDate, selectedDayEntries.length]);

  // Estimate visual lines taking into account wrapping & newlines
  const estimateVisualLines = (text?: string) => {
    if (!text || typeof text !== 'string') return 1;
    const paragraphs = text.split('\n');
    let totalLines = 0;
    for (const p of paragraphs) {
      if (p.length === 0) {
        totalLines += 1;
      } else {
        totalLines += Math.max(1, Math.ceil(p.length / CHARS_PER_LINE_ESTIMATE));
      }
    }
    return totalLines;
  };

  const currentLinesCount = useMemo(() => {
    return estimateVisualLines(inlineContent);
  }, [inlineContent]);

  const absoluteDiariesOrder = useMemo(() => {
    if (!Array.isArray(diaries)) return [];
    return diaries.slice().sort((a, b) => {
      const dateCmp = (a.date || '').localeCompare(b.date || '');
      if (dateCmp !== 0) return dateCmp;
      const timeCmp = (a.time || '').localeCompare(b.time || '');
      if (timeCmp !== 0) return timeCmp;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
  }, [diaries]);

  // Calendar Calculation
  const calendarDays = useMemo(() => {
    const year = currentCalDate.getFullYear();
    const month = currentCalDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      hasDiary: boolean;
      diaryCount: number;
      isAnniversary: boolean;
      anniversaryName?: string;
      isPeriod: boolean;
      isOvulation: boolean;
      isFertile: boolean;
      cycleDay: number;
    }> = [];

    for (let i = 0; i < firstDayIndex; i++) {
      days.push({
        dateStr: '',
        dayNumber: 0,
        isCurrentMonth: false,
        isToday: false,
        isSelected: false,
        hasDiary: false,
        diaryCount: 0,
        isAnniversary: false,
        isPeriod: false,
        isOvulation: false,
        isFertile: false,
        cycleDay: 0,
      });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const monthStr = String(month + 1).padStart(2, '0');
      const dayStr = String(day).padStart(2, '0');
      const dateStr = `${year}-${monthStr}-${dayStr}`;

      const diariesOnThisDay = Array.isArray(diaries) ? diaries.filter((d) => d && d.date === dateStr) : [];
      const isToday = dateStr === todayStr;
      const isSelected = dateStr === selectedDate;

      // Flo cycle calculation for day
      const dayCycle = getDayCycleInfo(dateStr, cycleSettings, cycleLogs);

      const matchingAnniv = Array.isArray(anniversaries)
        ? anniversaries.find((a) => {
            if (!a || !a.date || typeof a.date !== 'string') return false;
            const parts = a.date.split('-');
            if (parts.length < 3) return false;
            const [aY, aM, aD] = parts;
            if (a.repeatYearly) {
              return aM === monthStr && aD === dayStr;
            }
            return a.date === dateStr;
          })
        : undefined;

      days.push({
        dateStr,
        dayNumber: day,
        isCurrentMonth: true,
        isToday,
        isSelected,
        hasDiary: diariesOnThisDay.length > 0,
        diaryCount: diariesOnThisDay.length,
        isAnniversary: !!matchingAnniv,
        anniversaryName: matchingAnniv?.title,
        isPeriod: dayCycle.isPeriod,
        isOvulation: dayCycle.isOvulation,
        isFertile: dayCycle.isFertile,
        cycleDay: dayCycle.cycleDay,
      });
    }

    return days;
  }, [currentCalDate, diaries, anniversaries, selectedDate, todayStr, cycleSettings, cycleLogs]);

  // Page Turns WITHIN the Selected Day's Pages
  const handleTurnNextDayPage = () => {
    if (dayPageIndex < selectedDayEntries.length - 1 && !isFlipping) {
      soundService.playPaperOpen();
      setIsFlipping(true);
      setPageTurnDirection('next');
      setTimeout(() => {
        setDayPageIndex((prev) => Math.min(prev + 1, Math.max(0, selectedDayEntries.length - 1)));
        setPageMode('view');
        setEditingEntryId(null);
        setIsFlipping(false);
      }, 200);
    }
  };

  const handleTurnPrevDayPage = () => {
    if (dayPageIndex > 0 && !isFlipping) {
      soundService.playPaperOpen();
      setIsFlipping(true);
      setPageTurnDirection('prev');
      setTimeout(() => {
        setDayPageIndex((prev) => Math.max(0, prev - 1));
        setPageMode('view');
        setEditingEntryId(null);
        setIsFlipping(false);
      }, 200);
    }
  };

  // Add a new page to the CURRENT DAY manually
  const handleAddNewPageForThisDay = () => {
    soundService.playPaperOpen();
    setIsFlipping(true);
    setPageTurnDirection('next');
    setTimeout(() => {
      setPageMode('write');
      setEditingEntryId(null);
      setInlineTitle('');
      setInlineContent('');
      setInlinePhotos([]);
      setInlineLocation('');
      const d = new Date();
      setInlineTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
      setIsFlipping(false);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }, 180);
  };

  // Split text when it strictly exceeds page capacity (10 lines)
  const splitTextToPages = (text: string, maxLines = MAX_LINES_PER_PAGE) => {
    if (!text) return { currentText: '', overflowText: '', hasOverflow: false };
    const paragraphs = text.split('\n');
    const pageParagraphs: string[] = [];
    const overflowParagraphs: string[] = [];
    let linesAccum = 0;
    let isOverflowing = false;

    for (const p of paragraphs) {
      const pLines = p.length === 0 ? 1 : Math.max(1, Math.ceil(p.length / CHARS_PER_LINE_ESTIMATE));
      if (!isOverflowing && linesAccum + pLines <= maxLines) {
        pageParagraphs.push(p);
        linesAccum += pLines;
      } else if (!isOverflowing) {
        const remainingCapacity = maxLines - linesAccum;
        if (remainingCapacity > 0 && p.length > 0) {
          const cutIdx = remainingCapacity * CHARS_PER_LINE_ESTIMATE;
          pageParagraphs.push(p.slice(0, cutIdx));
          overflowParagraphs.push(p.slice(cutIdx));
        } else {
          overflowParagraphs.push(p);
        }
        isOverflowing = true;
      } else {
        overflowParagraphs.push(p);
      }
    }

    return {
      currentText: pageParagraphs.join('\n'),
      overflowText: overflowParagraphs.join('\n'),
      hasOverflow: isOverflowing && overflowParagraphs.join('\n').trim().length > 0,
    };
  };

  // Automatic page overflow handler when typing reaches 16 lines
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const lines = estimateVisualLines(val);

    // If lines strictly exceed MAX_LINES_PER_PAGE, automatically split and turn to the next page!
    if (lines > MAX_LINES_PER_PAGE && !isTurningPageRef.current) {
      isTurningPageRef.current = true;
      const { currentText, overflowText } = splitTextToPages(val, MAX_LINES_PER_PAGE);

      soundService.playPaperOpen();
      setIsFlipping(true);
      setPageTurnDirection('next');

      // Auto-save the filled page
      const newPageNum = selectedDayEntries.length + 1;
      addDiary({
        title: inlineTitle.trim() || `Tiêu đề`,
        content: currentText.trim(),
        date: selectedDate,
        time: inlineTime,
        mood: inlineMood.emoji,
        moodLabel: inlineMood.label,
        weather: inlineWeather.emoji,
        location: inlineLocation.trim() || undefined,
        photos: inlinePhotos,
        tags: ['Kỷ niệm'],
        pageNumber: newPageNum,
        isPrivate: false,
      });

      // Prepare next page with the remaining text
      setTimeout(() => {
        setInlineTitle(`Tiêu đề`);
        setInlineContent(overflowText);
        setInlinePhotos([]);
        setEditingEntryId(null);
        setPageMode('write');
        setIsFlipping(false);
        isTurningPageRef.current = false;
        setTimeout(() => textareaRef.current?.focus(), 100);
      }, 250);

      return;
    }

    setInlineContent(val);
  };

  // Keyboard handler: If user hits Enter on last line, turn page automatically!
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && currentLinesCount >= MAX_LINES_PER_PAGE && !isTurningPageRef.current) {
      isTurningPageRef.current = true;
      e.preventDefault();
      soundService.playPaperOpen();
      setIsFlipping(true);
      setPageTurnDirection('next');

      // Save current page
      const newPageNum = selectedDayEntries.length + 1;
      addDiary({
        title: inlineTitle.trim() || `Tiêu đề`,
        content: inlineContent.trim(),
        date: selectedDate,
        time: inlineTime,
        mood: inlineMood.emoji,
        moodLabel: inlineMood.label,
        weather: inlineWeather.emoji,
        location: inlineLocation.trim() || undefined,
        photos: inlinePhotos,
        tags: ['Kỷ niệm'],
        pageNumber: newPageNum,
        isPrivate: false,
      });

      // Advance to next page
      setTimeout(() => {
        setInlineTitle(`Tiêu đề`);
        setInlineContent('');
        setInlinePhotos([]);
        setEditingEntryId(null);
        setPageMode('write');
        setIsFlipping(false);
        isTurningPageRef.current = false;
        setTimeout(() => textareaRef.current?.focus(), 100);
      }, 250);
    }
  };

  // Start editing existing page
  const handleStartEditPage = (entry: DiaryEntry) => {
    if (!entry) return;
    soundService.playPop();
    setPageMode('write');
    setEditingEntryId(entry.id);
    setInlineTitle(entry.title || '');
    setInlineContent(entry.content || '');
    setInlineTime(entry.time || '12:00');
    setInlineLocation(entry.location || '');
    setInlinePhotos(entry.photos || []);
    const foundMood = MOODS.find((m) => m.emoji === entry.mood) || MOODS[0];
    setInlineMood(foundMood);
    const foundWeather = WEATHERS.find((w) => w.emoji === entry.weather) || WEATHERS[0];
    setInlineWeather(foundWeather);
  };

  // Photo upload with fast compression
  const handleMultiplePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    soundService.playPop();
    Array.from(files).forEach(async (file: File) => {
      try {
        const compressedUrl = await compressImageFile(file, 800, 800, 0.75);
        setInlinePhotos((prev) => [...prev, compressedUrl]);
      } catch (err) {
        console.error('Error compressing diary photo:', err);
      }
    });
    e.target.value = '';
  };

  const handleRemovePhoto = (index: number) => {
    soundService.playPop();
    setInlinePhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // Save Diary Page
  const handleSavePage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlineContent.trim()) {
      alert('Vui lòng nhập nội dung trang nhật ký');
      return;
    }

    soundService.playSparkle();

    if (editingEntryId) {
      updateDiary(editingEntryId, {
        title: inlineTitle.trim() || `Tiêu đề`,
        content: inlineContent.trim(),
        date: selectedDate,
        time: inlineTime,
        mood: inlineMood.emoji,
        moodLabel: inlineMood.label,
        weather: inlineWeather.emoji,
        location: inlineLocation.trim() || undefined,
        photos: inlinePhotos,
        tags: ['Kỷ niệm'],
        isPrivate: false,
      });
      setEditingEntryId(null);
      setPageMode('view');
    } else {
      const newPageNum = selectedDayEntries.length + 1;
      addDiary({
        title: inlineTitle.trim() || `Tiêu đề`,
        content: inlineContent.trim(),
        date: selectedDate,
        time: inlineTime,
        mood: inlineMood.emoji,
        moodLabel: inlineMood.label,
        weather: inlineWeather.emoji,
        location: inlineLocation.trim() || undefined,
        photos: inlinePhotos,
        tags: ['Kỷ niệm'],
        pageNumber: newPageNum,
        isPrivate: false,
      });
      setDayPageIndex(selectedDayEntries.length);
      setPageMode('view');
    }

    setSaveSuccessMsg(true);
    setTimeout(() => setSaveSuccessMsg(false), 3000);
  };

  // Confirm and delete a SINGLE diary page with notification broadcast to both partners
  const handleConfirmDeleteSinglePage = () => {
    if (!entryToDelete) return;

    soundService.playPop();
    const titleToDelete = entryToDelete.title || 'Trang nhật ký';
    const dateFormatted = formatDisplayDate(entryToDelete.date);

    deleteDiary(entryToDelete.id);

    // Show persistent toast banner for both partners
    const partnerName = partnerProfile?.name || 'Người thương';
    const msg = `🔔 ${myProfile?.name || 'Bạn'} đã xóa trang "${titleToDelete}" ngày ${dateFormatted}. Thông báo đã được gửi đồng bộ cho cả bạn và ${partnerName}!`;
    setDeleteToast({ show: true, msg });
    setTimeout(() => setDeleteToast({ show: false, msg: '' }), 5000);

    setEntryToDelete(null);

    // Adjust page index smoothly
    if (dayPageIndex > 0) {
      setDayPageIndex((prev) => prev - 1);
    }
  };

  // Confirm and delete ALL diary pages of the selected day with notification broadcast
  const handleConfirmDeleteEntireDay = () => {
    if (selectedDayEntries.length === 0) return;

    soundService.playPop();
    const count = selectedDayEntries.length;
    const dateFormatted = formatDisplayDate(selectedDate);

    // Delete all entries of the day in a single synchronized call
    deleteAllDayDiaries(selectedDate);

    const partnerName = partnerProfile?.name || 'Người thương';
    const msg = `🔔 ${myProfile?.name || 'Bạn'} đã xóa toàn bộ ${count} trang nhật ký ngày ${dateFormatted}. Thông báo đã được gửi đồng bộ cho cả bạn và ${partnerName}!`;
    setDeleteToast({ show: true, msg });
    setTimeout(() => setDeleteToast({ show: false, msg: '' }), 5000);

    setIsDeleteEntireDayModalOpen(false);
    setDayPageIndex(0);
    setPageMode('write');
    setEditingEntryId(null);
    setInlineTitle('Trang 1');
    setInlineContent('');
    setInlinePhotos([]);
    setInlineLocation('');
  };

  // Lightbox Zoom
  const handleOpenPhotoZoom = (photoList: string[], startIndex: number, entry: DiaryEntry) => {
    if (!Array.isArray(photoList) || photoList.length === 0 || !entry) return;
    soundService.playPop();
    setLightboxImages(
      photoList.map((url, i) => ({
        url,
        title: entry.title || 'Kỷ niệm',
        date: entry.date,
        caption: `Ảnh ${i + 1} - ${entry.title || 'Kỷ niệm'}`,
        authorName: entry.authorName,
      }))
    );
    setLightboxIndex(startIndex);
    setLightboxOpen(true);
  };

  // Total pages of current day
  const displayTotalPages = absoluteDiariesOrder.length + (pageMode === 'write' && !editingEntryId ? 1 : 0);
  const currentPageNumber = useMemo(() => {
    if (pageMode === 'write') {
      if (editingEntryId) {
        return absoluteDiariesOrder.findIndex(d => d.id === editingEntryId) + 1;
      }
      return absoluteDiariesOrder.length + 1;
    }
    if (currentDayEntry) {
      return absoluteDiariesOrder.findIndex(d => d.id === currentDayEntry.id) + 1;
    }
    return absoluteDiariesOrder.length + 1;
  }, [absoluteDiariesOrder, pageMode, editingEntryId, currentDayEntry]);

  return (
    <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 pb-28 sm:pb-16 select-none">
      {/* Delete Notification Sync Toast Banner (Sent to Both Partners) */}
      <AnimatePresence>
        {deleteToast.show && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 max-w-lg w-[92%] p-4 rounded-3xl bg-zinc-900/95 text-white shadow-2xl border border-rose-500/50 backdrop-blur-md flex items-center justify-between gap-3 font-cute"
          >
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-2xl bg-red-500/20 text-red-400">
                <Bell className="w-5 h-5 animate-pulse" />
              </span>
              <p className="text-xs sm:text-sm font-medium leading-snug">{deleteToast.msg}</p>
            </div>
            <button
              onClick={() => setDeleteToast({ show: false, msg: '' })}
              className="p-1 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* TOP HEADER */}
      {/* ========================================================================= */}
      <div
        className={`p-5 rounded-[32px] ${currentTheme.cardBg} border ${currentTheme.borderSubtle} shadow-xl shadow-rose-100/30 dark:shadow-none mb-6 flex flex-col md:flex-row items-center justify-between gap-4`}
      >
        <div>
          <h2 className="font-serif italic text-xl sm:text-2xl text-[#333] dark:text-[#f4effa] flex items-center gap-2 flex-wrap">
            <span>Cuốn Sổ Nhật Ký Tình Yêu</span>
            <span className="text-xs font-sans not-italic font-bold px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300">
              Ngày {formatDisplayDate(selectedDate)}
            </span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 font-cute">
            Mỗi ngày là một tập trang riêng biệt, ghi lại những kỷ niệm ngọt ngào nhất
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end flex-wrap">
          {/* Delete entire day button (visible when day has diary entries) */}
          {selectedDayEntries.length > 0 && (
            <button
              onClick={() => {
                soundService.playPop();
                setIsDeleteEntireDayModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-full bg-red-50 dark:bg-red-950/40 hover:bg-red-100 text-red-600 dark:text-red-300 font-bold text-xs sm:text-sm border border-red-200 dark:border-red-800 transition active:scale-95 cursor-pointer flex items-center gap-1.5"
              title="Xóa toàn bộ các trang nhật ký của ngày này"
            >
              <Trash2 className="w-4 h-4 text-red-500" />
              <span>Xóa toàn bộ tập ngày này ({selectedDayEntries.length} trang)</span>
            </button>
          )}

          <button
            onClick={handleAddNewPageForThisDay}
            className="w-full md:w-auto px-6 py-2.5 rounded-full bg-gradient-to-r from-[#FF758F] to-[#FF9A9E] hover:from-[#ff607e] hover:to-[#ff8d92] text-white font-bold text-xs sm:text-sm shadow-md shadow-rose-200 dark:shadow-rose-950 flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3px]" />
            <span>Thêm Trang Mới Cho Ngày Này ✍️</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MAIN LAYOUT: CALENDAR (4 COLS) + SINGLE 3D NOTEBOOK SPREAD (8 COLS)      */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================================= */}
        {/* 1. LOVE CALENDAR & FLO CYCLE TRACKER (4 COLS)                             */}
        {/* ========================================================================= */}
        <div className="lg:col-span-4 space-y-4">
          {/* FLO CYCLE QUICK GLANCE WIDGET */}
          <div className="bg-gradient-to-br from-rose-500/10 via-pink-500/5 to-purple-500/10 dark:from-rose-950/40 dark:via-zinc-900 dark:to-purple-950/30 rounded-3xl p-4.5 border border-rose-200/80 dark:border-zinc-800 shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-2xl bg-gradient-to-tr from-rose-500 to-pink-500 text-white flex items-center justify-center shadow-xs">
                  <Droplet className="w-4 h-4 fill-current" />
                </div>
                <div>
                  <h4 className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 font-cute flex items-center gap-1.5">
                    <span>Chu Kỳ Flo</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-300 font-mono font-bold">
                      {selectedDate === todayStr ? 'Hôm nay' : formatDisplayDate(selectedDate)}
                    </span>
                  </h4>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {selectedDayCycleInfo.phaseName}
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  soundService.playPop();
                  setIsCycleModalOpen(true);
                }}
                className="px-3 py-1.5 rounded-2xl bg-white dark:bg-zinc-800 hover:bg-rose-50 dark:hover:bg-zinc-700 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-zinc-700 text-xs font-bold font-cute shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1"
                title="Mở bảng theo dõi chi tiết chu kỳ & ghi triệu chứng"
              >
                <span>Chi tiết</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Flo Phase & Day Pills */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <div className="px-3 py-1 rounded-xl bg-white/90 dark:bg-zinc-800 border border-rose-100 dark:border-zinc-700 font-cute font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-1.5 shadow-xs">
                <span>{selectedDayCycleInfo.phaseEmoji}</span>
                <span>Ngày {selectedDayCycleInfo.cycleDay}/{selectedDayCycleInfo.totalCycleDays}</span>
              </div>

              <div className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold font-cute shadow-xs ${selectedDayCycleInfo.chanceColor}`}>
                Thụ thai: {selectedDayCycleInfo.pregnancyChance}
              </div>
            </div>

            {/* Mini Partner Care Note */}
            <p className="text-[11px] text-zinc-600 dark:text-zinc-300 italic bg-white/60 dark:bg-zinc-800/60 p-2.5 rounded-2xl border border-rose-100/60 dark:border-zinc-700/60 leading-relaxed font-cute flex items-start gap-1.5">
              <Heart className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5 fill-rose-500" />
              <span>{selectedDayCycleInfo.partnerCareTip}</span>
            </p>
          </div>

          {/* CALENDAR CARD */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-rose-100 dark:border-zinc-800 shadow-lg space-y-4">
            {/* Calendar Header */}
            <div className="flex items-center justify-between pb-3 border-b border-rose-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-500">
                  <CalendarIcon className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="font-bold text-sm text-zinc-800 dark:text-zinc-100 font-cute">
                    Tháng {currentCalDate.getMonth() + 1}, {currentCalDate.getFullYear()}
                  </h3>
                  <span className="text-[11px] text-zinc-400">Chọn ngày để mở tập trang</span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    soundService.playPop();
                    setCurrentCalDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
                  }}
                  className="p-1.5 rounded-full hover:bg-rose-50 dark:hover:bg-zinc-800 text-zinc-500 hover:text-rose-500 transition cursor-pointer"
                  title="Tháng trước"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    soundService.playPop();
                    setCurrentCalDate(new Date());
                    setSelectedDate(todayStr);
                  }}
                  className="px-2 py-1 rounded-lg bg-rose-50 dark:bg-zinc-800 text-rose-600 dark:text-rose-300 text-[10px] font-bold cursor-pointer"
                >
                  Nay
                </button>
                <button
                  onClick={() => {
                    soundService.playPop();
                    setCurrentCalDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
                  }}
                  className="p-1.5 rounded-full hover:bg-rose-50 dark:hover:bg-zinc-800 text-zinc-500 hover:text-rose-500 transition cursor-pointer"
                  title="Tháng sau"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-zinc-400">
              <span>CN</span>
              <span>T2</span>
              <span>T3</span>
              <span>T4</span>
              <span>T5</span>
              <span>T6</span>
              <span>T7</span>
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {calendarDays.map((item, idx) => {
                if (!item.isCurrentMonth) {
                  return <div key={`empty_${idx}`} className="h-10 sm:h-11" />;
                }

                // Flo highlight styling
                const isPeriodDay = item.isPeriod;
                const isOvulationDay = item.isOvulation;
                const isFertileDay = item.isFertile;

                return (
                  <button
                    key={item.dateStr}
                    onClick={() => {
                      if (item.dateStr) {
                        soundService.playPaperOpen();
                        setSelectedDate(item.dateStr);
                      }
                    }}
                    className={`relative h-10 sm:h-11 rounded-full flex flex-col items-center justify-center transition-all duration-200 cursor-pointer ${
                      item.isSelected
                        ? 'bg-gradient-to-tr from-rose-500 to-pink-500 text-white font-bold shadow-md shadow-rose-200 scale-105 z-10'
                        : item.isToday
                        ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300 font-bold border border-rose-300'
                        : isPeriodDay
                        ? 'bg-rose-100/70 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-semibold'
                        : isOvulationDay
                        ? 'bg-purple-100/70 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-semibold'
                        : 'hover:bg-rose-50/70 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                    } ${!item.isSelected && item.hasDiary ? 'ring-2 ring-rose-400 dark:ring-rose-500 ring-offset-1 dark:ring-offset-zinc-900' : ''}`}
                  >
                    <span className="text-xs leading-none">{item.dayNumber}</span>

                    {/* Indicators Bar */}
                    <div className="flex items-center gap-0.5 mt-0.5">
                      {isPeriodDay && (
                        <span className="text-[9px] leading-none" title="Kỳ kinh nguyệt">
                          🩸
                        </span>
                      )}
                      {isOvulationDay && (
                        <span className="text-[9px] leading-none" title="Rụng trứng cao điểm">
                          🌸
                        </span>
                      )}
                      {isFertileDay && !isOvulationDay && !isPeriodDay && (
                        <span className="text-[9px] leading-none" title="Cửa sổ thụ thai">
                          ✨
                        </span>
                      )}
                      {item.isAnniversary && (
                        <span className="text-[9px] leading-none" title={item.anniversaryName || 'Kỷ niệm'}>
                          💖
                        </span>
                      )}
                      {item.hasDiary && (
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            item.isSelected ? 'bg-white ring-1 ring-rose-200' : 'bg-rose-500'
                          }`}
                          title={`${item.diaryCount} trang nhật ký`}
                        />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Calendar Flo Legend */}
            <div className="pt-2 flex items-center justify-center gap-3 text-[10px] text-zinc-500 dark:text-zinc-400 border-t border-rose-100/70 dark:border-zinc-800 flex-wrap font-cute">
              <span className="flex items-center gap-1">
                <span>🩸</span>
                <span>Kỳ kinh</span>
              </span>
              <span className="flex items-center gap-1">
                <span>🌸</span>
                <span>Rụng trứng</span>
              </span>
              <span className="flex items-center gap-1">
                <span>✨</span>
                <span>Thụ thai</span>
              </span>
              <span className="flex items-center gap-1">
                <span>💖</span>
                <span>Kỷ niệm</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" />
                <span>Nhật ký</span>
              </span>
            </div>

            {/* Selected Date Summary & Quick Delete Option */}
            <div className="pt-3 border-t border-rose-100 dark:border-zinc-800 flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-zinc-800 dark:text-zinc-200 block">
                  Tập ngày: {formatDisplayDate(selectedDate)}
                </span>
                <span className="text-rose-500 font-bold text-[11px]">
                  {selectedDayEntries.length} trang đã viết
                </span>
              </div>

              {selectedDayEntries.length > 0 && (
                <button
                  onClick={() => {
                    soundService.playPop();
                    setIsDeleteEntireDayModalOpen(true);
                  }}
                  className="px-2.5 py-1 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 dark:text-red-400 font-bold text-[11px] flex items-center gap-1 transition cursor-pointer"
                  title="Xóa toàn bộ các trang nhật ký của ngày này"
                >
                  <Trash2 className="w-3 h-3 text-red-500" />
                  <span>Xóa tập ngày này</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. UNIFIED 3D NOTEBOOK LEAF (8 COLS) - SYNCHRONIZED VIEW & WRITE UI       */}
        {/* ========================================================================= */}
        <div className="lg:col-span-8 flex flex-col book-perspective">
          {/* Outer Leather Hardcover with Bound Left Edge & 3D Depth */}
          <div className="relative rounded-[40px] bg-gradient-to-br from-[#4a2422] via-[#351816] to-[#220d0b] p-4 sm:p-6 shadow-2xl border-4 border-[#240e0c] overflow-hidden book-page-depth-edge border-l-12 border-l-[#2c1311]">
            {/* Corner Gold Emboss */}
            <div className="absolute top-3 left-3 w-8 h-8 border-t-2 border-l-2 border-amber-400/60 rounded-tl-2xl pointer-events-none" />
            <div className="absolute top-3 right-3 w-8 h-8 border-t-2 border-r-2 border-amber-400/60 rounded-tr-2xl pointer-events-none" />
            <div className="absolute bottom-3 left-3 w-8 h-8 border-b-2 border-l-2 border-amber-400/60 rounded-bl-2xl pointer-events-none" />
            <div className="absolute bottom-3 right-3 w-8 h-8 border-b-2 border-r-2 border-amber-400/60 rounded-br-2xl pointer-events-none" />

            {/* Red Satin Bookmark Ribbon on Top Right */}
            <div className="absolute top-0 right-10 sm:right-16 w-7 h-16 bg-gradient-to-b from-rose-600 to-rose-500 rounded-b-lg shadow-xl z-30 flex items-end justify-center pb-1 text-xs text-amber-200 font-bold pointer-events-none">
              ♥
            </div>

            {/* Notebook Page Leaf */}
            <div className="relative rounded-[28px] bg-[#fffdf9] dark:bg-[#1a171f] shadow-2xl min-h-[760px] flex flex-col justify-between overflow-hidden border border-[#ecdac8] dark:border-zinc-800 p-5 sm:p-8">
              {/* Turn.js Interactive Dog-Ear Corner Peel on Bottom-Right */}
              {pageMode === 'view' && selectedDayEntries.length > 1 && dayPageIndex < selectedDayEntries.length - 1 && (
                <div
                  onClick={handleTurnNextDayPage}
                  className="dog-ear-corner-right"
                  title="Lật sang trang sau của ngày này"
                />
              )}

              {/* Turn.js Interactive Dog-Ear Corner Peel on Bottom-Left */}
              {pageMode === 'view' && dayPageIndex > 0 && (
                <div
                  onClick={handleTurnPrevDayPage}
                  className="dog-ear-corner-left"
                  title="Lật về trang trước của ngày này"
                />
              )}

              {/* =================================================================== */}
              {/* TOP PAGE BAR: DISPLAY "Trang ?/?" INSIDE NOTEBOOK                   */}
              {/* =================================================================== */}
              <div className="flex items-center justify-between pb-3 border-b border-[#ebd7c3] dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400 z-20">
                {/* Clean Page Counter: Trang X / Y */}
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-300 font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-xs">
                    <BookOpen className="w-4 h-4" />
                    <span>Trang {currentPageNumber} / {displayTotalPages}</span>
                  </span>
                  <span className="text-zinc-400 font-cute hidden sm:inline">
                    • Ngày {formatDisplayDate(selectedDate)}
                  </span>
                </div>

                {/* Page Navigation & Actions */}
                <div className="flex items-center gap-1.5">
                  {pageMode === 'view' && currentDayEntry && (
                    <>
                      <button
                        onClick={() => handleStartEditPage(currentDayEntry)}
                        className="px-3 py-1.5 rounded-full bg-rose-50 dark:bg-zinc-800 text-rose-600 dark:text-rose-300 hover:bg-rose-100 font-bold text-xs flex items-center gap-1 transition active:scale-95 cursor-pointer"
                        title="Sửa trang này"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Sửa trang</span>
                      </button>

                      <button
                        onClick={() => setEntryToDelete(currentDayEntry)}
                        className="px-3 py-1.5 rounded-full bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 hover:bg-red-100 font-bold text-xs flex items-center gap-1 transition active:scale-95 cursor-pointer"
                        title="Xóa trang nhật ký này & thông báo cho cả 2"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Xóa trang</span>
                      </button>
                    </>
                  )}

                  {pageMode === 'write' && selectedDayEntries.length > 0 && (
                    <button
                      onClick={() => setPageMode('view')}
                      className="px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 font-bold text-xs transition cursor-pointer"
                    >
                      Hủy / Xem lại
                    </button>
                  )}

                  <button
                    onClick={handleTurnPrevDayPage}
                    disabled={dayPageIndex === 0 || selectedDayEntries.length === 0}
                    className="p-1.5 sm:px-2.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-rose-100 disabled:opacity-30 disabled:pointer-events-none transition flex items-center gap-1 font-bold text-xs cursor-pointer"
                    title="Lật sang trang trước của ngày này"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="hidden md:inline">Trang trước</span>
                  </button>

                  <button
                    onClick={handleTurnNextDayPage}
                    disabled={dayPageIndex >= selectedDayEntries.length - 1 || selectedDayEntries.length === 0}
                    className="p-1.5 sm:px-2.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-rose-100 disabled:opacity-30 disabled:pointer-events-none transition flex items-center gap-1 font-bold text-xs cursor-pointer"
                    title="Lật sang trang sau của ngày này"
                  >
                    <span className="hidden md:inline">Trang sau</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Save Success Banner */}
              {saveSuccessMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="my-2 p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold flex items-center gap-2 z-20"
                >
                  <Check className="w-4 h-4" />
                  <span>Trang nhật ký đã được lưu vào tập ngày {formatDisplayDate(selectedDate)}! 💖</span>
                </motion.div>
              )}

              {/* =================================================================== */}
              {/* UNIFIED 3D PAGE BODY (SYNCHRONIZED VIEW & WRITE LAYOUT)             */}
              {/* =================================================================== */}
              <AnimatePresence mode="wait">
                {pageMode === 'write' ? (
                  /* =============================================================== */
                  /* A. WRITING MODE (SYNCHRONIZED WITH VIEW MODE)                   */
                  /* =============================================================== */
                  <motion.form
                    key={`write_${editingEntryId || 'new'}_${selectedDate}`}
                    onSubmit={handleSavePage}
                    initial={{
                      rotateY: pageTurnDirection === 'next' ? 60 : -60,
                      opacity: 0,
                      transformOrigin: 'left center',
                    }}
                    animate={{
                      rotateY: 0,
                      opacity: 1,
                      transition: { duration: 0.35, ease: [0.25, 1, 0.5, 1] },
                    }}
                    exit={{
                      rotateY: pageTurnDirection === 'next' ? -60 : 60,
                      opacity: 0,
                      transformOrigin: 'left center',
                      transition: { duration: 0.25, ease: 'easeIn' },
                    }}
                    className="my-3 space-y-4 font-cute z-20"
                  >
                    {/* Synchronized Title Header Line */}
                    <div className="border-b-2 border-rose-300 dark:border-zinc-700 pb-1">
                      <input
                        type="text"
                        placeholder="Tiêu đề trang nhật ký..."
                        value={inlineTitle}
                        onChange={(e) => setInlineTitle(e.target.value)}
                        className="w-full bg-transparent border-0 font-romantic font-bold text-xl sm:text-2xl text-rose-600 dark:text-rose-400 focus:ring-0 placeholder:text-zinc-400 placeholder:italic"
                      />
                    </div>

                    {/* Synchronized Ruled Notebook Lines (20 Lines Limit) */}
                    <div className="relative rounded-2xl p-4 sm:p-5 lined-notebook-text border border-[#ecdac8] dark:border-zinc-800 shadow-inner min-h-[500px] sm:min-h-[600px] overflow-hidden">
                      <textarea
                        ref={textareaRef}
                        rows={20}
                        required
                        placeholder="Viết tâm tình của bạn tại đây... Từng chữ sẽ nằm ngay ngắn trên từng dòng kẻ ✍️"
                        value={inlineContent}
                        onChange={handleTextareaChange}
                        onKeyDown={handleKeyDown}
                        className="w-full bg-transparent border-0 font-cute text-[16px] text-zinc-800 dark:text-zinc-100 focus:ring-0 leading-[36px] resize-none selectable-text pl-8 sm:pl-10 break-words break-all whitespace-pre-wrap outline-none overflow-hidden"
                        style={{
                          lineHeight: '36px',
                          minHeight: '360px',
                          wordBreak: 'break-word',
                          overflowWrap: 'anywhere',
                          whiteSpace: 'pre-wrap',
                        }}
                      />

                      {/* Live Capacity Indicator */}
                      <div className="absolute bottom-2 right-4 text-[10px] font-bold text-zinc-400 select-none bg-white/80 dark:bg-zinc-800/80 px-2.5 py-1 rounded-full border border-rose-100 dark:border-zinc-700 shadow-xs flex items-center gap-1.5 pointer-events-none">
                        <span className={currentLinesCount >= MAX_LINES_PER_PAGE ? 'text-rose-500 font-bold' : ''}>
                          Dòng {currentLinesCount}/{MAX_LINES_PER_PAGE}
                        </span>
                      </div>
                    </div>

                    {/* Attached Photos in Write Mode */}
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                          <ImageIcon className="w-4 h-4 text-rose-500" />
                          <span>Ảnh đính kèm ({inlinePhotos.length} ảnh):</span>
                        </label>

                        <label className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-zinc-800 text-rose-600 dark:text-rose-300 hover:bg-rose-100 text-xs font-bold flex items-center gap-1 cursor-pointer transition">
                          <Plus className="w-3.5 h-3.5" />
                          <span>+ Thêm ảnh</span>
                          <input
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={handleMultiplePhotoUpload}
                            className="hidden"
                          />
                        </label>
                      </div>

                      {inlinePhotos.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                          {inlinePhotos.map((photo, i) => (
                            <div
                              key={i}
                              className="relative aspect-square rounded-2xl overflow-hidden shadow-md border-2 border-white dark:border-zinc-700 group bg-zinc-100 dark:bg-zinc-800"
                            >
                              <img src={photo} alt="preview" className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => handleRemovePhoto(i)}
                                className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 text-white hover:bg-red-500 transition opacity-90 group-hover:opacity-100"
                                title="Xóa ảnh"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Synchronized Bottom Metadata Bar */}
                    <div className="pt-3 border-t border-[#ebd8c5] dark:border-zinc-800 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-[#fff9ef] dark:bg-zinc-800/60 border border-[#ecd9c5] dark:border-zinc-700 text-xs">
                        {/* Date & Time */}
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-zinc-700 dark:text-zinc-300">
                            📅 {formatDisplayDate(selectedDate)}
                          </span>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-zinc-400" />
                            <input
                              type="time"
                              value={inlineTime}
                              onChange={(e) => setInlineTime(e.target.value)}
                              className="px-2 py-0.5 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-800 dark:text-zinc-200 focus:ring-1 focus:ring-rose-400"
                            />
                          </div>
                        </div>

                        {/* Mood Selector */}
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] font-bold text-zinc-500">Cảm xúc:</span>
                          <div className="flex items-center gap-1 overflow-x-auto max-w-[170px]">
                            {MOODS.slice(0, 5).map((m) => (
                              <button
                                key={m.emoji}
                                type="button"
                                onClick={() => setInlineMood(m)}
                                className={`p-1.5 rounded-xl text-xs transition cursor-pointer ${
                                  inlineMood.emoji === m.emoji
                                    ? 'bg-rose-500 text-white scale-110 shadow-sm'
                                    : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-rose-50'
                                }`}
                                title={m.label}
                              >
                                {m.emoji}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Weather Selector */}
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] font-bold text-zinc-500">Thời tiết:</span>
                          {WEATHERS.slice(0, 4).map((w) => (
                            <button
                              key={w.emoji}
                              type="button"
                              onClick={() => setInlineWeather(w)}
                              className={`p-1.5 rounded-xl text-xs transition cursor-pointer ${
                                inlineWeather.emoji === w.emoji
                                  ? 'bg-amber-400 text-white scale-110 shadow-sm'
                                  : 'bg-white dark:bg-zinc-800 hover:bg-amber-50'
                              }`}
                              title={w.label}
                            >
                              {w.emoji}
                            </button>
                          ))}
                        </div>

                        {/* Location Field */}
                        <div className="flex items-center gap-1 w-full sm:w-auto">
                          <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <input
                            type="text"
                            placeholder="Địa điểm..."
                            value={inlineLocation}
                            onChange={(e) => setInlineLocation(e.target.value)}
                            className="bg-white dark:bg-zinc-800 px-2.5 py-1 rounded-xl text-xs text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 focus:ring-1 focus:ring-rose-400 placeholder:text-zinc-400"
                          />
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center justify-between gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (inlineContent.trim()) {
                              const newPageNum = selectedDayEntries.length + 1;
                              addDiary({
                                title: inlineTitle.trim() || `Trang ${newPageNum}`,
                                content: inlineContent.trim(),
                                date: selectedDate,
                                time: inlineTime,
                                mood: inlineMood.emoji,
                                moodLabel: inlineMood.label,
                                weather: inlineWeather.emoji,
                                location: inlineLocation.trim() || undefined,
                                photos: inlinePhotos,
                                tags: ['Kỷ niệm'],
                                pageNumber: newPageNum,
                                isPrivate: false,
                              });
                            }
                            handleAddNewPageForThisDay();
                          }}
                          className="px-4 py-2 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold text-xs hover:bg-zinc-200 transition flex items-center gap-1 cursor-pointer"
                        >
                          <span>Sang trang mới (Tách trang)</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>

                        <div className="flex items-center gap-2">
                          {editingEntryId && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingEntryId(null);
                                setPageMode('view');
                              }}
                              className="px-4 py-2 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-bold text-xs hover:bg-zinc-200 cursor-pointer"
                            >
                              Hủy sửa
                            </button>
                          )}
                          <button
                            type="submit"
                            className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-bold text-xs sm:text-sm shadow-md shadow-rose-300 dark:shadow-rose-950 flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                          >
                            <Save className="w-4 h-4" />
                            <span>{editingEntryId ? 'Lưu Cập Nhật' : 'Lưu Trang Này 💖'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.form>
                ) : currentDayEntry ? (
                  /* =============================================================== */
                  /* B. VIEWING MODE (SYNCHRONIZED WITH WRITING MODE)                */
                  /* =============================================================== */
                  <motion.div
                    key={currentDayEntry.id}
                    initial={{
                      rotateY: pageTurnDirection === 'next' ? 60 : -60,
                      opacity: 0,
                      transformOrigin: 'left center',
                    }}
                    animate={{
                      rotateY: 0,
                      opacity: 1,
                      transition: { duration: 0.35, ease: [0.25, 1, 0.5, 1] },
                    }}
                    exit={{
                      rotateY: pageTurnDirection === 'next' ? -60 : 60,
                      opacity: 0,
                      transformOrigin: 'left center',
                      transition: { duration: 0.25, ease: 'easeIn' },
                    }}
                    className="my-3 space-y-4 font-cute z-20"
                  >
                    {/* Synchronized Title Header Line */}
                    <div className="border-b-2 border-rose-300 dark:border-zinc-700 pb-1">
                      <h3 className="w-full font-romantic font-bold text-xl sm:text-2xl text-rose-600 dark:text-rose-400 break-words">
                        {currentDayEntry.title || 'Trang nhật ký'}
                      </h3>
                    </div>

                    {/* Synchronized Ruled Notebook Lines Display */}
                    <div className="relative rounded-2xl p-4 sm:p-5 lined-notebook-text border border-[#ecdac8] dark:border-zinc-800 shadow-inner min-h-[500px] sm:min-h-[600px] overflow-hidden">
                      <div className="pl-8 sm:pl-10 space-y-0">
                        {(currentDayEntry.content || '').split('\n').map((paragraph, pIdx) => (
                          <p
                            key={pIdx}
                            className="font-cute text-[16px] text-zinc-800 dark:text-zinc-100 selectable-text leading-[36px] break-words break-all whitespace-pre-wrap"
                            style={{
                              lineHeight: '36px',
                              wordBreak: 'break-word',
                              overflowWrap: 'anywhere',
                              whiteSpace: 'pre-wrap',
                            }}
                          >
                            {paragraph || '\u00A0'}
                          </p>
                        ))}
                      </div>
                    </div>

                    {/* Attached Photos in View Mode */}
                    {Array.isArray(currentDayEntry.photos) && currentDayEntry.photos.length > 0 && (
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                            <ImageIcon className="w-4 h-4 text-rose-500" />
                            <span>Ảnh đính kèm ({currentDayEntry.photos.length} ảnh):</span>
                          </span>
                        </div>

                        <div
                          className={`grid gap-2.5 pt-1 ${
                            currentDayEntry.photos.length === 1
                              ? 'grid-cols-1 max-w-xs'
                              : currentDayEntry.photos.length === 2
                              ? 'grid-cols-2 max-w-md'
                              : 'grid-cols-2 sm:grid-cols-4'
                          }`}
                        >
                          {currentDayEntry.photos.map((photoUrl, idx) => (
                            <div
                              key={idx}
                              onClick={() => handleOpenPhotoZoom(currentDayEntry.photos, idx, currentDayEntry)}
                              className="group relative aspect-square rounded-2xl overflow-hidden cursor-pointer shadow-md bg-zinc-100 dark:bg-zinc-800 hover:shadow-xl transition-all duration-300 border-2 border-white dark:border-zinc-700"
                            >
                              <img
                                src={photoUrl}
                                alt="diary photo"
                                className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                              />
                              <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                <span className="p-2 rounded-full bg-white/90 text-zinc-800 shadow-md">
                                  <Maximize2 className="w-4 h-4 text-rose-500" />
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Synchronized Bottom Metadata Bar */}
                    <div className="pt-3 border-t border-[#ebd8c5] dark:border-zinc-800 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-[#fff9ef] dark:bg-zinc-800/60 border border-[#ecd9c5] dark:border-zinc-700 text-xs">
                        {/* Date & Time & Author */}
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-bold text-zinc-700 dark:text-zinc-300">
                            📅 {formatDisplayDate(currentDayEntry.date)} ({currentDayEntry.time || '12:00'})
                          </span>
                          <span className="flex items-center gap-1 text-zinc-600 dark:text-zinc-300">
                            <User className="w-3.5 h-3.5 text-rose-400" />
                            <b>{currentDayEntry.authorName || 'Người thương'}</b>
                          </span>
                        </div>

                        {/* Mood & Weather Badges */}
                        <div className="flex items-center gap-2">
                          <span
                            className="px-2.5 py-1 rounded-xl bg-white dark:bg-zinc-800 border border-rose-200 dark:border-zinc-700 font-bold text-rose-600 dark:text-rose-300 shadow-xs"
                            title={`Cảm xúc: ${currentDayEntry.moodLabel || ''}`}
                          >
                            {currentDayEntry.mood || '🥰'} {currentDayEntry.moodLabel || 'Hạnh phúc'}
                          </span>
                          <span
                            className="px-2.5 py-1 rounded-xl bg-white dark:bg-zinc-800 text-sm border border-zinc-200 dark:border-zinc-700 shadow-xs"
                            title={`Thời tiết: ${currentDayEntry.weather || ''}`}
                          >
                            {currentDayEntry.weather || '☀️'}
                          </span>
                        </div>

                        {/* Location */}
                        {currentDayEntry.location && (
                          <div className="flex items-center gap-1 text-rose-500 font-medium">
                            <MapPin className="w-3.5 h-3.5" />
                            <span>{currentDayEntry.location}</span>
                          </div>
                        )}
                      </div>

                      {/* Quick Reactions & Action Toolbar */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
                        {/* Emoji Reactions */}
                        <div className="flex items-center gap-1 flex-wrap">
                          {QUICK_REACTIONS.map((emoji) => {
                            const users = currentDayEntry.reactions?.[emoji] || [];
                            const hasReacted = users.includes(myProfile?.id || '');
                            return (
                              <button
                                key={emoji}
                                onClick={() => {
                                  soundService.playPop();
                                  addDiaryReaction(currentDayEntry.id, emoji);
                                }}
                                className={`px-2.5 py-1 rounded-full text-xs transition flex items-center gap-1 cursor-pointer ${
                                  hasReacted
                                    ? 'bg-rose-100 dark:bg-rose-950/60 border border-rose-300 font-bold scale-105'
                                    : 'bg-zinc-50 dark:bg-zinc-800 hover:bg-rose-50 text-zinc-600 dark:text-zinc-300'
                                }`}
                              >
                                <span>{emoji}</span>
                                {users.length > 0 && <span className="text-[10px] font-bold">{users.length}</span>}
                              </button>
                            );
                          })}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleStartEditPage(currentDayEntry)}
                            className="px-3.5 py-2 rounded-2xl bg-rose-50 dark:bg-zinc-800 text-rose-600 dark:text-rose-300 text-xs font-bold hover:bg-rose-100 flex items-center gap-1.5 transition cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Sửa trang</span>
                          </button>

                          <button
                            onClick={() => setEntryToDelete(currentDayEntry)}
                            className="px-3.5 py-2 rounded-2xl text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                            title="Xóa trang này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Xóa trang</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  /* =============================================================== */
                  /* C. EMPTY STATE IF NO ENTRIES FOR THIS SELECTED DAY              */
                  /* =============================================================== */
                  <div className="my-12 text-center space-y-3 z-20">
                    <div className="w-16 h-16 mx-auto rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center text-3xl">
                      📖
                    </div>
                    <h4 className="font-bold text-zinc-800 dark:text-zinc-200">
                      Chưa có trang nhật ký cho ngày {formatDisplayDate(selectedDate)}
                    </h4>
                    <p className="text-xs text-zinc-500 max-w-sm mx-auto font-cute">
                      Hãy viết lại những khoảnh khắc ngọt ngào của ngày hôm nay vào cuốn sổ nhé!
                    </p>
                    <button
                      onClick={handleAddNewPageForThisDay}
                      className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 text-white font-bold text-xs shadow-md shadow-rose-200 hover:from-rose-600 hover:to-pink-600 transition cursor-pointer"
                    >
                      ✍️ Bắt Đầu Viết Trang Mới
                    </button>
                  </div>
                )}
              </AnimatePresence>

              {/* Bottom Page Footnote */}
              <div className="pt-4 border-t border-[#ebd9c5] dark:border-zinc-800 flex items-center justify-between text-[11px] text-zinc-400 font-cute z-20">
                <span>Tập trang ngày {formatDisplayDate(selectedDate)}</span>
                <span className="italic">Kỷ niệm ngọt ngào đong đầy theo năm tháng 💖</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Single Page Delete Confirmation Modal */}
      <AnimatePresence>
        {entryToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-cute">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-[32px] p-6 shadow-2xl border border-rose-200 dark:border-zinc-800 space-y-4"
            >
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/50 text-red-500 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>

              <div className="text-center space-y-1.5">
                <h3 className="font-bold text-base text-zinc-800 dark:text-zinc-100">
                  Xác nhận xóa trang nhật ký này?
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Hành động này sẽ xóa vĩnh viễn trang <b>"{entryToDelete.title || 'Trang nhật ký'}"</b> của ngày {formatDisplayDate(entryToDelete.date)} và <b>gửi thông báo đồng bộ đến cả hai bạn</b>.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEntryToDelete(null)}
                  className="px-4 py-2 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold text-xs hover:bg-zinc-200 transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteSinglePage}
                  className="px-5 py-2 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-bold text-xs shadow-md shadow-red-200 transition cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Xóa & Thông Báo</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Entire Day Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteEntireDayModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-cute">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-[32px] p-6 shadow-2xl border border-red-300 dark:border-red-900 space-y-4"
            >
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/60 text-red-500 flex items-center justify-center mx-auto">
                <FolderX className="w-6 h-6" />
              </div>

              <div className="text-center space-y-1.5">
                <h3 className="font-bold text-base text-zinc-800 dark:text-zinc-100">
                  Xóa toàn bộ nhật ký ngày {formatDisplayDate(selectedDate)}?
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Bạn đang chuẩn bị xóa toàn bộ <b>{selectedDayEntries.length} trang nhật ký</b> của ngày {formatDisplayDate(selectedDate)}. Hành động này không thể hoàn tác và sẽ <b>gửi thông báo đồng bộ thời gian thực đến cả hai bạn</b>.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDeleteEntireDayModalOpen(false)}
                  className="px-4 py-2 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold text-xs hover:bg-zinc-200 transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteEntireDay}
                  className="px-5 py-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold text-xs shadow-md shadow-red-200 transition cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Xác Nhận Xóa Toàn Bộ</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Flo Menstrual Cycle Modal */}
      <CycleTrackerModal
        isOpen={isCycleModalOpen}
        onClose={() => setIsCycleModalOpen(false)}
        selectedDate={selectedDate}
        cycleSettings={cycleSettings}
        cycleLogs={cycleLogs}
        onSaveLog={handleSaveCycleLog}
        onSaveSettings={handleSaveCycleSettings}
        onSendPartnerCareAction={handleSendPartnerCareAction}
      />

      {/* Universal Lightbox Zoom */}
      <ImageLightbox
        images={lightboxImages}
        initialIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
};
