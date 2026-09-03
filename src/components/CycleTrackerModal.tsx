import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Heart,
  Droplet,
  Sparkles,
  Calendar,
  Settings,
  X,
  Check,
  Flame,
  Coffee,
  Info,
  ChevronRight,
  ShieldCheck,
  Activity,
  Smile,
  AlertCircle,
  Clock,
  History,
  Trash2,
  PlusCircle,
} from 'lucide-react';
import { DailyCycleLog, CycleSettings, PeriodRecord } from '../types';
import {
  CYCLE_SYMPTOMS,
  FLOW_LEVELS,
  CERVICAL_MUCUS,
  getDayCycleInfo,
  DayCycleInfo,
  getConsolidatedPeriodHistory,
  getFutureCyclePredictions,
  logNewPeriodStart,
  removePeriodFromHistory,
} from '../utils/cycle';
import { soundService } from '../services/sound';
import { formatDateVN } from '../utils/date';
import { DateInputVN } from './DateInputVN';

interface CycleTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
  cycleSettings: CycleSettings;
  cycleLogs: Record<string, DailyCycleLog>;
  onSaveLog: (date: string, log: DailyCycleLog) => void;
  onSaveSettings: (settings: CycleSettings) => void;
  onBatchUpdateCycle?: (settings: CycleSettings, logs: Record<string, DailyCycleLog>) => void;
  onSendPartnerCareAction?: (actionText: string) => void;
}

