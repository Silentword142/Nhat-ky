import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  X,
  MapPin,
  Calendar,
  Wallet,
  Trash2,
  CheckCircle2,
  Circle,
  Clock,
  ListChecks,
  NotebookPen,
  Pencil,
  Check,
  Route,
  Plane,
  Sparkles,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useCouple } from '../context/CoupleContext';
import { TripPlan, PlanStop, PlanStopAlt, PlanBlock, PlanExtraCost } from '../types';
import { THEMES } from '../utils/theme';
import { soundService } from '../services/sound';
import { formatDateVN } from '../utils/date';
import { DateInputVN } from '../components/DateInputVN';
import { PlanBlocksEditor, escapeToHtml } from '../components/PlanBlocks';
import { PlaceActions, PlacePickButton } from '../components/PlaceTools';
import { safeUrl } from '../utils/maps';
import { resolveStop, patchActiveOption } from '../utils/planStops';
import { colName, displayValue, evaluateSheet, isErrorValue, parseNumber } from '../utils/sheet';
import { digitsToGrouped, formatVND, groupThousands } from '../utils/money';
import { PayerSelect, PayerSummary } from '../components/PayerPicker';

// Leaflet is only downloaded when the itinerary map is actually shown.
const PlanDayMap = React.lazy(() => import('../components/PlanDayMap'));

const KINDS: { id: TripPlan['kind']; label: string; emoji: string }[] = [
  { id: 'trip', label: 'Du lịch', emoji: '✈️' },
  { id: 'date', label: 'Hẹn hò', emoji: '🍷' },
  { id: 'picnic', label: 'Dã ngoại', emoji: '🧺' },
  { id: 'staycation', label: 'Nghỉ dưỡng', emoji: '🏝️' },
  { id: 'other', label: 'Khác', emoji: '🎈' },
];

