import React, { useEffect, useMemo, useState } from 'react';
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
  Route,
  Plane,
  Sparkles,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useCouple } from '../context/CoupleContext';
import { TripPlan, PlanStop, PlanBlock, PlanExtraCost } from '../types';
import { THEMES } from '../utils/theme';
import { soundService } from '../services/sound';
import { formatDateVN } from '../utils/date';
import { DateInputVN } from '../components/DateInputVN';
import { PlanBlocksEditor, escapeToHtml } from '../components/PlanBlocks';
import { PlaceActions, PlacePickButton } from '../components/PlaceTools';
import { safeUrl } from '../utils/maps';
import { evaluateSheet, parseNumber } from '../utils/sheet';

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

const formatVND = (n: number) => `${Math.round(n).toLocaleString('vi-VN')}đ`;

const parseMoney = (raw: string): number | undefined => {
  const digits = raw.replace(/[^\d]/g, '');
  return digits ? Number(digits) : undefined;
};

const dayMs = 24 * 60 * 60 * 1000;
const toLocalMidnight = (iso: string) => new Date(`${iso}T00:00:00`).getTime();

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
  plan.stops.reduce((sum, s) => sum + (s.cost || 0), 0) + (plan.extraCosts || []).reduce((sum, x) => sum + (x.amount || 0), 0);

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
                    <span className="text-4xl drop-shadow group-hover:scale-110 transition-transform">{plan.emoji}</span>
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
                      <span>Chuẩn bị {progress}%</span>
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
            onDelete={() => {
              if (window.confirm(`Xóa kế hoạch "${selectedPlan.title}"?`)) {
                deletePlan(selectedPlan.id);
                setSelectedId(null);
              }
            }}
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

const ModalShell: React.FC<{ onClose: () => void; children: React.ReactNode; wide?: boolean }> = ({ onClose, children, wide }) => (
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
      className={`relative w-full ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'} max-h-[92vh] overflow-y-auto bg-white dark:bg-zinc-900 rounded-t-[32px] sm:rounded-[32px] shadow-2xl border border-rose-100 dark:border-zinc-800`}
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
            <input inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="5.000.000" className={inputCls} />
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
    <ModalShell onClose={onClose} wide>
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
            <span>Tiến độ chuẩn bị</span>
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
        <button onClick={onDelete} className="flex items-center gap-1 font-semibold text-zinc-400 hover:text-red-500 transition">
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

const ItineraryTab: React.FC<{ plan: TripPlan; duration: number; onUpdate: (u: Partial<TripPlan>) => void }> = ({ plan, duration, onUpdate }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [lastDay, setLastDay] = useState(1);

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
    soundService.playPop();
  };

  const saveStop = (id: string, d: StopDraft) => {
    onUpdate({ stops: plan.stops.map((s) => (s.id === id ? { ...s, ...draftToFields(d) } : s)) });
    setEditingId(null);
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

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        {days.map((d) => {
          const stops = plan.stops
            .filter((s) => s.day === d)
            .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
          return (
            <div key={d}>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-3 py-1 rounded-full bg-gradient-to-r from-[#FF758F] to-[#FF9A9E] text-white text-xs font-extrabold">Ngày {d}</span>
                <span className="text-[11px] text-zinc-400">{dateOfDay(d)}</span>
              </div>
              {stops.length === 0 ? (
                <p className="text-xs text-zinc-400 pl-2 italic">Chưa có hoạt động nào.</p>
              ) : (
                <ol className="relative ml-3 border-l-2 border-dashed border-rose-200 dark:border-rose-900/60 space-y-2.5">
                  {stops.map((s) => (
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
                              <p className={`text-sm font-bold text-zinc-800 dark:text-zinc-100 ${s.done ? 'line-through' : ''}`}>{s.title}</p>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                {s.time && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> {s.time}
                                  </span>
                                )}
                                {s.place && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" /> {s.place}
                                  </span>
                                )}
                              </div>
                              <PlaceActions place={{ name: s.place, lat: s.lat, lng: s.lng, reviewUrl: s.reviewUrl }} className="mt-1.5" />
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
                  ))}
                </ol>
              )}
            </div>
          );
        })}
      </div>

      <StopForm days={days} defaultDay={lastDay} submitLabel="Thêm" onSubmit={addStop} key={`add-${lastDay}`} />
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

const MoneyInput: React.FC<{ value?: number; onCommit: (v: number | undefined) => void; placeholder?: string }> = ({ value, onCommit, placeholder = '0' }) => {
  const fmt = (v?: number) => (v ? v.toLocaleString('vi-VN') : '');
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
    <div className="relative w-36 shrink-0">
      <input
        value={draft}
        inputMode="text"
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className="w-full pl-3 pr-7 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 text-sm font-bold text-right tabular-nums text-zinc-800 dark:text-zinc-100 focus:ring-2 focus:ring-rose-400 placeholder:font-normal placeholder:text-zinc-400"
      />
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">đ</span>
    </div>
  );
};