export const CycleTrackerModal: React.FC<CycleTrackerModalProps> = ({
  isOpen,
  onClose,
  selectedDate,
  cycleSettings,
  cycleLogs,
  onSaveLog,
  onSaveSettings,
  onBatchUpdateCycle,
  onSendPartnerCareAction,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'log' | 'history' | 'settings'>('overview');

  // Existing log for the selected date
  const existingLog = cycleLogs[selectedDate];

  // Local form states
  const [flow, setFlow] = useState<DailyCycleLog['flow']>(existingLog?.flow || (existingLog?.isPeriodDay ? 'medium' : 'none'));
  const [isPeriodDay, setIsPeriodDay] = useState<boolean>(existingLog?.isPeriodDay ?? (flow !== 'none'));
  const [painLevel, setPainLevel] = useState<number>(existingLog?.painLevel || 0);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>(existingLog?.symptoms || []);
  const [selectedMood, setSelectedMood] = useState<string>(existingLog?.mood || '');
  const [cervicalMucus, setCervicalMucus] = useState<DailyCycleLog['cervicalMucus']>(existingLog?.cervicalMucus || 'dry');
  const [notes, setNotes] = useState<string>(existingLog?.notes || '');
  const [isSavedNotice, setIsSavedNotice] = useState(false);

  // Proactive Period Start Modal / Form inside Tracker
  const [showProactiveModal, setShowProactiveModal] = useState(false);
  const [proactiveStartDate, setProactiveStartDate] = useState(selectedDate);
  const [proactiveDuration, setProactiveDuration] = useState(cycleSettings.periodDuration || 5);
  const [proactiveNotes, setProactiveNotes] = useState('');

  // Settings form states
  const [cycleLengthInput, setCycleLengthInput] = useState<number>(cycleSettings.cycleLength || 28);
  const [periodDurationInput, setPeriodDurationInput] = useState<number>(cycleSettings.periodDuration || 5);
  const [lastPeriodDateInput, setLastPeriodDateInput] = useState<string>(cycleSettings.lastPeriodStartDate || selectedDate);
  const [actionSuccessNotice, setActionSuccessNotice] = useState<string | null>(null);

  // Keep form updated when selectedDate or existingLog changes
  React.useEffect(() => {
    const cur = cycleLogs[selectedDate];
    if (cur) {
      setFlow(cur.flow || (cur.isPeriodDay ? 'medium' : 'none'));
      setIsPeriodDay(cur.isPeriodDay);
      setPainLevel(cur.painLevel || 0);
      setSelectedSymptoms(cur.symptoms || []);
      setSelectedMood(cur.mood || '');
      setCervicalMucus(cur.cervicalMucus || 'dry');
      setNotes(cur.notes || '');
    } else {
      // Auto-suggest based on calculated cycle
      const cycleInfo = getDayCycleInfo(selectedDate, cycleSettings, cycleLogs);
      if (cycleInfo.isPeriod) {
        setFlow('medium');
        setIsPeriodDay(true);
      } else {
        setFlow('none');
        setIsPeriodDay(false);
      }
      setPainLevel(0);
      setSelectedSymptoms([]);
      setSelectedMood('');
      setCervicalMucus('dry');
      setNotes('');
    }
    setProactiveStartDate(selectedDate);
  }, [selectedDate, cycleLogs, cycleSettings]);

  // Current Day info
  const dayInfo: DayCycleInfo = useMemo(() => {
    return getDayCycleInfo(selectedDate, cycleSettings, cycleLogs);
  }, [selectedDate, cycleSettings, cycleLogs]);

  // Consolidated Period History list
  const historyList = useMemo(() => {
    return getConsolidatedPeriodHistory(cycleSettings, cycleLogs);
  }, [cycleSettings, cycleLogs]);

  // Future predictions list
  const futurePredictions = useMemo(() => {
    return getFutureCyclePredictions(cycleSettings, cycleLogs, 4);
  }, [cycleSettings, cycleLogs]);

  const toggleSymptom = (id: string) => {
    soundService.playPop();
    setSelectedSymptoms((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleFlowSelect = (newFlow: DailyCycleLog['flow']) => {
    soundService.playPop();
    setFlow(newFlow);
    setIsPeriodDay(newFlow !== 'none');
  };

  const handleSaveLog = (e: React.FormEvent) => {
    e.preventDefault();
    soundService.playSparkle();
    const newLog: DailyCycleLog = {
      date: selectedDate,
      flow,
      isPeriodDay: flow !== 'none' || isPeriodDay,
      painLevel,
      symptoms: selectedSymptoms,
      mood: selectedMood,
      cervicalMucus,
      notes: notes.trim(),
      updatedAt: Date.now(),
    };

    onSaveLog(selectedDate, newLog);
    setIsSavedNotice(true);
    setTimeout(() => {
      setIsSavedNotice(false);
      setActiveTab('overview');
    }, 1200);
  };

  // Proactively record a new period start date without breaking previous history
  const handleConfirmProactivePeriod = (e: React.FormEvent) => {
    e.preventDefault();
    soundService.playSparkle();

    const { updatedSettings, updatedLogs } = logNewPeriodStart(
      proactiveStartDate,
      proactiveDuration,
      proactiveNotes,
      cycleSettings,
      cycleLogs
    );

    if (onBatchUpdateCycle) {
      onBatchUpdateCycle(updatedSettings, updatedLogs);
    } else {
      onSaveSettings(updatedSettings);
      Object.keys(updatedLogs).forEach((d) => onSaveLog(d, updatedLogs[d]));
    }

    setShowProactiveModal(false);
    setProactiveNotes('');
    setActionSuccessNotice(`🩸 Đã ghi nhận kỳ kinh mới từ ${formatDateVN(proactiveStartDate)}! Lịch sử các kỳ trước được giữ nguyên và chu kỳ tương lai đã được cập nhật.`);
    setTimeout(() => setActionSuccessNotice(null), 5000);
  };

  const handleDeleteHistoryItem = (startDate: string) => {
    if (!window.confirm(`Bạn có chắc muốn xóa bản ghi kỳ kinh ngày ${formatDateVN(startDate)} khỏi lịch sử?`)) {
      return;
    }
    soundService.playPop();
    const { updatedSettings, updatedLogs } = removePeriodFromHistory(startDate, cycleSettings, cycleLogs);
    if (onBatchUpdateCycle) {
      onBatchUpdateCycle(updatedSettings, updatedLogs);
    } else {
      onSaveSettings(updatedSettings);
    }
    setActionSuccessNotice(`Đã xóa bản ghi ngày ${formatDateVN(startDate)}.`);
    setTimeout(() => setActionSuccessNotice(null), 3000);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    soundService.playSparkle();
    onSaveSettings({
      ...cycleSettings,
      cycleLength: Number(cycleLengthInput) || 28,
      periodDuration: Number(periodDurationInput) || 5,
      lastPeriodStartDate: lastPeriodDateInput,
      enabled: true,
    });
    setActionSuccessNotice('Đã lưu cấu hình chu kỳ Flo thành công!');
    setTimeout(() => {
      setActionSuccessNotice(null);
      setActiveTab('overview');
    }, 1500);
  };

  const handleQuickCareAction = (actionText: string) => {
    soundService.playHeartbeat();
    if (onSendPartnerCareAction) {
      onSendPartnerCareAction(actionText);
    }
    setActionSuccessNotice(`💖 Đã gửi "${actionText}" đến bạn gái!`);
    setTimeout(() => setActionSuccessNotice(null), 3000);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-black/60 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-2xl rounded-[32px] bg-white dark:bg-zinc-900 border border-rose-200/80 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Top Header */}
          <div className="px-6 py-4 border-b border-rose-100 dark:border-zinc-800 bg-gradient-to-r from-rose-500/10 via-pink-500/5 to-purple-500/10 dark:from-rose-950/40 dark:to-zinc-900 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-500 to-pink-400 flex items-center justify-center text-white shadow-md shadow-rose-200 dark:shadow-none">
                <Droplet className="w-5 h-5 fill-current" />
              </div>
              <div>
                <h3 className="font-bold text-base sm:text-lg text-zinc-900 dark:text-zinc-100 font-cute flex items-center gap-2">
                  <span>Theo Dõi Chu Kỳ Flo</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-300 text-xs font-mono font-bold">
                    {formatDateVN(selectedDate)}
                  </span>
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Dự đoán chu kỳ, rụng trứng, thụ thai & lời khuyên chăm sóc yêu thương
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50 px-4 sm:px-6 pt-2 overflow-x-auto scrollbar-none gap-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 sm:px-4 py-2.5 font-bold text-xs sm:text-sm border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'overview'
                  ? 'border-rose-500 text-rose-600 dark:text-rose-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Tổng Quan</span>
            </button>

            <button
              onClick={() => setActiveTab('log')}
              className={`px-3 sm:px-4 py-2.5 font-bold text-xs sm:text-sm border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'log'
                  ? 'border-rose-500 text-rose-600 dark:text-rose-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <Droplet className="w-4 h-4" />
              <span>Ghi Nhật Ký ({formatDateVN(selectedDate)})</span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 sm:px-4 py-2.5 font-bold text-xs sm:text-sm border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'history'
                  ? 'border-rose-500 text-rose-600 dark:text-rose-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Lịch Sử & Dự Báo</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`px-3 sm:px-4 py-2.5 font-bold text-xs sm:text-sm border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ml-auto ${
                activeTab === 'settings'
                  ? 'border-rose-500 text-rose-600 dark:text-rose-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Cài Đặt</span>
            </button>
          </div>

          {/* Success Toast / Action Notice */}
          {actionSuccessNotice && (
            <div className="mx-6 mt-4 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold font-cute flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{actionSuccessNotice}</span>
            </div>
          )}

          {/* Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* ================================================================= */}
            {/* TAB 1: OVERVIEW & FLO WHEEL INSIGHTS                             */}
            {/* ================================================================= */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Proactive Period Logging Action Card */}
                <div className="p-4 rounded-3xl bg-gradient-to-r from-rose-500/10 via-pink-500/10 to-purple-500/10 dark:from-rose-950/40 dark:to-zinc-800 border border-rose-200 dark:border-rose-900/50 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-3 text-center sm:text-left">
                    <div className="w-10 h-10 rounded-2xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-rose-300 dark:shadow-none">
                      <Droplet className="w-5 h-5 fill-current" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 font-cute">
                        Cập Nhật Ngày Đến Kỳ Kinh Chủ Động 🩸
                      </h4>
                      <p className="text-[11px] text-zinc-600 dark:text-zinc-400 font-cute">
                        Đánh dấu ngày bắt đầu kỳ kinh mới để tự động cập nhật chu kỳ sau này mà không làm ảnh hưởng lịch sử trước đó.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowProactiveModal(true)}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white text-xs font-bold shadow-md shadow-rose-200 dark:shadow-none transition active:scale-95 cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Đánh dấu kỳ kinh mới</span>
                  </button>
                </div>

                {/* Flo-style Visual Circular Wheel & Status Card */}
                <div className="p-6 rounded-3xl bg-gradient-to-br from-rose-50/80 via-pink-50/30 to-purple-50/60 dark:from-zinc-800 dark:to-zinc-900 border border-rose-100 dark:border-zinc-800 text-center relative overflow-hidden">
                  {/* Phase Pill */}
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/90 dark:bg-zinc-800 shadow-sm border border-rose-200/80 dark:border-zinc-700 mb-4">
                    <span className="text-lg">{dayInfo.phaseEmoji}</span>
                    <span className="font-bold text-xs sm:text-sm text-zinc-800 dark:text-zinc-100 font-cute">
                      {dayInfo.phaseName}
                    </span>
                  </div>

                  {/* Circular Gauge / Cycle Day Display */}
                  <div className="my-3 flex flex-col items-center justify-center">
                    <div className="relative w-44 h-44 rounded-full border-8 border-rose-200/60 dark:border-zinc-700 flex flex-col items-center justify-center bg-white/80 dark:bg-zinc-800/80 shadow-inner">
                      {/* Active indicator arc */}
                      <div
                        className="absolute inset-0 rounded-full border-8 border-rose-500 border-t-transparent border-l-transparent transition-transform duration-700"
                        style={{
                          transform: `rotate(${(dayInfo.cycleDay / dayInfo.totalCycleDays) * 360}deg)`,
                        }}
                      />
                      <span className="text-3xl sm:text-4xl font-extrabold text-zinc-900 dark:text-white font-serif">
                        Ngày {dayInfo.cycleDay}
                      </span>
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-cute mt-1">
                        của chu kỳ {dayInfo.totalCycleDays} ngày
                      </span>

                      {/* Pregnancy Chance Badge */}
                      <div
                        className={`mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${dayInfo.chanceColor}`}
                      >
                        Thụ thai: {dayInfo.pregnancyChance}
                      </div>
                    </div>
                  </div>

                  {/* Next Period Prediction Countdown */}
                  <div className="mt-4 pt-3 border-t border-rose-100 dark:border-zinc-700/60 flex items-center justify-center gap-4 text-xs font-cute">
                    <div className="text-zinc-600 dark:text-zinc-300">
                      📅 Kỳ kinh tiếp theo:{' '}
                      <strong className="text-rose-600 dark:text-rose-400 font-mono">
                        {formatDateVN(dayInfo.nextPeriodStartDate)}
                      </strong>
                    </div>
                    <div className="text-zinc-600 dark:text-zinc-300">
                      ⏳{' '}
                      {dayInfo.daysUntilNextPeriod >= 0 ? (
                        <span>
                          Còn <strong className="text-zinc-900 dark:text-white">{dayInfo.daysUntilNextPeriod} ngày</strong>
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 font-bold">
                          Chậm kinh {dayInfo.daysLate} ngày
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Flo Health & Body Insight */}
                <div className="p-5 rounded-3xl bg-white dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-zinc-800 dark:text-zinc-100 font-cute">
                    <Sparkles className="w-4 h-4 text-rose-500" />
                    <span>Hiểu Về Cơ Thể Của Bạn Hôm Nay</span>
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed font-cute">
                    {dayInfo.phaseDesc}
                  </p>
                  <div className="pt-2 flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 font-medium">
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    <span>{dayInfo.healthInsight}</span>
                  </div>
                </div>

                {/* Partner Care Guide */}
                <div className="p-5 rounded-3xl bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-rose-500/10 dark:from-purple-950/40 dark:to-zinc-800 border border-purple-200/80 dark:border-purple-900/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
                      <h4 className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 font-cute">
                        Gợi Ý Chăm Sóc Người Yêu Hôm Nay 💑
                      </h4>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                      Couple Sync
                    </span>
                  </div>

                  <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed font-cute">
                    {dayInfo.partnerCareTip}
                  </p>

                  {/* Quick Love Actions */}
                  <div className="pt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleQuickCareAction('☕ Gửi trà gừng ấm nóng cho bạn gái')}
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-rose-200 dark:border-zinc-700 hover:border-rose-400 text-xs font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
                    >
                      <span>☕ Gửi trà gừng ấm</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQuickCareAction('♨️ Gửi túi chườm sưởi bụng ấm áp')}
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-rose-200 dark:border-zinc-700 hover:border-rose-400 text-xs font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
                    >
                      <span>♨️ Gửi túi chườm ấm</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQuickCareAction('🍫 Gửi socola ngọt ngào & vỗ về')}
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-rose-200 dark:border-zinc-700 hover:border-rose-400 text-xs font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
                    >
                      <span>🍫 Gửi socola & vỗ về</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQuickCareAction('🫂 Ôm bạn gái thật chặt & yêu thương')}
                      className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
                    >
                      <span>🫂 Ôm cô ấy thật chặt</span>
                    </button>
                  </div>
                </div>

                {/* Quick Log Button */}
                <button
                  onClick={() => setActiveTab('log')}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-bold text-xs sm:text-sm shadow-lg shadow-rose-200 dark:shadow-none transition active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                >
                  <Droplet className="w-4 h-4 fill-current" />
                  <span>Ghi Nhận Lượng Kinh & Triệu Chứng Ngày {formatDateVN(selectedDate)} 🩸</span>
                </button>
              </div>
            )}

            {/* ================================================================= */}
            {/* TAB 2: DAILY LOGGING (FLOW, PAIN, SYMPTOMS, MOOD)                 */}
            {/* ================================================================= */}
            {activeTab === 'log' && (
              <form onSubmit={handleSaveLog} className="space-y-5">
                {/* 1. Flow Level */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 font-cute">
                    1. Mức độ ra kinh nguyệt hôm nay ({formatDateVN(selectedDate)}):
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {FLOW_LEVELS.map((item) => {
                      const isSelected = flow === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleFlowSelect(item.id as any)}
                          className={`p-3 rounded-2xl border text-center transition cursor-pointer flex flex-col items-center justify-center gap-1 ${
                            isSelected
                              ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/60 ring-2 ring-rose-400 text-rose-600 dark:text-rose-300 font-bold'
                              : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100'
                          }`}
                        >
                          <span className="text-xl">{item.emoji}</span>
                          <span className="text-xs">{item.label}</span>
                          <span className="text-[10px] text-zinc-400 font-normal">{item.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Pain Level */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300 font-cute">
                    <span>2. Mức độ đau bụng / đau người:</span>
                    <span className="text-rose-500 font-bold font-mono">
                      {painLevel === 0 ? 'Không đau' : `Mức ${painLevel}/5 (${['Không', 'Nhẹ', 'Vừa', 'Đau nhiều', 'Rất đau', 'Dữ dội'][painLevel]})`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={5}
                    step={1}
                    value={painLevel}
                    onChange={(e) => setPainLevel(Number(e.target.value))}
                    className="w-full accent-rose-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-zinc-400 font-cute">
                    <span>0: Êm ái</span>
                    <span>1: Hơi tức</span>
                    <span>2: Đau nhẹ</span>
                    <span>3: Đau vừa</span>
                    <span>4: Đau nhiều</span>
                    <span>5: Cần nằm nghỉ</span>
                  </div>
                </div>

                {/* 3. Physical Symptoms */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 font-cute">
                    3. Triệu chứng cơ thể:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {CYCLE_SYMPTOMS.map((s) => {
                      const isSelected = selectedSymptoms.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => toggleSymptom(s.id)}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                            isSelected
                              ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300 font-bold shadow-xs'
                              : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50'
                          }`}
                        >
                          <span>{s.emoji}</span>
                          <span>{s.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Cervical Mucus */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 font-cute">
                    4. Dịch tiết sinh lý (Khí hư / Cổ tử cung):
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {CERVICAL_MUCUS.map((m) => {
                      const isSelected = cervicalMucus === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setCervicalMucus(m.id as any)}
                          className={`p-2.5 rounded-xl border text-left text-xs transition cursor-pointer flex items-center gap-2 ${
                            isSelected
                              ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold'
                              : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                          }`}
                        >
                          <span>{m.emoji}</span>
                          <span className="truncate">{m.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 5. Daily Notes */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 font-cute">
                    5. Ghi chú sức khỏe hoặc lời nhắn yêu thương:
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ví dụ: Đã uống trà gừng, người yêu nấu cháo rất ngon..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-rose-400 outline-hidden"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  {isSavedNotice ? (
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Check className="w-4 h-4" /> Đã lưu thành công!
                    </span>
                  ) : <div />}

                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-bold text-xs sm:text-sm shadow-md shadow-rose-200 dark:shadow-none transition active:scale-95 cursor-pointer"
                  >
                    Lưu Dữ Liệu Ngày {formatDateVN(selectedDate)} 🩸
                  </button>
                </div>
              </form>
            )}

            {/* ================================================================= */}
            {/* TAB 3: PERIOD HISTORY & SMART FUTURE PREDICTIONS                  */}
            {/* ================================================================= */}
            {activeTab === 'history' && (
              <div className="space-y-6">
                {/* Header Action */}
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 font-cute flex items-center gap-2">
                      <History className="w-4 h-4 text-rose-500" />
                      <span>Lịch Sử Các Kỳ Kinh Đã Ghi Nhận</span>
                    </h4>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Lịch sử từng tháng được bảo toàn 100%, không bị sai lệch khi cập nhật kỳ mới
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowProactiveModal(true)}
                    className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 hover:bg-rose-100 text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Thêm kỳ kinh mới</span>
                  </button>
                </div>

                {/* History List */}
                <div className="space-y-2.5">
                  {historyList.length === 0 ? (
                    <div className="p-6 text-center text-xs text-zinc-400 bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-700">
                      Chưa có kỳ kinh nào được ghi nhận. Bấm nút "Thêm kỳ kinh mới" để bắt đầu theo dõi.
                    </div>
                  ) : (
                    historyList
                      .slice()
                      .reverse()
                      .map((item, idx) => (
                        <div
                          key={item.startDate}
                          className="p-4 rounded-2xl bg-white dark:bg-zinc-800/80 border border-rose-100 dark:border-zinc-700 flex items-center justify-between shadow-xs hover:border-rose-300 transition"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-300 flex items-center justify-center font-bold text-xs shrink-0">
                              🩸 #{historyList.length - idx}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 font-mono">
                                  {formatDateVN(item.startDate)}
                                </span>
                                {idx === 0 && (
                                  <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                                    Kỳ gần nhất
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-[11px] text-zinc-500 dark:text-zinc-400 font-cute mt-0.5">
                                <span>Hành kinh: <strong>{item.duration || 5} ngày</strong></span>
                                {item.cycleLength && (
                                  <span>• Chu kỳ: <strong className="text-rose-600 dark:text-rose-400">{item.cycleLength} ngày</strong></span>
                                )}
                                {item.notes && <span className="italic">• "{item.notes}"</span>}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteHistoryItem(item.startDate)}
                            title="Xóa kỳ kinh này khỏi lịch sử"
                            className="p-2 rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-zinc-700 transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                  )}
                </div>

                {/* Smart Predictions for Upcoming Cycles */}
                <div className="pt-2 space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-500" />
                    <h4 className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 font-cute">
                      Dự Báo Thông Minh 4 Chu Kỳ Tương Lai ✨
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {futurePredictions.map((pred) => (
                      <div
                        key={pred.cycleIndex}
                        className="p-4 rounded-2xl bg-gradient-to-br from-rose-50/50 via-purple-50/30 to-white dark:from-zinc-800 dark:to-zinc-900 border border-rose-100 dark:border-zinc-700 space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs font-bold text-rose-600 dark:text-rose-400">
                          <span>Chu kỳ dự kiến #{pred.cycleIndex}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-mono">
                            {pred.cycleLength} ngày
                          </span>
                        </div>

                        <div className="space-y-1 text-xs text-zinc-700 dark:text-zinc-300 font-cute">
                          <div className="flex items-center justify-between">
                            <span className="text-zinc-500">🩸 Kỳ kinh:</span>
                            <strong className="font-mono">{formatDateVN(pred.startDate)} → {formatDateVN(pred.endDate)}</strong>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-purple-600 dark:text-purple-400">🌸 Rụng trứng:</span>
                            <strong className="font-mono text-purple-700 dark:text-purple-300">{formatDateVN(pred.ovulationDate)}</strong>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-amber-600 dark:text-amber-400">✨ Cửa sổ thụ thai:</span>
                            <strong className="font-mono text-amber-700 dark:text-amber-300">{formatDateVN(pred.fertileStartDate)} → {formatDateVN(pred.fertileEndDate)}</strong>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ================================================================= */}
            {/* TAB 4: CYCLE CONFIGURATION (LENGTH, DURATION, START DATE)         */}
            {/* ================================================================= */}
            {activeTab === 'settings' && (
              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div className="p-4 rounded-2xl bg-rose-50/60 dark:bg-zinc-800/50 border border-rose-100 dark:border-zinc-700 text-xs text-zinc-600 dark:text-zinc-300 font-cute leading-relaxed">
                  💡 Thuật toán Flo sử dụng độ dài chu kỳ và số ngày hành kinh để tự động dự báo ngày rụng trứng và kỳ kinh tiếp theo cho các tháng tới trên lịch.
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1 font-cute">
                      Độ dài chu kỳ kinh nguyệt (Thường từ 24 - 35 ngày):
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={18}
                        max={45}
                        required
                        value={cycleLengthInput}
                        onChange={(e) => setCycleLengthInput(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-800 dark:text-zinc-100"
                      />
                      <span className="text-xs text-zinc-500 font-bold whitespace-nowrap">ngày</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1 font-cute">
                      Số ngày hành kinh (Thường từ 3 - 7 ngày):
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={2}
                        max={10}
                        required
                        value={periodDurationInput}
                        onChange={(e) => setPeriodDurationInput(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-800 dark:text-zinc-100"
                      />
                      <span className="text-xs text-zinc-500 font-bold whitespace-nowrap">ngày</span>
                    </div>
                  </div>
                </div>

                <div>
                  <DateInputVN
                    label="Ngày bắt đầu kỳ kinh nguyệt gần nhất:"
                    required
                    value={lastPeriodDateInput}
                    onChange={(val) => setLastPeriodDateInput(val)}
                    placeholder="dd/mm/yyyy"
                    inputClassName="!bg-zinc-50 dark:!bg-zinc-800 font-bold"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs sm:text-sm shadow-md transition active:scale-95 cursor-pointer"
                  >
                    Lưu Cài Đặt Chu Kỳ 💖
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Sub-Modal / Bottom Sheet for Proactive Period Start */}
          {showProactiveModal && (
            <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
              <div className="w-full max-w-md rounded-3xl bg-white dark:bg-zinc-900 border border-rose-200 dark:border-zinc-800 p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-sm sm:text-base font-cute">
                    <Droplet className="w-5 h-5 fill-current" />
                    <span>Đánh Dấu Bắt Đầu Kỳ Kinh Mới 🩸</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowProactiveModal(false)}
                    className="p-1 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <p className="text-xs text-zinc-600 dark:text-zinc-300 font-cute leading-relaxed">
                  Lựa chọn ngày bắt đầu kinh nguyệt của kỳ này. Hệ thống sẽ tự động cập nhật các chu kỳ tương lai và giữ nguyên toàn bộ lịch sử các tháng trước!
                </p>

                <form onSubmit={handleConfirmProactivePeriod} className="space-y-4">
                  <div>
                    <DateInputVN
                      label="Ngày bắt đầu kỳ kinh mới:"
                      required
                      value={proactiveStartDate}
                      onChange={(val) => setProactiveStartDate(val)}
                      placeholder="dd/mm/yyyy"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1 font-cute">
                      Số ngày hành kinh dự kiến:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={2}
                        max={10}
                        required
                        value={proactiveDuration}
                        onChange={(e) => setProactiveDuration(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-800 dark:text-zinc-100"
                      />
                      <span className="text-xs text-zinc-500 font-bold whitespace-nowrap">ngày</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1 font-cute">
                      Ghi chú triệu chứng ngày đầu (tùy chọn):
                    </label>
                    <input
                      type="text"
                      value={proactiveNotes}
                      onChange={(e) => setProactiveNotes(e.target.value)}
                      placeholder="Ví dụ: Đau nhẹ bụng dưới, hơi mỏi lưng..."
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-800 dark:text-zinc-100"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowProactiveModal(false)}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 text-white font-bold text-xs shadow-md shadow-rose-200 dark:shadow-none transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      <span>Xác Nhận Kỳ Kinh Mới 🩸</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