const STATUSES: { id: TripPlan['status']; label: string; emoji: string; chip: string }[] = [
  { id: 'dreaming', label: 'Ước mơ', emoji: '☁️', chip: 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300' },
  { id: 'planned', label: 'Đã lên kế hoạch', emoji: '🗓️', chip: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' },
  { id: 'done', label: 'Đã đi', emoji: '✅', chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' },
];

const COVERS = [
  'from-rose-400 via-pink-400 to-orange-300',
  'from-sky-400 via-cyan-400 to-emerald-300',
  'from-violet-500 via-fuchsia-400 to-pink-300',
  'from-amber-400 via-orange-400 to-rose-400',
  'from-emerald-400 via-teal-400 to-sky-400',
  'from-indigo-500 via-purple-500 to-rose-400',
];

const DEFAULT_CHECKLIST = ['CMND / Căn cước', 'Sạc điện thoại & sạc dự phòng', 'Thuốc & đồ cá nhân', 'Máy ảnh / thẻ nhớ', 'Đặt phòng & vé'];

const todayISO = () => new Date().toISOString().split('T')[0];

const parseMoney = (raw: string): number | undefined => {
  const digits = raw.replace(/[^\d]/g, '');
  return digits ? Number(digits) : undefined;
};

const dayMs = 24 * 60 * 60 * 1000;
const toLocalMidnight = (iso: string) => new Date(`${iso}T00:00:00`).getTime();

/** The calendar date `n` days after `iso` (local, by calendar day — never off by one across DST). */
const addDaysISO = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, (d || 1) + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

const getDuration = (plan: TripPlan) => {
  const start = toLocalMidnight(plan.startDate);
  const end = toLocalMidnight(plan.endDate || plan.startDate);
  if (isNaN(start) || isNaN(end)) return 1;
  return Math.max(1, Math.round((end - start) / dayMs) + 1);
};

const getDaysUntil = (iso: string) => {
  const t = toLocalMidnight(iso);
  if (isNaN(t)) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((t - today) / dayMs);
};

const getProgress = (plan: TripPlan) => {
  const total = plan.stops.length + plan.checklist.length;
  if (total === 0) return 0;
  const done = plan.stops.filter((s) => s.done).length + plan.checklist.filter((c) => c.done).length;
  return Math.round((done / total) * 100);
};

const getSpent = (plan: TripPlan) =>
  plan.stops.reduce((sum, s) => sum + (resolveStop(s).cost || 0), 0) + (plan.extraCosts || []).reduce((sum, x) => sum + (x.amount || 0), 0);

const newId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

const CountdownBadge: React.FC<{ plan: TripPlan }> = ({ plan }) => {
  if (plan.status === 'done') {
    return <span className="px-2.5 py-1 rounded-full bg-white/25 backdrop-blur text-white text-[11px] font-bold">Đã đi ✅</span>;
  }
  const d = getDaysUntil(plan.startDate);
  if (d === null) return null;
  const end = getDaysUntil(plan.endDate || plan.startDate);
  let label = '';
  if (d > 0) label = `Còn ${d} ngày`;
  else if (d === 0) label = 'Hôm nay! 🎉';
  else if (end !== null && end >= 0) label = 'Đang diễn ra 🌈';
  else label = `Đã qua ${Math.abs(end ?? d)} ngày`;
  return <span className="px-2.5 py-1 rounded-full bg-white/25 backdrop-blur text-white text-[11px] font-bold">{label}</span>;
};

export const PlansView: React.FC = () => {
  const { plans, settings, addPlan, updatePlan, deletePlan } = useCouple();
  const currentTheme = THEMES[settings.theme] || THEMES.sakura;

  const [filter, setFilter] = useState<'all' | TripPlan['status']>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedPlan = plans.find((p) => p.id === selectedId) || null;

  /** Deleting is permanent and syncs to the partner, so it always asks first. */
  const confirmDelete = (plan: TripPlan) => {
    if (!window.confirm(`Xóa kế hoạch "${plan.title}"? Hành động này không thể hoàn tác và sẽ xóa ở cả hai máy.`)) return;
    deletePlan(plan.id);
    setSelectedId((cur) => (cur === plan.id ? null : cur));
  };

  const sortedPlans = useMemo(() => {
    const rank = (p: TripPlan) => (p.status === 'done' ? 2 : p.status === 'dreaming' ? 1 : 0);
    return [...plans].sort((a, b) => {
      if (rank(a) !== rank(b)) return rank(a) - rank(b);
      if (a.status === 'done') return (b.startDate || '').localeCompare(a.startDate || '');
      return (a.startDate || '9999').localeCompare(b.startDate || '9999');
    });
  }, [plans]);

  const visiblePlans = sortedPlans.filter((p) => filter === 'all' || p.status === filter);

  const nextPlan = sortedPlans.find((p) => {
    if (p.status !== 'planned') return false;
    const d = getDaysUntil(p.startDate);
    return d !== null && d >= 0;
  });
  const nextDays = nextPlan ? getDaysUntil(nextPlan.startDate) : null;
  const doneCount = plans.filter((p) => p.status === 'done').length;
  const totalBudget = plans.filter((p) => p.status !== 'done').reduce((s, p) => s + (p.budget || 0), 0);

  return (
    <div className="w-full max-w-5xl mx-auto px-3 sm:px-6 pb-24 sm:pb-12">
      {/* HERO */}
      <div className="relative overflow-hidden rounded-[32px] mb-6 p-6 sm:p-8 text-white bg-gradient-to-br from-sky-400 via-fuchsia-400 to-rose-400 shadow-xl shadow-rose-200/40 dark:shadow-none">
        <div className="absolute -top-10 -right-10 w-56 h-56 rounded-full bg-white/15 blur-2xl" />
        <div className="absolute -bottom-16 -left-10 w-64 h-64 rounded-full bg-amber-200/20 blur-3xl" />
        <motion.div
          animate={{ x: [0, 14, 0], y: [0, -8, 0], rotate: [0, 6, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-5 right-6 sm:right-12 text-5xl sm:text-6xl opacity-90 select-none"
        >
          ✈️
        </motion.div>

        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-widest text-white/80 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Cùng nhau khám phá
          </p>
          <h2 className="font-serif italic text-3xl sm:text-4xl mt-1">Kế Hoạch Đi Chơi</h2>
          <p className="text-sm text-white/85 mt-1 max-w-md">
            Lên lịch trình, chuẩn bị đồ và chia sẻ ngân sách cho những chuyến đi của hai đứa.
          </p>

          <div className="grid grid-cols-3 gap-2.5 mt-5 max-w-lg">
            <div className="rounded-2xl bg-white/20 backdrop-blur px-3 py-2.5">
              <div className="text-xl sm:text-2xl font-extrabold leading-none">
                {nextPlan && nextDays !== null ? (nextDays === 0 ? 'Nay' : nextDays) : '—'}
              </div>
              <div className="text-[10px] sm:text-[11px] font-semibold text-white/85 mt-1 truncate">
                {nextPlan ? (nextDays === 0 ? nextPlan.title : `ngày nữa · ${nextPlan.title}`) : 'chưa có chuyến sắp tới'}
              </div>
            </div>
            <div className="rounded-2xl bg-white/20 backdrop-blur px-3 py-2.5">
              <div className="text-xl sm:text-2xl font-extrabold leading-none">{doneCount}</div>
              <div className="text-[10px] sm:text-[11px] font-semibold text-white/85 mt-1">chuyến đã đi</div>
            </div>
            <div className="rounded-2xl bg-white/20 backdrop-blur px-3 py-2.5">
              <div className="text-base sm:text-xl font-extrabold leading-none truncate">
                {totalBudget ? formatVND(totalBudget) : '—'}
              </div>
              <div className="text-[10px] sm:text-[11px] font-semibold text-white/85 mt-1">ngân sách dự kiến</div>
            </div>
          </div>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className={`p-3 sm:p-4 rounded-[28px] ${currentTheme.cardBg} border ${currentTheme.borderSubtle} shadow-lg mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3`}>
        <div className="flex items-center gap-1.5 p-1 rounded-full bg-[#FFF5F7] dark:bg-zinc-800 border border-[#FFE4E9] dark:border-zinc-700 overflow-x-auto">
          {[{ id: 'all', label: `Tất cả (${plans.length})` }, ...STATUSES.map((s) => ({ id: s.id, label: `${s.emoji} ${s.label}` }))].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id as typeof filter)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
                filter === f.id
                  ? 'bg-gradient-to-r from-[#FF758F] to-[#FF9A9E] text-white shadow-sm'
                  : 'text-[#666] dark:text-zinc-400 hover:text-[#FF758F]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            soundService.playPop();
            setIsCreateOpen(true);
          }}
          className="px-5 py-2.5 rounded-full bg-gradient-to-r from-[#FF758F] to-[#FF9A9E] text-white font-bold text-sm shadow-md shadow-rose-200 dark:shadow-rose-950 flex items-center justify-center gap-2 transition active:scale-95 whitespace-nowrap"
        >
          <Plus className="w-4 h-4 stroke-[3px]" />
          Lên kế hoạch mới
        </button>
      </div>

      {/* LIST */}
      {visiblePlans.length === 0 ? (
        <div className={`text-center py-16 px-4 rounded-3xl ${currentTheme.cardBg} border ${currentTheme.borderSubtle}`}>
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="text-6xl mb-3"
          >
            🗺️
          </motion.div>
          <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-200 mb-1 font-cute">
            {plans.length === 0 ? 'Chưa có kế hoạch nào' : 'Không có kế hoạch nào ở mục này'}
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto mb-4">
            Một chuyến đi biển, buổi hẹn cuối tuần hay kỳ nghỉ mơ ước — cứ ghi lại rồi cùng nhau biến nó thành thật nhé!
          </p>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-5 py-2.5 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold shadow-md shadow-rose-300 dark:shadow-rose-950 transition"
          >
            ✈️ Bắt đầu lên kế hoạch
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {visiblePlans.map((plan, idx) => {
            const progress = getProgress(plan);
            const status = STATUSES.find((s) => s.id === plan.status) || STATUSES[1];
            const spent = getSpent(plan);
            return (
              <motion.div
                key={plan.id}
                layout
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.05, 0.3) }}
                whileHover={{ y: -4 }}
                onClick={() => {
                  soundService.playPop();
                  setSelectedId(plan.id);
                }}
                className={`group cursor-pointer rounded-[28px] overflow-hidden ${currentTheme.cardBg} border ${currentTheme.borderSubtle} shadow-md hover:shadow-2xl transition-shadow`}
              >
                <div className={`relative h-32 bg-gradient-to-br ${COVERS[plan.coverIndex % COVERS.length]} p-4 flex flex-col justify-between`}>
                  <div className="absolute inset-0 opacity-25" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, #fff 0, transparent 40%), radial-gradient(circle at 85% 80%, #fff 0, transparent 35%)' }} />
                  <div className="relative flex items-start justify-between">
                    <CountdownBadge plan={plan} />
                    <div className="flex items-center gap-1.5">
                      <span className="text-4xl drop-shadow group-hover:scale-110 transition-transform">{plan.emoji}</span>
                      <button
                        type="button"
                        title="Xóa kế hoạch này"
                        aria-label={`Xóa kế hoạch ${plan.title}`}
                        onClick={(e) => {
                          e.stopPropagation(); // the card itself opens the plan
                          confirmDelete(plan);
                        }}
                        className="p-1.5 rounded-full bg-white/25 hover:bg-red-500 text-white transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <h3 className="text-white font-bold text-lg leading-tight line-clamp-1 drop-shadow">{plan.title}</h3>
                    {plan.destination && (
                      <p className="text-white/90 text-xs flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" /> {plan.destination}
                      </p>
                    )}
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300 font-semibold">
                      <Calendar className="w-3.5 h-3.5 text-rose-500" />
                      {formatDateVN(plan.startDate)}
                      {plan.endDate && plan.endDate !== plan.startDate ? ` → ${formatDateVN(plan.endDate)}` : ''}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full font-bold ${status.chip}`}>{status.label}</span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                      <span>Triển khai {progress}%</span>
                      <span>
                        {plan.stops.length} điểm đến · {getDuration(plan)} ngày
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#FF758F] to-[#FF9A9E] transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {(plan.budget || spent > 0) && (
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                      <Wallet className="w-3.5 h-3.5 text-amber-500" />
                      <span className="font-semibold text-zinc-700 dark:text-zinc-200">{formatVND(spent)}</span>
                      {plan.budget ? <span>/ {formatVND(plan.budget)}</span> : null}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {isCreateOpen && (
          <CreatePlanModal
            onClose={() => setIsCreateOpen(false)}
            onCreate={(data) => {
              const id = addPlan(data);
              setIsCreateOpen(false);
              setSelectedId(id);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedPlan && (
          <PlanDetailModal
            plan={selectedPlan}
            onClose={() => setSelectedId(null)}
            onUpdate={(u) => updatePlan(selectedPlan.id, u)}
            onDelete={() => confirmDelete(selectedPlan)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Create modal                                                        */
/* ------------------------------------------------------------------ */

const inputCls =
  'w-full px-3.5 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 text-sm font-semibold text-zinc-800 dark:text-zinc-100 focus:ring-2 focus:ring-rose-400 placeholder:font-normal placeholder:text-zinc-400';
const labelCls = 'block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1';

const ModalShell: React.FC<{ onClose: () => void; children: React.ReactNode; wide?: boolean; maxW?: string }> = ({ onClose, children, wide, maxW }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    onClick={onClose}
    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-md"
  >
    <motion.div
      initial={{ y: 60, opacity: 0, scale: 0.97 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: 60, opacity: 0 }}
      transition={{ type: 'spring', damping: 26, stiffness: 300 }}
      onClick={(e) => e.stopPropagation()}
      className={`relative w-full ${maxW || (wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')} max-h-[92vh] overflow-y-auto bg-white dark:bg-zinc-900 rounded-t-[32px] sm:rounded-[32px] shadow-2xl border border-rose-100 dark:border-zinc-800`}
    >
      {children}
    </motion.div>
  </motion.div>
);

const CreatePlanModal: React.FC<{
  onClose: () => void;
  onCreate: (data: Omit<TripPlan, 'id' | 'createdAt' | 'updatedAt' | 'authorId' | 'authorName'>) => void;
}> = ({ onClose, onCreate }) => {
  const [kind, setKind] = useState<TripPlan['kind']>('trip');
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState(todayISO);
  const [endDate, setEndDate] = useState(todayISO);
  const [budget, setBudget] = useState('');
  const [status, setStatus] = useState<TripPlan['status']>('planned');
  const [coverIndex, setCoverIndex] = useState(() => Math.floor(Math.random() * COVERS.length));

  const kindInfo = KINDS.find((k) => k.id === kind) || KINDS[0];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const end = endDate && endDate >= startDate ? endDate : startDate;
    onCreate({
      title: title.trim(),
      kind,
      emoji: kindInfo.emoji,
      destination: destination.trim(),
      startDate,
      endDate: end,
      budget: parseMoney(budget),
      status,
      coverIndex,
      stops: [],
      checklist: kind === 'trip' || kind === 'staycation' ? DEFAULT_CHECKLIST.map((text) => ({ id: newId('chk'), text, done: false })) : [],
    });
    soundService.playPop();
  };

  return (
    <ModalShell onClose={onClose}>
      <div className={`relative h-28 bg-gradient-to-br ${COVERS[coverIndex]} flex items-end p-5`}>
        <span className="absolute top-4 right-16 text-5xl drop-shadow">{kindInfo.emoji}</span>
        <h3 className="text-white font-bold text-xl font-cute drop-shadow">Kế hoạch mới</h3>
        <button onClick={onClose} className="absolute top-3 right-3 p-2 rounded-full bg-white/25 hover:bg-white/40 text-white transition">
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={submit} className="p-5 space-y-4">
        <div>
          <label className={labelCls}>Loại kế hoạch</label>
          <div className="flex flex-wrap gap-2">
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setKind(k.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                  kind === k.id
                    ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 scale-105'
                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'
                }`}
              >
                {k.emoji} {k.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelCls}>Tên chuyến đi *</label>
          <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ví dụ: Trăng mật nhỏ ở Đà Lạt" className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>Địa điểm</label>
          <input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Đà Lạt, Lâm Đồng" className={inputCls} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <DateInputVN label="Ngày đi" required value={startDate} onChange={(v) => { setStartDate(v); if (endDate < v) setEndDate(v); }} inputClassName="!bg-zinc-100 dark:!bg-zinc-800 !border-0" />
          <DateInputVN label="Ngày về" value={endDate} min={startDate} onChange={setEndDate} inputClassName="!bg-zinc-100 dark:!bg-zinc-800 !border-0" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Ngân sách (VNĐ)</label>
            <input inputMode="numeric" value={budget} onChange={(e) => setBudget(digitsToGrouped(e.target.value).text)} placeholder="5,000,000" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Trạng thái</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as TripPlan['status'])} className={inputCls}>
              {STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.emoji} {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelCls}>Màu bìa</label>
          <div className="flex gap-2">
            {COVERS.map((c, i) => (
              <button
                key={c}
                type="button"
                onClick={() => setCoverIndex(i)}
                className={`w-9 h-9 rounded-full bg-gradient-to-br ${c} transition ${coverIndex === i ? 'ring-2 ring-offset-2 ring-rose-500 dark:ring-offset-zinc-900 scale-110' : ''}`}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold text-sm">
            Hủy
          </button>
          <button type="submit" className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 text-white font-bold text-sm shadow-md shadow-rose-300 dark:shadow-rose-950 active:scale-95 transition flex items-center gap-1.5">
            <Plane className="w-4 h-4" /> Tạo kế hoạch
          </button>
        </div>
      </form>
    </ModalShell>
  );
};

/* ------------------------------------------------------------------ */
/* Detail modal                                                        */
/* ------------------------------------------------------------------ */

type DetailTab = 'itinerary' | 'cost' | 'checklist';

const PlanDetailModal: React.FC<{
  plan: TripPlan;
  onClose: () => void;
  onUpdate: (updates: Partial<TripPlan>) => void;
  onDelete: () => void;
}> = ({ plan, onClose, onUpdate, onDelete }) => {
  const [tab, setTab] = useState<DetailTab>('itinerary');
  const duration = getDuration(plan);
  const progress = getProgress(plan);
  const status = STATUSES.find((s) => s.id === plan.status) || STATUSES[1];

  const tabs: { id: DetailTab; label: string; icon: React.ReactNode }[] = [
    { id: 'itinerary', label: 'Lịch trình', icon: <Route className="w-4 h-4" /> },
    { id: 'cost', label: 'Chi phí', icon: <Wallet className="w-4 h-4" /> },
    { id: 'checklist', label: 'Chuẩn bị', icon: <ListChecks className="w-4 h-4" /> },
  ];

  const setStatus = (s: TripPlan['status']) => {
    onUpdate({ status: s });
    if (s === 'done' && plan.status !== 'done') {
      try {
        confetti({ particleCount: 90, spread: 80, origin: { y: 0.4 }, colors: ['#f43f5e', '#fbbf24', '#38bdf8', '#c084fc', '#34d399'] });
      } catch {
        // decorative only
      }
    }
  };

  return (
    <ModalShell onClose={onClose} wide maxW={tab === 'itinerary' ? 'sm:max-w-6xl' : 'sm:max-w-3xl'}>
      <div className={`relative bg-gradient-to-br ${COVERS[plan.coverIndex % COVERS.length]} p-5 pb-6 text-white`}>
        <button onClick={onClose} className="absolute top-3 right-3 p-2 rounded-full bg-white/25 hover:bg-white/40 transition">
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3">
          <span className="text-5xl drop-shadow">{plan.emoji}</span>
          <div className="min-w-0">
            <h3 className="font-bold text-xl leading-tight font-cute drop-shadow break-words">{plan.title}</h3>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/90 mt-1">
              {plan.destination && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {plan.destination}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" /> {formatDateVN(plan.startDate)}
                {plan.endDate !== plan.startDate ? ` → ${formatDateVN(plan.endDate)}` : ''} · {duration} ngày
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-4">
          <CountdownBadge plan={plan} />
          <div className="flex gap-1 p-0.5 rounded-full bg-white/20 backdrop-blur">
            {STATUSES.map((s) => (
              <button
                key={s.id}
                onClick={() => setStatus(s.id)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition ${plan.status === s.id ? 'bg-white text-zinc-800 shadow' : 'text-white/90 hover:bg-white/15'}`}
              >
                {s.emoji} {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <div className="flex justify-between text-[11px] font-semibold text-white/90 mb-1">
            <span>Tiến độ triển khai</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-white/25 overflow-hidden">
            <div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      <div className="sticky top-0 z-10 bg-white/95 dark:bg-zinc-900/95 backdrop-blur border-b border-zinc-100 dark:border-zinc-800 px-3 pt-2">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold whitespace-nowrap border-b-2 transition ${
                tab === t.id ? 'border-rose-500 text-rose-600 dark:text-rose-400' : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5 min-h-[260px]">
        {tab === 'itinerary' && <ItineraryTab plan={plan} duration={duration} onUpdate={onUpdate} />}
        {tab === 'checklist' && <ChecklistTab plan={plan} onUpdate={onUpdate} />}
        {tab === 'cost' && <CostTab plan={plan} onUpdate={onUpdate} />}
      </div>

      <div className="px-5 pb-5 flex items-center justify-between text-[11px] text-zinc-400">
        <span>Tạo bởi {plan.authorName}</span>
        <button
          onClick={onDelete}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold bg-red-50 dark:bg-red-950/40 text-red-500 hover:bg-red-500 hover:text-white transition"
        >
          <Trash2 className="w-3.5 h-3.5" /> Xóa kế hoạch
        </button>
      </div>
    </ModalShell>
  );
};

interface StopDraft {
  day: number;
  time: string;
  title: string;
  place: string;
  lat?: number;
  lng?: number;
  reviewUrl: string;
}

/** Three-row form shared by "add" and "edit": [what] / [day · time · place] / [review link · submit]. */
const StopForm: React.FC<{
  initial?: PlanStop;
  days: number[];
  defaultDay?: number;
  submitLabel: string;
  onSubmit: (draft: StopDraft) => void;
  onCancel?: () => void;
}> = ({ initial, days, defaultDay = 1, submitLabel, onSubmit, onCancel }) => {
  const [day, setDay] = useState(initial?.day ?? defaultDay);
  const [time, setTime] = useState(initial?.time ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [place, setPlace] = useState(initial?.place ?? '');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    typeof initial?.lat === 'number' && typeof initial?.lng === 'number' ? { lat: initial.lat, lng: initial.lng } : null
  );
  const [reviewUrl, setReviewUrl] = useState(initial?.reviewUrl ?? '');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({ day, time, title: title.trim(), place: place.trim(), lat: coords?.lat, lng: coords?.lng, reviewUrl: reviewUrl.trim() });
    if (!initial) {
      setTitle('');
      setPlace('');
      setCoords(null);
      setReviewUrl('');
      setTime('');
    }
  };

  return (
    <form onSubmit={submit} className="p-4 rounded-2xl bg-rose-50/70 dark:bg-zinc-800/50 border border-rose-100 dark:border-zinc-800 space-y-2.5">
      <p className="text-xs font-bold text-rose-600 dark:text-rose-300">{initial ? '✏️ Chỉnh sửa hoạt động' : '➕ Thêm hoạt động'}</p>

      {/* Row 1 — what */}
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Làm gì? (ăn tối, ngắm hoàng hôn...)" className={inputCls} autoFocus={!!initial} />

      {/* Row 2 — when & where */}
      <div className="grid grid-cols-2 sm:grid-cols-[104px_116px_minmax(0,1fr)] gap-2">
        <select value={day} onChange={(e) => setDay(Number(e.target.value))} className={inputCls} aria-label="Ngày">
          {days.map((d) => (
            <option key={d} value={d}>
              Ngày {d}
            </option>
          ))}
        </select>
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} aria-label="Giờ" />
        <div className="col-span-2 sm:col-span-1 flex gap-2">
          <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Địa điểm" className={inputCls} />
          <PlacePickButton
            compact
            lat={coords?.lat}
            lng={coords?.lng}
            query={place}
            onPick={(p) => {
              setCoords({ lat: p.lat, lng: p.lng });
              if (!place.trim() && p.address) setPlace(p.address.split(',').slice(0, 2).join(',').trim());
            }}
          />
        </div>
      </div>

      {/* Row 3 — review link & actions */}
      <div className="flex gap-2">
        <input value={reviewUrl} onChange={(e) => setReviewUrl(e.target.value)} placeholder="Link review quán (Google Maps, Foody, TikTok...)" inputMode="url" className={inputCls} />
        {onCancel && (
          <button type="button" onClick={onCancel} className="px-3.5 rounded-xl bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 font-bold text-sm transition whitespace-nowrap">
            Hủy
          </button>
        )}
        <button type="submit" disabled={!title.trim()} className="px-4 rounded-xl bg-rose-500 hover:bg-rose-600 disabled:opacity-40 text-white font-bold text-sm transition whitespace-nowrap">
          {submitLabel}
        </button>
      </div>
    </form>
  );
};

interface AltDraft {
  place: string;
  lat?: number;
  lng?: number;
  reviewUrl: string;
  cost: string;
}

/** Backup option form: [place + map pin] / [review link · cost] / [buttons]. */
const AltForm: React.FC<{ initial?: PlanStopAlt; onSubmit: (d: AltDraft) => void; onCancel: () => void }> = ({ initial, onSubmit, onCancel }) => {
  const [place, setPlace] = useState(initial?.place ?? '');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    typeof initial?.lat === 'number' && typeof initial?.lng === 'number' ? { lat: initial.lat, lng: initial.lng } : null
  );
  const [reviewUrl, setReviewUrl] = useState(initial?.reviewUrl ?? '');
  const [cost, setCost] = useState(initial?.cost ? groupThousands(initial.cost) : '');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!place.trim()) return;
        onSubmit({ place: place.trim(), lat: coords?.lat, lng: coords?.lng, reviewUrl: reviewUrl.trim(), cost });
      }}
      className="mt-2 p-3 rounded-xl bg-white dark:bg-zinc-900 border border-rose-200 dark:border-rose-900/50 space-y-2"
    >
      <div className="flex gap-2">
        <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Tên quán / địa điểm dự phòng" className={inputCls} autoFocus />
        <PlacePickButton
          compact
          lat={coords?.lat}
          lng={coords?.lng}
          query={place}
          onPick={(p) => {
            setCoords({ lat: p.lat, lng: p.lng });
            if (!place.trim() && p.address) setPlace(p.address.split(',').slice(0, 2).join(',').trim());
          }}
        />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-2">
        <input value={reviewUrl} onChange={(e) => setReviewUrl(e.target.value)} placeholder="Link review quán" inputMode="url" className={inputCls} />
        <input
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          onBlur={() => {
            const n = parseMoneyInput(cost);
            if (n !== undefined) setCost(groupThousands(n));
          }}
          placeholder="Chi phí (đ)"
          className={inputCls}
        />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3.5 py-1.5 rounded-xl bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 font-bold text-xs">
          Hủy
        </button>
        <button type="submit" disabled={!place.trim()} className="px-4 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 disabled:opacity-40 text-white font-bold text-xs">
          {initial ? 'Lưu phương án' : 'Thêm phương án'}
        </button>
      </div>
    </form>
  );
};

const OptionCheck: React.FC<{ checked: boolean }> = ({ checked }) => (
  <span className={`shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition ${checked ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-zinc-300 dark:border-zinc-600'}`}>
    {checked && <Check className="w-3.5 h-3.5 stroke-[3px]" />}
  </span>
);

/** Backup options for one activity. Ticking one makes it the option shown on the map (and used for cost). */
const StopOptions: React.FC<{
  stop: PlanStop;
  editingAlt: string | null; // alt id, 'new', or null
  onEditAlt: (id: string | null) => void;
  onChoose: (altId?: string) => void;
  onSaveAlt: (altId: string | null, draft: AltDraft) => void;
  onRemoveAlt: (altId: string) => void;
}> = ({ stop, editingAlt, onEditAlt, onChoose, onSaveAlt, onRemoveAlt }) => {
  const alts = stop.alts || [];
  const mainActive = !stop.activeAltId || !alts.some((a) => a.id === stop.activeAltId);

  if (alts.length === 0 && editingAlt !== 'new') {
    return (
      <button type="button" onClick={() => onEditAlt('new')} className="mt-2 text-[11px] font-bold text-rose-500 hover:text-rose-600 flex items-center gap-1">
        <Plus className="w-3 h-3" /> Thêm phương án dự phòng
      </button>
    );
  }

  const row = (active: boolean, label: string, badge: string, cost: number | undefined, onTick: () => void, actions?: React.ReactNode) => (
    <li className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition ${active ? 'bg-emerald-50 dark:bg-emerald-950/25' : ''}`}>
      <button type="button" onClick={onTick} className="flex flex-1 min-w-0 items-center gap-2 text-left" aria-pressed={active}>
        <OptionCheck checked={active} />
        <span className="min-w-0 flex-1">
          <span className={`block text-xs truncate ${active ? 'font-bold text-zinc-800 dark:text-zinc-100' : 'text-zinc-600 dark:text-zinc-300'}`}>{label}</span>
        </span>
        <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${badge === 'Chính' ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-300'}`}>{badge}</span>
        {cost ? <span className="shrink-0 text-[11px] font-semibold text-amber-600 dark:text-amber-400 tabular-nums">{formatVND(cost)}</span> : null}
      </button>
      {actions}
    </li>
  );

  return (
    <div className="mt-2.5 pt-2.5 border-t border-dashed border-zinc-200 dark:border-zinc-700">
      <p className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1">Phương án · tích chọn để hiện trên bản đồ</p>
      <ul className="space-y-0.5">
        {row(mainActive, stop.place || 'Phương án chính (chưa nhập địa điểm)', 'Chính', stop.cost, () => onChoose(undefined))}
        {alts.map((a, i) =>
          editingAlt === a.id ? (
            <li key={a.id}>
              <AltForm initial={a} onSubmit={(d) => onSaveAlt(a.id, d)} onCancel={() => onEditAlt(null)} />
            </li>
          ) : (
            row(
              stop.activeAltId === a.id,
              a.place || '(chưa đặt tên)',
              `Dự phòng ${i + 1}`,
              a.cost,
              () => onChoose(a.id),
              <span className="flex shrink-0">
                <button type="button" onClick={() => onEditAlt(a.id)} className="p-1 text-zinc-300 hover:text-rose-500" aria-label="Sửa phương án">
                  <Pencil className="w-3 h-3" />
                </button>
                <button type="button" onClick={() => onRemoveAlt(a.id)} className="p-1 text-zinc-300 hover:text-red-500" aria-label="Xóa phương án">
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            )
          )
        )}
      </ul>
      {editingAlt === 'new' ? (
        <AltForm onSubmit={(d) => onSaveAlt(null, d)} onCancel={() => onEditAlt(null)} />
      ) : (
        <button type="button" onClick={() => onEditAlt('new')} className="mt-1.5 text-[11px] font-bold text-rose-500 hover:text-rose-600 flex items-center gap-1">
          <Plus className="w-3 h-3" /> Thêm phương án dự phòng
        </button>
      )}
    </div>
  );
};

const ItineraryTab: React.FC<{ plan: TripPlan; duration: number; onUpdate: (u: Partial<TripPlan>) => void }> = ({ plan, duration, onUpdate }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [lastDay, setLastDay] = useState(1);
  const [mapDay, setMapDay] = useState(1);
  const [altEdit, setAltEdit] = useState<{ stopId: string; alt: string } | null>(null); // alt: id or 'new'

  const days = Array.from({ length: Math.max(duration, ...plan.stops.map((s) => s.day), 1) }, (_, i) => i + 1);

  const draftToFields = (d: StopDraft) => ({
    day: d.day,
    time: d.time || undefined,
    title: d.title,
    place: d.place || undefined,
    lat: d.lat,
    lng: d.lng,
    reviewUrl: safeUrl(d.reviewUrl) || undefined,
  });

  const addStop = (d: StopDraft) => {
    const stop: PlanStop = { id: newId('stop'), done: false, ...draftToFields(d) };
    onUpdate({ stops: [...plan.stops, stop] });
    setLastDay(d.day);
    setMapDay(d.day);
    soundService.playPop();
  };

  const saveStop = (id: string, d: StopDraft) => {
    onUpdate({ stops: plan.stops.map((s) => (s.id === id ? { ...s, ...draftToFields(d) } : s)) });
    setEditingId(null);
  };

  const chooseOption = (stopId: string, altId?: string) => {
    onUpdate({ stops: plan.stops.map((s) => (s.id === stopId ? { ...s, activeAltId: altId } : s)) });
    soundService.playPop();
  };

  const saveAlt = (stopId: string, altId: string | null, d: AltDraft) => {
    const fields = { place: d.place, lat: d.lat, lng: d.lng, reviewUrl: safeUrl(d.reviewUrl) || undefined, cost: parseMoneyInput(d.cost) };
    onUpdate({
      stops: plan.stops.map((s) => {
        if (s.id !== stopId) return s;
        const alts = s.alts || [];
        return altId
          ? { ...s, alts: alts.map((a) => (a.id === altId ? { ...a, ...fields } : a)) }
          : { ...s, alts: [...alts, { id: newId('alt'), ...fields }] };
      }),
    });
    setAltEdit(null);
  };

  const removeAlt = (stopId: string, altId: string) => {
    if (!window.confirm('Xóa phương án dự phòng này?')) return;
    onUpdate({
      stops: plan.stops.map((s) =>
        s.id === stopId ? { ...s, alts: (s.alts || []).filter((a) => a.id !== altId), activeAltId: s.activeAltId === altId ? undefined : s.activeAltId } : s
      ),
    });
  };

  const toggleStop = (id: string) => onUpdate({ stops: plan.stops.map((s) => (s.id === id ? { ...s, done: !s.done } : s)) });
  const removeStop = (id: string) => {
    if (window.confirm('Xóa hoạt động này khỏi lịch trình?')) onUpdate({ stops: plan.stops.filter((s) => s.id !== id) });
  };

  const dateOfDay = (d: number) => {
    const t = toLocalMidnight(plan.startDate);
    if (isNaN(t)) return '';
    return formatDateVN(new Date(t + (d - 1) * dayMs));
  };

  // Visiting order (by time) — the same order and numbering the map uses.
  // A day is added by moving the plan's end date: the header, the map, the cost sheet and Dating Fees
  // all date their activities from start + day, so they stay in step with no extra bookkeeping.
  const addDay = () => {
    const next = days.length + 1;
    onUpdate({ endDate: addDaysISO(plan.startDate, next - 1) });
    setLastDay(next);
    setMapDay(next);
    soundService.playPop();
  };
  const lastDayNo = days[days.length - 1];
  const canDropLastDay = days.length > 1 && !plan.stops.some((s) => s.day === lastDayNo);
  const dropLastDay = () => {
    if (!canDropLastDay) return;
    onUpdate({ endDate: addDaysISO(plan.startDate, days.length - 2) });
    setLastDay((d) => Math.min(d, days.length - 1));
    setMapDay((d) => Math.min(d, days.length - 1));
  };

  const stopsOfDay = (d: number) =>
    plan.stops.filter((s) => s.day === d).sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));

  const activeMapDay = days.includes(mapDay) ? mapDay : days[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
      {/* Map: first on phones, sticky on the right on desktop */}
      <div className="order-first lg:order-last lg:sticky lg:top-14">
        <Suspense
          fallback={<div className="h-64 rounded-2xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-sm text-zinc-400">Đang tải bản đồ...</div>}
        >
          <PlanDayMap
            stops={stopsOfDay(activeMapDay).map(resolveStop)}
            days={days}
            day={activeMapDay}
            dateLabel={dateOfDay(activeMapDay)}
            destination={plan.destination}
            onDayChange={setMapDay}
            onPinStop={(id, c) => onUpdate({ stops: plan.stops.map((s) => (s.id === id ? patchActiveOption(s, { lat: c.lat, lng: c.lng }) : s)) })}
          />
        </Suspense>
      </div>

    <div className="space-y-5 min-w-0">
      <div className="space-y-4">
        {days.map((d) => {
          const stops = stopsOfDay(d);
          return (
            <div key={d}>
              <div className="flex items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setMapDay(d)}
                  title="Xem ngày này trên bản đồ"
                  className={`px-3 py-1 rounded-full bg-gradient-to-r from-[#FF758F] to-[#FF9A9E] text-white text-xs font-extrabold transition ${d === activeMapDay ? 'ring-2 ring-offset-2 ring-rose-400 dark:ring-offset-zinc-900' : 'opacity-80 hover:opacity-100'}`}
                >
                  Ngày {d}
                </button>
                <span className="text-[11px] text-zinc-400">{dateOfDay(d)}</span>
                {d === lastDayNo && canDropLastDay && (
                  <button type="button" onClick={dropLastDay} className="ml-auto text-[11px] font-semibold text-zinc-400 hover:text-red-500 transition" title="Bỏ ngày cuối (đang trống)">
                    Bỏ ngày này
                  </button>
                )}
              </div>
              {stops.length === 0 ? (
                <p className="text-xs text-zinc-400 pl-2 italic">Chưa có hoạt động nào.</p>
              ) : (
                <ol className="relative ml-3 border-l-2 border-dashed border-rose-200 dark:border-rose-900/60 space-y-2.5">
                  {stops.map((s, stopIndex) => {
                    const r = resolveStop(s);
                    return (
                    <li key={s.id} className="relative pl-5">
                      {editingId === s.id ? (
                        <StopForm initial={s} days={days} submitLabel="Lưu" onSubmit={(draft) => saveStop(s.id, draft)} onCancel={() => setEditingId(null)} />
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => toggleStop(s.id)}
                            className="absolute -left-[13px] top-2 bg-white dark:bg-zinc-900 rounded-full"
                            aria-label={s.done ? 'Bỏ đánh dấu' : 'Đánh dấu đã xong'}
                          >
                            {s.done ? <CheckCircle2 className="w-6 h-6 text-emerald-500" /> : <Circle className="w-6 h-6 text-rose-300" />}
                          </button>
                          <div className={`flex items-start justify-between gap-2 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800 ${s.done ? 'opacity-60' : ''}`}>
                            <div className="min-w-0">
                              <p className={`text-sm font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2 ${s.done ? 'line-through' : ''}`}>
                                <span className="shrink-0 w-5 h-5 rounded-full bg-rose-500 text-white text-[11px] font-extrabold flex items-center justify-center no-underline">{stopIndex + 1}</span>
                                <span className="min-w-0 break-words">{s.title}</span>
                              </p>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                {s.time && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> {s.time}
                                  </span>
                                )}
                                {r.place && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" /> {r.place}
                                  </span>
                                )}
                              </div>
                              <PlaceActions place={{ name: r.place, lat: r.lat, lng: r.lng, reviewUrl: r.reviewUrl }} className="mt-1.5" />
                              <StopOptions
                                stop={s}
                                editingAlt={altEdit?.stopId === s.id ? altEdit.alt : null}
                                onEditAlt={(alt) => setAltEdit(alt ? { stopId: s.id, alt } : null)}
                                onChoose={(altId) => chooseOption(s.id, altId)}
                                onSaveAlt={(altId, d) => saveAlt(s.id, altId, d)}
                                onRemoveAlt={(altId) => removeAlt(s.id, altId)}
                              />
                            </div>
                            <div className="flex items-center shrink-0">
                              <button onClick={() => setEditingId(s.id)} className="p-1.5 rounded-lg text-zinc-300 hover:text-rose-500 transition" aria-label="Sửa hoạt động">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => removeStop(s.id)} className="p-1.5 rounded-lg text-zinc-300 hover:text-red-500 transition" aria-label="Xóa hoạt động">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </li>
                    );
                  })}
                </ol>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={addDay}
          className="w-full py-2.5 rounded-2xl border-2 border-dashed border-rose-200 dark:border-rose-900/60 text-rose-500 dark:text-rose-300 text-xs font-extrabold hover:bg-rose-50 dark:hover:bg-rose-950/30 transition flex items-center justify-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5 stroke-[3px]" /> Thêm Ngày {days.length + 1}
          <span className="font-semibold text-rose-400/80">· {formatDateVN(addDaysISO(plan.startDate, days.length))}</span>
        </button>
      </div>

      <StopForm days={days} defaultDay={lastDay} submitLabel="Thêm" onSubmit={addStop} key={`add-${lastDay}`} />
    </div>
    </div>
  );
};

const ChecklistTab: React.FC<{ plan: TripPlan; onUpdate: (u: Partial<TripPlan>) => void }> = ({ plan, onUpdate }) => {
  const [text, setText] = useState('');
  const done = plan.checklist.filter((c) => c.done).length;

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onUpdate({ checklist: [...plan.checklist, { id: newId('chk'), text: text.trim(), done: false }] });
    setText('');
    soundService.playPop();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs font-bold text-zinc-500 dark:text-zinc-400">
        <span>Đồ cần chuẩn bị</span>
        <span>
          {done}/{plan.checklist.length} xong
        </span>
      </div>

      {plan.checklist.length === 0 && <p className="text-xs text-zinc-400 italic">Danh sách trống, thêm món đầu tiên nhé.</p>}

      <ul className="space-y-2">
        {plan.checklist.map((c) => (
          <li key={c.id} className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800">
            <button onClick={() => onUpdate({ checklist: plan.checklist.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)) })} aria-label="Đánh dấu">
              {c.done ? <CheckCircle2 className="w-6 h-6 text-emerald-500" /> : <Circle className="w-6 h-6 text-rose-300" />}
            </button>
            <span className={`flex-1 text-sm font-semibold text-zinc-800 dark:text-zinc-100 ${c.done ? 'line-through opacity-50' : ''}`}>{c.text}</span>
            <button onClick={() => onUpdate({ checklist: plan.checklist.filter((x) => x.id !== c.id) })} className="p-1 text-zinc-300 hover:text-red-500 transition" aria-label="Xóa">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={add} className="flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Thêm món cần mang..." className={inputCls} />
        <button type="submit" disabled={!text.trim()} className="px-4 rounded-xl bg-rose-500 hover:bg-rose-600 disabled:opacity-40 text-white font-bold text-sm transition">
          Thêm
        </button>
      </form>
    </div>
  );
};

/** "12k" / "1,5tr" / "2 triệu" / "1.500.000" / "=800000*2" -> number. Blank -> undefined. */
const parseMoneyInput = (raw: string): number | undefined => {
  const s = raw.trim().toLowerCase();
  if (!s) return undefined;
  if (s.startsWith('=')) {
    const v = evaluateSheet([[s]])[0][0];
    return typeof v === 'number' ? Math.round(v) : undefined;
  }
  const m = s.match(/^(.+?)\s*(k|nghìn|ngàn|tr|triệu|m)$/);
  if (m) {
    const base = parseNumber(m[1]);
    if (base !== null) return Math.round(base * (m[2] === 'k' || m[2] === 'nghìn' || m[2] === 'ngàn' ? 1_000 : 1_000_000));
  }
  const n = parseNumber(s);
  return n === null ? undefined : Math.round(n);
};

const MoneyInput: React.FC<{ value?: number; onCommit: (v: number | undefined) => void; placeholder?: string; cell?: boolean; onFocusCell?: () => void }> = ({ value, onCommit, placeholder = '0', cell = false, onFocusCell }) => {
  const fmt = (v?: number) => (v ? groupThousands(v) : '');
  const [draft, setDraft] = useState(fmt(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setDraft(fmt(value));
  }, [value, focused]);
  const commit = () => {
    setFocused(false);
    const next = parseMoneyInput(draft);
    setDraft(fmt(next));
    if (next !== value) onCommit(next);
  };
  return (
    <div className={cell ? 'relative w-full' : 'relative w-36 shrink-0'}>
      <input
        value={draft}
        inputMode="text"
        placeholder={placeholder}
        onFocus={() => {
          setFocused(true);
          onFocusCell?.();
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className={
          cell
            ? 'w-full pl-2 pr-6 py-2 bg-transparent border-0 text-sm font-semibold text-right tabular-nums text-zinc-800 dark:text-zinc-100 focus:ring-2 focus:ring-inset focus:ring-rose-400 focus:bg-white dark:focus:bg-zinc-900 placeholder:font-normal placeholder:text-zinc-300'
            : 'w-full pl-3 pr-7 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 text-sm font-bold text-right tabular-nums text-zinc-800 dark:text-zinc-100 focus:ring-2 focus:ring-rose-400 placeholder:font-normal placeholder:text-zinc-400'
        }
      />
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">đ</span>
    </div>
  );
};

type SheetRowKind = 'header' | 'stop' | 'daysum' | 'section' | 'extra' | 'extrasum' | 'total';
interface SheetRow {
  kind: SheetRowKind;
  cells: string[]; // A..E, raw text / formula — this is what the formula engine evaluates
  stop?: PlanStop;
  extra?: PlanExtraCost;
}

const SHEET_COLS = ['Ngày', 'Giờ', 'Hoạt động', 'Địa điểm', 'Chi phí (đ)', 'Người trả'];
const COST_COL = 4; // column E
const PAYER_COL = 5; // column F — a picker, not a number: sums only ever read column E

/** Excel-style cost table: rows come from the itinerary; sums are real =SUM() formulas evaluated by the sheet engine. */
const CostSheet: React.FC<{
  plan: TripPlan;
  onStopCost: (id: string, cost?: number) => void;
  onExtraLabel: (id: string, label: string) => void;
  onExtraAmount: (id: string, amount?: number) => void;
  onExtraRemove: (id: string) => void;
  onExtraAdd: (label: string) => void;
  onStopPayer: (id: string, paidBy?: string) => void;
  onExtraPayer: (id: string, paidBy?: string) => void;
}> = ({ plan, onStopCost, onExtraLabel, onExtraAmount, onExtraRemove, onExtraAdd, onStopPayer, onExtraPayer }) => {
  const [selected, setSelected] = useState<{ r: number; c: number } | null>(null);
  const [extraLabel, setExtraLabel] = useState('');
  const extras = plan.extraCosts || [];

  const rows: SheetRow[] = [{ kind: 'header', cells: [...SHEET_COLS] }];
  const sumRows: number[] = []; // 1-based row numbers of the subtotal rows
  const rowNo = () => rows.length + 1;
  const E = (n: number) => `E${n}`;

  const dayNumbers = Array.from(new Set<number>(plan.stops.map((s) => s.day))).sort((a, b) => a - b);
  for (const d of dayNumbers) {
    const first = rowNo();
    plan.stops
      .filter((s) => s.day === d)
      .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'))
      .forEach((raw) => {
        const s = resolveStop(raw);
        rows.push({ kind: 'stop', stop: raw, cells: [`Ngày ${d}`, s.time || '', s.title, s.place && !/^https?:/i.test(s.place) ? s.place : '', s.cost ? String(s.cost) : '', ''] });
      });
    const last = rowNo() - 1;
    sumRows.push(rowNo());
    rows.push({ kind: 'daysum', cells: ['', '', `Cộng ngày ${d}`, '', `=SUM(${E(first)}:${E(last)})`, ''] });
  }

  rows.push({ kind: 'section', cells: ['', '', 'CHI PHÍ KHÁC', '', '', ''] });
  if (extras.length > 0) {
    const first = rowNo();
    extras.forEach((x) => rows.push({ kind: 'extra', extra: x, cells: ['', '', x.label, '', x.amount ? String(x.amount) : '', ''] }));
    const last = rowNo() - 1;
    sumRows.push(rowNo());
    rows.push({ kind: 'extrasum', cells: ['', '', 'Cộng chi phí khác', '', `=SUM(${E(first)}:${E(last)})`, ''] });
  }
  rows.push({ kind: 'total', cells: ['', '', 'TỔNG CỘNG', '', sumRows.length ? `=${sumRows.map(E).join('+')}` : '=0', ''] });

  const values = evaluateSheet(rows.map((r) => r.cells));
  const selCell = selected ? rows[selected.r]?.cells[selected.c] : undefined;
  const selVal = selected ? values[selected.r]?.[selected.c] : undefined;

  const rowStyle: Record<SheetRowKind, string> = {
    header: 'bg-rose-100 dark:bg-rose-950/40 font-extrabold text-rose-700 dark:text-rose-300',
    stop: '',
    daysum: 'bg-amber-50 dark:bg-amber-950/20 font-bold',
    section: 'bg-zinc-100 dark:bg-zinc-800 font-extrabold text-zinc-600 dark:text-zinc-300',
    extra: '',
    extrasum: 'bg-amber-50 dark:bg-amber-950/20 font-bold',
    total: 'bg-emerald-50 dark:bg-emerald-950/25 font-extrabold text-emerald-700 dark:text-emerald-300 border-t-2 border-double border-emerald-400',
  };
  const cell = 'border-r border-t border-zinc-200 dark:border-zinc-700 px-2.5 py-2 align-middle';

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-100">Bảng chi phí</h4>
        <span className="text-[11px] text-zinc-400">Hoạt động tự lấy từ Lịch trình · gõ 50k, 1,5tr hoặc =2*300000</span>
      </div>

      {/* Formula bar */}
      <div className="flex items-center gap-2 mb-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 px-2.5 py-1.5 text-xs">
        <span className="shrink-0 w-10 text-center font-bold text-zinc-500">{selected ? `${colName(selected.c)}${selected.r + 1}` : '—'}</span>
        <span className="text-zinc-300">|</span>
        <span className="shrink-0 italic font-serif text-zinc-400">fx</span>
        <span className="min-w-0 truncate font-mono text-zinc-700 dark:text-zinc-200">
          {selected ? selCell || <span className="text-zinc-300">(trống)</span> : 'Bấm vào một ô để xem công thức'}
        </span>
        {selected && selCell?.startsWith('=') && <span className="ml-auto shrink-0 font-bold text-emerald-600 tabular-nums">= {displayValue(selVal ?? '')}</span>}
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-300 dark:border-zinc-600">
        <table className="w-full border-collapse text-sm min-w-[680px]">
          <thead>
            <tr className="bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold text-zinc-400">
              <th className="w-9 border-r border-zinc-200 dark:border-zinc-700" />
              {SHEET_COLS.map((_, c) => (
                <th key={c} className="border-r border-zinc-200 dark:border-zinc-700 py-1">
                  {colName(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => {
              const isSelectedRow = selected?.r === r;
              return (
                <tr key={`${row.kind}-${row.stop?.id || row.extra?.id || r}`} className={`group ${rowStyle[row.kind]}`}>
                  <td className={`relative w-9 text-center text-[10px] font-normal select-none bg-zinc-50 dark:bg-zinc-800 text-zinc-400 border-r border-t border-zinc-200 dark:border-zinc-700 ${isSelectedRow ? '!bg-rose-100 !text-rose-600 font-bold' : ''}`}>
                    {row.kind === 'extra' && row.extra ? (
                      <>
                        <span className="group-hover:hidden">{r + 1}</span>
                        <button type="button" onClick={() => onExtraRemove(row.extra!.id)} className="hidden group-hover:inline text-zinc-400 hover:text-red-500" aria-label="Xóa khoản chi">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </>
                    ) : (
                      r + 1
                    )}
                  </td>
                  {row.cells.map((raw, c) => {
                    const isCost = c === COST_COL;
                    const val = values[r]?.[c];
                    const isFormula = raw.startsWith('=');
                    const pick = () => setSelected({ r, c });
                    const isSel = selected?.r === r && selected?.c === c;
                    const ring = isSel ? 'outline outline-2 -outline-offset-2 outline-rose-400' : '';

                    if (c === PAYER_COL && (row.kind === 'stop' || row.kind === 'extra')) {
                      const paidBy = row.kind === 'stop' ? row.stop?.paidBy : row.extra?.paidBy;
                      return (
                        <td key={c} className={`${cell} p-0 w-[128px] ${ring}`} onClick={pick}>
                          <PayerSelect
                            value={paidBy}
                            onChange={(next) => (row.kind === 'stop' ? onStopPayer(row.stop!.id, next) : onExtraPayer(row.extra!.id, next))}
                            className="px-2 py-2"
                          />
                        </td>
                      );
                    }
                    if (row.kind === 'stop' && isCost && row.stop) {
                      return (
                        <td key={c} className={`${cell} p-0 ${ring}`} onClick={pick}>
                          <MoneyInput cell value={parseNumber(raw) ?? undefined} onCommit={(v) => onStopCost(row.stop!.id, v)} onFocusCell={pick} />
                        </td>
                      );
                    }
                    if (row.kind === 'extra' && row.extra) {
                      if (isCost) {
                        return (
                          <td key={c} className={`${cell} p-0 ${ring}`} onClick={pick}>
                            <MoneyInput cell value={row.extra.amount} onCommit={(v) => onExtraAmount(row.extra!.id, v)} onFocusCell={pick} />
                          </td>
                        );
                      }
                      if (c === 2) {
                        return (
                          <td key={c} className={`${cell} p-0 ${ring}`} onClick={pick}>
                            <input
                              defaultValue={raw}
                              onFocus={pick}
                              onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== raw && onExtraLabel(row.extra!.id, e.target.value.trim())}
                              className="w-full px-2.5 py-2 bg-transparent border-0 text-sm text-zinc-800 dark:text-zinc-100 focus:ring-2 focus:ring-inset focus:ring-rose-400"
                            />
                          </td>
                        );
                      }
                    }

                    const shown = isFormula ? displayValue(val ?? '') : raw;
                    return (
                      <td key={c} onClick={pick} className={`${cell} ${ring} ${isCost ? 'text-right tabular-nums' : ''} ${c <= 1 ? 'text-zinc-500 dark:text-zinc-400 whitespace-nowrap' : ''}`}>
                        {c === 3 ? <span className="block max-w-[220px] truncate text-zinc-500 dark:text-zinc-400" title={shown}>{shown}</span> : shown}
                        {isCost && isFormula && !isErrorValue(val) ? <span className="ml-1 text-xs opacity-60">đ</span> : null}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {plan.stops.length === 0 && (
        <p className="text-[11px] text-zinc-400 italic mt-2">Chưa có hoạt động nào: thêm ở tab Lịch trình, các dòng sẽ tự xuất hiện ở đây để bạn điền chi phí.</p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!extraLabel.trim()) return;
          onExtraAdd(extraLabel.trim());
          setExtraLabel('');
        }}
        className="flex gap-2 mt-2.5"
      >
        <input value={extraLabel} onChange={(e) => setExtraLabel(e.target.value)} placeholder="Thêm dòng chi phí khác: khách sạn, vé máy bay, xăng xe..." className={inputCls} />
        <button type="submit" disabled={!extraLabel.trim()} className="px-4 rounded-xl bg-rose-500 hover:bg-rose-600 disabled:opacity-40 text-white font-bold text-sm transition whitespace-nowrap">
          Thêm dòng
        </button>
      </form>
    </div>
  );
};

const CostTab: React.FC<{ plan: TripPlan; onUpdate: (u: Partial<TripPlan>) => void }> = ({ plan, onUpdate }) => {
  const extras = plan.extraCosts || [];

  const stopsTotal = plan.stops.reduce((sum, s) => sum + (resolveStop(s).cost || 0), 0);
  const extrasTotal = extras.reduce((sum, x) => sum + (x.amount || 0), 0);
  const total = stopsTotal + extrasTotal;
  const pct = plan.budget ? Math.min(100, Math.round((total / plan.budget) * 100)) : 0;
  const over = plan.budget ? total > plan.budget : false;

  // Cost belongs to whichever option is currently ticked for that activity; who paid belongs to the activity.
  const setStopCost = (id: string, cost?: number) => onUpdate({ stops: plan.stops.map((s) => (s.id === id ? patchActiveOption(s, { cost }) : s)) });
  const setStopPayer = (id: string, paidBy?: string) => onUpdate({ stops: plan.stops.map((s) => (s.id === id ? { ...s, paidBy } : s)) });
  const payments = [
    ...plan.stops.map((s) => ({ amount: resolveStop(s).cost || 0, paidBy: s.paidBy })),
    ...extras.map((x) => ({ amount: x.amount || 0, paidBy: x.paidBy })),
  ];
  const setExtra = (id: string, updates: Partial<PlanExtraCost>) => onUpdate({ extraCosts: extras.map((x) => (x.id === id ? { ...x, ...updates } : x)) });

  // Plans made before this tab existed keep their plain notes / blocks; show them as content blocks.
  const blocks: PlanBlock[] = plan.blocks ?? (plan.notes?.trim() ? [{ id: 'legacy_notes', type: 'text', html: escapeToHtml(plan.notes) }] : []);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400">Tổng chi phí</p>
            <p className="text-3xl font-extrabold text-zinc-800 dark:text-zinc-100 tabular-nums">{formatVND(total)}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1">Ngân sách dự kiến</p>
            <MoneyInput value={plan.budget} onCommit={(budget) => onUpdate({ budget })} placeholder="Chưa đặt" />
          </div>
        </div>
        {plan.budget ? (
          <div>
            <div className="h-3 rounded-full bg-white dark:bg-zinc-800 overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${over ? 'bg-red-500' : 'bg-gradient-to-r from-amber-400 to-rose-400'}`} style={{ width: `${pct}%` }} />
            </div>
            <p className={`text-xs font-bold mt-1.5 ${over ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {over ? `Vượt ngân sách ${formatVND(total - plan.budget)}` : `Còn lại ${formatVND(plan.budget - total)} (${100 - pct}%)`}
            </p>
          </div>
        ) : null}
        <PayerSummary items={payments} className="!bg-white/80 dark:!bg-zinc-800/70" />
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: 'Hoạt động', value: stopsTotal },
            { label: 'Chi phí khác', value: extrasTotal },
            { label: 'Mỗi người (÷2)', value: total / 2 },
          ].map((c) => (
            <div key={c.label} className="rounded-xl bg-white/80 dark:bg-zinc-800/70 py-2 px-1">
              <p className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">{c.label}</p>
              <p className="text-sm font-extrabold text-zinc-800 dark:text-zinc-100 tabular-nums">{formatVND(c.value)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Excel-style cost table, rows synced from the itinerary */}
      <CostSheet
        plan={plan}
        onStopCost={setStopCost}
        onExtraLabel={(id, label) => setExtra(id, { label })}
        onExtraAmount={(id, amount) => setExtra(id, { amount })}
        onExtraRemove={(id) => onUpdate({ extraCosts: extras.filter((x) => x.id !== id) })}
        onExtraAdd={(label) => {
          onUpdate({ extraCosts: [...extras, { id: newId('cost'), label }] });
          soundService.playPop();
        }}
        onStopPayer={setStopPayer}
        onExtraPayer={(id, paidBy) => setExtra(id, { paidBy })}
      />

      {/* Free-form notes, checklists, formula tables and option comparisons */}
      <div>
        <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 mb-2 flex items-center gap-1.5">
          <NotebookPen className="w-4 h-4 text-rose-400" /> Ghi chú & bảng tính thêm
        </h4>
        <PlanBlocksEditor blocks={blocks} onChange={(next) => onUpdate({ blocks: next })} />
      </div>
    </div>
  );
};