const CostTab: React.FC<{ plan: TripPlan; onUpdate: (u: Partial<TripPlan>) => void }> = ({ plan, onUpdate }) => {
  const [extraLabel, setExtraLabel] = useState('');
  const extras = plan.extraCosts || [];

  const stopsTotal = plan.stops.reduce((sum, s) => sum + (s.cost || 0), 0);
  const extrasTotal = extras.reduce((sum, x) => sum + (x.amount || 0), 0);
  const total = stopsTotal + extrasTotal;
  const pct = plan.budget ? Math.min(100, Math.round((total / plan.budget) * 100)) : 0;
  const over = plan.budget ? total > plan.budget : false;

  const dayNumbers = Array.from(new Set<number>(plan.stops.map((s) => s.day))).sort((a, b) => a - b);
  const dateOfDay = (d: number) => {
    const t = toLocalMidnight(plan.startDate);
    return isNaN(t) ? '' : formatDateVN(new Date(t + (d - 1) * dayMs));
  };

  const setStopCost = (id: string, cost?: number) => onUpdate({ stops: plan.stops.map((s) => (s.id === id ? { ...s, cost } : s)) });
  const setExtra = (id: string, updates: Partial<PlanExtraCost>) => onUpdate({ extraCosts: extras.map((x) => (x.id === id ? { ...x, ...updates } : x)) });

  const addExtra = (e: React.FormEvent) => {
    e.preventDefault();
    if (!extraLabel.trim()) return;
    onUpdate({ extraCosts: [...extras, { id: newId('cost'), label: extraLabel.trim() }] });
    setExtraLabel('');
    soundService.playPop();
  };

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

      {/* Costs pulled from the itinerary */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-100">Chi phí theo lịch trình</h4>
          <span className="text-[11px] text-zinc-400">Tự lấy từ tab Lịch trình · gõ 50k, 1,5tr hoặc =2*300000</span>
        </div>
        {plan.stops.length === 0 ? (
          <p className="text-xs text-zinc-400 italic p-4 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-700 text-center">
            Chưa có hoạt động nào. Thêm hoạt động ở tab Lịch trình, chúng sẽ tự xuất hiện ở đây để bạn điền chi phí.
          </p>
        ) : (
          <div className="space-y-4">
            {dayNumbers.map((d) => {
              const stops = plan.stops.filter((s) => s.day === d).sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
              const daySum = stops.reduce((sum, s) => sum + (s.cost || 0), 0);
              return (
                <div key={d} className="rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                  <div className="flex items-center justify-between px-3.5 py-2 bg-rose-50 dark:bg-rose-950/30">
                    <span className="text-xs font-extrabold text-rose-600 dark:text-rose-300">
                      Ngày {d} <span className="font-medium text-rose-400">{dateOfDay(d)}</span>
                    </span>
                    <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300 tabular-nums">{formatVND(daySum)}</span>
                  </div>
                  <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {stops.map((s) => (
                      <li key={s.id} className="flex items-center gap-3 px-3.5 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 truncate">{s.title}</p>
                          <p className="text-[11px] text-zinc-400 truncate">
                            {[s.time, s.place].filter(Boolean).join(' · ') || '—'}
                          </p>
                        </div>
                        <MoneyInput value={s.cost} onCommit={(v) => setStopCost(s.id, v)} />
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Extra costs */}
      <div>
        <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 mb-2">Chi phí khác</h4>
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
          {extras.length > 0 && (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {extras.map((x) => (
                <li key={x.id} className="flex items-center gap-3 px-3.5 py-2.5">
                  <input
                    defaultValue={x.label}
                    onBlur={(e) => e.target.value.trim() !== x.label && setExtra(x.id, { label: e.target.value.trim() || x.label })}
                    className="flex-1 min-w-0 bg-transparent border-0 p-0 text-sm font-semibold text-zinc-800 dark:text-zinc-100 focus:ring-0"
                  />
                  <MoneyInput value={x.amount} onCommit={(v) => setExtra(x.id, { amount: v })} />
                  <button onClick={() => onUpdate({ extraCosts: extras.filter((e) => e.id !== x.id) })} className="p-1 text-zinc-300 hover:text-red-500" aria-label="Xóa khoản chi">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={addExtra} className="flex gap-2 p-2.5 bg-zinc-50 dark:bg-zinc-800/50">
            <input value={extraLabel} onChange={(e) => setExtraLabel(e.target.value)} placeholder="Thêm khoản: khách sạn, vé máy bay, xăng xe..." className={inputCls} />
            <button type="submit" disabled={!extraLabel.trim()} className="px-4 rounded-xl bg-rose-500 hover:bg-rose-600 disabled:opacity-40 text-white font-bold text-sm transition whitespace-nowrap">
              Thêm
            </button>
          </form>
        </div>
      </div>

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
