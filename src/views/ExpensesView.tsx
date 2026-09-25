import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, Plane, CalendarDays, Sparkles, X, Wallet, Receipt, TrendingUp } from 'lucide-react';
import { useCouple } from '../context/CoupleContext';
import { DatingExpense, ExpenseCategoryId } from '../types';
import { THEMES } from '../utils/theme';
import { soundService } from '../services/sound';
import { DateInputVN } from '../components/DateInputVN';
import {
  EXPENSE_CATEGORIES,
  PICKER_ORDER,
  ExpenseRow,
  PeriodKind,
  bucketsOf,
  formatLongDate,
  formatVND,
  formatVNDShort,
  getCategory,
  inPeriod,
  manualRows,
  periodOf,
  planRows,
  shiftAnchor,
  todayISO,
} from '../utils/expenses';

const PERIODS: { id: PeriodKind; label: string }[] = [
  { id: 'day', label: 'Ngày' },
  { id: 'week', label: 'Tuần' },
  { id: 'month', label: 'Tháng' },
  { id: 'year', label: 'Năm' },
];

const PLAN_TOGGLE_KEY = 'lovesync_fees_include_plans';

const readPlanToggle = () => {
  try {
    return localStorage.getItem(PLAN_TOGGLE_KEY) !== '0';
  } catch {
    return true;
  }
};

/** Sum of each category, in the fixed category order (so colours never move with rank). */
const sumByCategory = (rows: ExpenseRow[]) => {
  const totals = new Map<ExpenseCategoryId, number>();
  rows.forEach((r) => totals.set(r.category, (totals.get(r.category) || 0) + r.amount));
  return EXPENSE_CATEGORIES.map((c) => ({ category: c, amount: totals.get(c.id) || 0 })).filter((x) => x.amount > 0);
};

/* ------------------------------------------------------------------ small pieces */

const CategoryBadge: React.FC<{ id: ExpenseCategoryId; color: string; size?: 'sm' | 'md' | 'lg' }> = ({ id, color, size = 'md' }) => {
  const c = getCategory(id);
  const box = size === 'lg' ? 'w-14 h-14 text-3xl rounded-2xl' : size === 'sm' ? 'w-8 h-8 text-base rounded-xl' : 'w-11 h-11 text-2xl rounded-2xl';
  return (
    <span className={`${box} ${c.tile} shrink-0 flex items-center justify-center shadow-sm`} style={{ boxShadow: `inset 0 0 0 2px ${color}33` }}>
      <span className="drop-shadow-sm">{c.emoji}</span>
    </span>
  );
};

/** One bar split into the period's categories, in fixed category order, with a 2px gap between segments. */
const CompositionStrip: React.FC<{ parts: { category: (typeof EXPENSE_CATEGORIES)[number]; amount: number }[]; total: number; isDark: boolean }> = ({
  parts,
  total,
  isDark,
}) => {
  const [hover, setHover] = useState<string | null>(null);
  if (total <= 0) return null;
  const hovered = parts.find((p) => p.category.id === hover);
  return (
    <div className="relative">
      <div className="flex h-4 w-full gap-[2px] rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        {parts.map((p) => (
          <div
            key={p.category.id}
            onMouseEnter={() => setHover(p.category.id)}
            onMouseLeave={() => setHover(null)}
            className="h-full transition-opacity cursor-default"
            style={{
              width: `${(p.amount / total) * 100}%`,
              minWidth: 4,
              backgroundColor: isDark ? p.category.dark : p.category.light,
              opacity: hover && hover !== p.category.id ? 0.45 : 1,
            }}
          />
        ))}
      </div>
      {hovered && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 rounded-xl bg-zinc-900 text-white text-xs font-semibold whitespace-nowrap shadow-lg pointer-events-none">
          {hovered.category.emoji} {hovered.category.label}: {formatVND(hovered.amount)} · {Math.round((hovered.amount / total) * 100)}%
        </div>
      )}
    </div>
  );
};

/** Stacked bars per slice of the period (days of a week/month, months of a year), same fixed category order. */
const TrendChart: React.FC<{ kind: PeriodKind; rows: ExpenseRow[]; period: { start: string; end: string }; isDark: boolean }> = ({ kind, rows, period, isDark }) => {
  const [hover, setHover] = useState<number | null>(null);
  const buckets = useMemo(() => bucketsOf(kind, { ...period, label: '' }), [kind, period]);
  const data = useMemo(
    () =>
      buckets.map((b) => {
        const inside = rows.filter((r) => r.date >= b.start && r.date <= b.end);
        const parts = sumByCategory(inside);
        return { bucket: b, parts, total: parts.reduce((s, p) => s + p.amount, 0) };
      }),
    [buckets, rows]
  );
  const max = Math.max(0, ...data.map((d) => d.total));
  if (buckets.length === 0) return null;

  const showTick = (i: number) => kind !== 'month' || i === 0 || (i + 1) % 5 === 0 || i === buckets.length - 1;

  return (
    <div>
      <div className="relative h-44">
        {/* recessive guide lines: top = the period's biggest slice */}
        <div className="absolute inset-x-0 top-0 border-t border-dashed border-zinc-200 dark:border-zinc-800" />
        <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-zinc-100 dark:border-zinc-800/60" />
        <span className="absolute -top-2.5 right-0 text-[10px] font-semibold text-zinc-400 bg-white/80 dark:bg-zinc-900/80 px-1 rounded">{max > 0 ? formatVNDShort(max) : ''}</span>

        <div className="absolute inset-0 flex items-end gap-[3px] sm:gap-1.5 pt-3">
          {data.map((d, i) => (
            <div
              key={d.bucket.key}
              className="relative flex-1 h-full flex items-end justify-center cursor-default"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onClick={() => setHover(hover === i ? null : i)}
            >
              {d.total > 0 ? (
                <div
                  className="w-full max-w-[26px] flex flex-col-reverse gap-[2px] rounded-t-[4px] overflow-hidden transition-opacity"
                  style={{ height: `${Math.max(4, (d.total / max) * 100)}%`, opacity: hover !== null && hover !== i ? 0.45 : 1 }}
                >
                  {d.parts.map((p) => (
                    <div key={p.category.id} style={{ height: `${(p.amount / d.total) * 100}%`, minHeight: 2, backgroundColor: isDark ? p.category.dark : p.category.light }} />
                  ))}
                </div>
              ) : (
                <div className="w-full max-w-[26px] h-[3px] rounded-full bg-zinc-100 dark:bg-zinc-800" />
              )}

              {hover === i && (
                <div
                  className={`absolute top-0 z-20 w-48 p-2.5 rounded-2xl bg-zinc-900/95 text-white shadow-xl pointer-events-none ${
                    i < buckets.length / 3 ? 'left-0' : i > (buckets.length * 2) / 3 ? 'right-0' : 'left-1/2 -translate-x-1/2'
                  }`}
                >
                  <p className="text-[11px] font-semibold text-white/70">{d.bucket.title}</p>
                  <p className="text-sm font-extrabold">{d.total > 0 ? formatVND(d.total) : 'Không chi gì'}</p>
                  {d.parts
                    .slice()
                    .sort((a, b) => b.amount - a.amount)
                    .slice(0, 4)
                    .map((p) => (
                      <p key={p.category.id} className="text-[11px] flex items-center justify-between gap-2 mt-0.5">
                        <span className="flex items-center gap-1.5 min-w-0">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: isDark ? p.category.dark : p.category.light }} />
                          <span className="truncate">{p.category.label}</span>
                        </span>
                        <span className="font-bold tabular-nums">{formatVNDShort(p.amount)}</span>
                      </p>
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-[3px] sm:gap-1.5 mt-1.5">
        {buckets.map((b, i) => (
          <span key={b.key} className="flex-1 text-center text-[10px] font-semibold text-zinc-400 tabular-nums">
            {showTick(i) ? b.label : ''}
          </span>
        ))}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ add / edit */

const QUICK_AMOUNTS = [50_000, 100_000, 200_000, 500_000];

const ExpenseModal: React.FC<{
  initial?: DatingExpense;
  defaultDate: string;
  isDark: boolean;
  onClose: () => void;
  onSave: (data: { date: string; title: string; amount: number; category: ExpenseCategoryId; note?: string }) => void;
  onDelete?: () => void;
}> = ({ initial, defaultDate, isDark, onClose, onSave, onDelete }) => {
  const [category, setCategory] = useState<ExpenseCategoryId>(initial?.category || 'food');
  const [amount, setAmount] = useState<number>(initial?.amount || 0);
  const [title, setTitle] = useState(initial?.title || '');
  const [date, setDate] = useState(initial?.date || defaultDate);
  const [note, setNote] = useState(initial?.note || '');
  const cat = getCategory(category);
  const color = isDark ? cat.dark : cat.light;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0 || !date) return;
    onSave({ date, title: title.trim() || cat.label, amount, category, note: note.trim() || undefined });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-md"
    >
      <motion.form
        onSubmit={submit}
        initial={{ y: 60, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-white dark:bg-zinc-900 rounded-t-[32px] sm:rounded-[32px] shadow-2xl border border-rose-100 dark:border-zinc-800"
      >
        {/* header echoes the chosen category */}
        <div className="relative px-5 pt-5 pb-4 overflow-hidden">
          <div className="absolute -top-16 -right-10 w-48 h-48 rounded-full blur-3xl opacity-30" style={{ backgroundColor: color }} />
          <button type="button" onClick={onClose} className="absolute top-3 right-3 p-2 rounded-full text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
            <X className="w-4 h-4" />
          </button>
          <div className="relative flex items-center gap-3">
            <CategoryBadge id={category} color={color} size="lg" />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">{initial ? 'Sửa khoản chi' : 'Thêm khoản chi'}</p>
              <h3 className="font-cute font-bold text-xl text-zinc-800 dark:text-zinc-100">{cat.label}</h3>
            </div>
          </div>

          {/* the amount is the point of the form, so it is the biggest thing on it */}
          <div className="relative mt-4 rounded-3xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-700 px-4 py-3">
            <label className="text-[11px] font-bold text-zinc-500">Số tiền</label>
            <div className="flex items-baseline gap-1">
              <input
                autoFocus
                inputMode="numeric"
                value={amount ? amount.toLocaleString('vi-VN') : ''}
                onChange={(e) => setAmount(Number(e.target.value.replace(/\D/g, '')) || 0)}
                placeholder="0"
                className="w-full bg-transparent border-0 p-0 focus:ring-0 text-3xl font-extrabold text-zinc-900 dark:text-white tabular-nums placeholder:text-zinc-300"
              />
              <span className="text-xl font-extrabold text-zinc-400">đ</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {QUICK_AMOUNTS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setAmount((a) => a + q)}
                  className="px-2.5 py-1 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-[11px] font-bold text-zinc-600 dark:text-zinc-300 hover:border-rose-300 transition"
                >
                  +{formatVNDShort(q)}
                </button>
              ))}
              {amount > 0 && (
                <button type="button" onClick={() => setAmount(0)} className="px-2.5 py-1 rounded-full text-[11px] font-bold text-zinc-400 hover:text-red-500">
                  Xóa số
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="px-5 pb-5 space-y-4">
          <div>
            <p className="text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-2">Danh mục</p>
            <div className="grid grid-cols-3 gap-2">
              {PICKER_ORDER.map((id) => {
                const c = getCategory(id);
                const on = id === category;
                const cColor = isDark ? c.dark : c.light;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      soundService.playPop();
                      setCategory(id);
                    }}
                    className={`flex flex-col items-center gap-1 py-2.5 rounded-2xl border-2 transition ${
                      on ? 'bg-white dark:bg-zinc-800 scale-[1.03] shadow-md' : 'border-transparent bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                    style={on ? { borderColor: cColor } : undefined}
                  >
                    <span className="text-2xl">{c.emoji}</span>
                    <span className={`text-[11px] font-bold ${on ? 'text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400'}`}>{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">Chi cho gì</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`VD: ${category === 'food' ? 'Lẩu nướng tối thứ 7' : category === 'cafe' ? 'Trà sữa sau giờ làm' : category === 'movie' ? '2 vé + bắp nước' : cat.label}`}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 text-sm font-semibold text-zinc-800 dark:text-zinc-100 focus:ring-2 focus:ring-rose-400 placeholder:font-normal placeholder:text-zinc-400"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">Ngày</label>
              <DateInputVN value={date} onChange={setDate} showFormatHint={false} inputClassName="!py-2.5 !rounded-xl !bg-zinc-100 dark:!bg-zinc-800 !border-0 font-semibold" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">Ghi chú (không bắt buộc)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Ở đâu, với ai, có gì đáng nhớ..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 text-sm text-zinc-800 dark:text-zinc-100 focus:ring-2 focus:ring-rose-400 placeholder:text-zinc-400 resize-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="px-4 py-3 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-500 font-bold text-sm hover:bg-red-500 hover:text-white transition flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" /> Xóa
              </button>
            )}
            <button
              type="submit"
              disabled={amount <= 0 || !date}
              className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-[#FF758F] to-[#FF9A9E] text-white font-extrabold text-sm shadow-md shadow-rose-200 dark:shadow-rose-950 disabled:opacity-40 transition active:scale-[0.98]"
            >
              {initial ? 'Lưu thay đổi' : `Thêm ${amount > 0 ? formatVND(amount) : 'khoản chi'}`}
            </button>
          </div>
        </div>
      </motion.form>
    </motion.div>
  );
};

/* ------------------------------------------------------------------ the page */

export const ExpensesView: React.FC = () => {
  const { datingExpenses = [], plans = [], settings, addExpense, updateExpense, deleteExpense } = useCouple();
  const currentTheme = THEMES[settings.theme] || THEMES.sakura;
  const isDark = !!settings.isDarkMode;
  const colorOf = (id: ExpenseCategoryId) => (isDark ? getCategory(id).dark : getCategory(id).light);

  const [kind, setKind] = useState<PeriodKind>('month');
  const [anchor, setAnchor] = useState<string>(todayISO);
  const [includePlans, setIncludePlans] = useState<boolean>(readPlanToggle);
  const [editing, setEditing] = useState<DatingExpense | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const period = useMemo(() => periodOf(kind, anchor), [kind, anchor]);

  const toggleIncludePlans = () => {
    setIncludePlans((v) => {
      try {
        localStorage.setItem(PLAN_TOGGLE_KEY, v ? '0' : '1');
      } catch {}
      return !v;
    });
  };

  // Everything, all dates: hand-entered spends, plus trip-plan costs that fall on a day that has
  // Dating Fees entries of its own. A planned cost the user also logged by hand (same day, same
  // amount, same kind) is shown once, as their own entry.
  const allRows = useMemo(() => {
    const mine = manualRows(datingExpenses);
    if (!includePlans) return mine;
    const loggedDays = new Set(mine.map((r) => r.date));
    const seen = new Set(mine.map((r) => `${r.date}|${r.amount}|${r.category}`));
    const fromPlans = planRows(plans).filter((r) => loggedDays.has(r.date) && !seen.has(`${r.date}|${r.amount}|${r.category}`));
    return [...mine, ...fromPlans];
  }, [datingExpenses, plans, includePlans]);

  const rows = useMemo(() => allRows.filter((r) => inPeriod(r, period)).sort((a, b) => (a.date === b.date ? b.amount - a.amount : b.date.localeCompare(a.date))), [allRows, period]);
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const parts = useMemo(() => sumByCategory(rows), [rows]);
  const ranked = useMemo(() => parts.slice().sort((a, b) => b.amount - a.amount), [parts]);
  const outings = new Set(rows.map((r) => r.date)).size;
  const topCategory = ranked[0];
  const planCount = rows.filter((r) => r.source === 'plan').length;

  // Same period one step back, for a gentle "more / less than last time" line.
  const previousTotal = useMemo(() => {
    const prev = periodOf(kind, shiftAnchor(kind, anchor, -1));
    return allRows.filter((r) => inPeriod(r, prev)).reduce((s, r) => s + r.amount, 0);
  }, [allRows, kind, anchor]);
  const delta = previousTotal > 0 ? Math.round(((total - previousTotal) / previousTotal) * 100) : null;
  const periodWord = { day: 'hôm trước', week: 'tuần trước', month: 'tháng trước', year: 'năm trước' }[kind];

  const grouped = useMemo(() => {
    const map = new Map<string, ExpenseRow[]>();
    rows.forEach((r) => map.set(r.date, [...(map.get(r.date) || []), r]));
    return Array.from(map.entries());
  }, [rows]);

  const openAdd = () => {
    soundService.playPop();
    setIsAdding(true);
  };

  const isCurrent = period.start <= todayISO() && todayISO() <= period.end;

  return (
    <div className="w-full max-w-5xl mx-auto px-3 sm:px-6 pb-28 sm:pb-12">
      {/* HERO */}
      <div className="relative overflow-hidden rounded-[32px] mb-6 p-6 sm:p-8 text-white bg-gradient-to-br from-amber-400 via-rose-400 to-fuchsia-500 shadow-xl shadow-rose-200/40 dark:shadow-none">
        <div className="absolute -top-10 -right-10 w-56 h-56 rounded-full bg-white/15 blur-2xl" />
        <div className="absolute -bottom-16 -left-10 w-64 h-64 rounded-full bg-yellow-200/20 blur-3xl" />
        <motion.div
          animate={{ y: [0, -10, 0], rotate: [0, -8, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-5 right-6 sm:right-12 text-5xl sm:text-6xl select-none"
        >
          💸
        </motion.div>

        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-widest text-white/80 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Chi tiêu hẹn hò
          </p>
          <h2 className="font-serif italic text-3xl sm:text-4xl mt-1">Dating Fees</h2>
          <p className="text-sm text-white/85 mt-1 max-w-md">Mỗi buổi hẹn là một kỷ niệm — và đây là “hóa đơn yêu thương” của hai đứa.</p>

          <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-white/75">{period.label}</p>
              <p className="text-4xl sm:text-5xl font-extrabold leading-none mt-1 tabular-nums drop-shadow-sm">{formatVND(total)}</p>
              {delta !== null && (
                <p className="text-xs font-semibold text-white/85 mt-1.5">
                  {delta === 0 ? `Bằng ${periodWord}` : `${delta > 0 ? '▲' : '▼'} ${Math.abs(delta)}% so với ${periodWord}`}
                </p>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2.5 flex-1 min-w-[260px] max-w-md">
              <div className="rounded-2xl bg-white/20 backdrop-blur px-3 py-2.5">
                <div className="text-xl sm:text-2xl font-extrabold leading-none tabular-nums">{rows.length}</div>
                <div className="text-[10px] sm:text-[11px] font-semibold text-white/85 mt-1">khoản chi</div>
              </div>
              <div className="rounded-2xl bg-white/20 backdrop-blur px-3 py-2.5">
                <div className="text-base sm:text-xl font-extrabold leading-none tabular-nums truncate">{outings ? formatVNDShort(total / outings) : '—'}</div>
                <div className="text-[10px] sm:text-[11px] font-semibold text-white/85 mt-1">mỗi buổi hẹn</div>
              </div>
              <div className="rounded-2xl bg-white/20 backdrop-blur px-3 py-2.5">
                <div className="text-xl sm:text-2xl leading-none">{topCategory ? topCategory.category.emoji : '—'}</div>
                <div className="text-[10px] sm:text-[11px] font-semibold text-white/85 mt-1 truncate">{topCategory ? `chi nhiều: ${topCategory.category.label}` : 'chưa có'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TOOLBAR: period + navigation + actions, one row */}
      <div className={`p-3 sm:p-4 rounded-[28px] ${currentTheme.cardBg} border ${currentTheme.borderSubtle} shadow-lg mb-6 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3`}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
          <div className="flex items-center gap-1 p-1 rounded-full bg-[#FFF5F7] dark:bg-zinc-800 border border-[#FFE4E9] dark:border-zinc-700">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  soundService.playPop();
                  setKind(p.id);
                }}
                className={`flex-1 sm:flex-none px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
                  kind === p.id ? 'bg-gradient-to-r from-[#FF758F] to-[#FF9A9E] text-white shadow-sm' : 'text-[#666] dark:text-zinc-400 hover:text-[#FF758F]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setAnchor((a) => shiftAnchor(kind, a, -1))} className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-rose-100 transition" title="Kỳ trước">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="min-w-[150px] text-center text-sm font-extrabold text-zinc-800 dark:text-zinc-100 font-cute">{period.label}</span>
            <button onClick={() => setAnchor((a) => shiftAnchor(kind, a, 1))} className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-rose-100 transition" title="Kỳ sau">
              <ChevronRight className="w-4 h-4" />
            </button>
            {!isCurrent && (
              <button onClick={() => setAnchor(todayISO())} className="ml-1 px-3 py-1.5 rounded-full text-[11px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 transition flex items-center gap-1">
                <CalendarDays className="w-3.5 h-3.5" /> Hiện tại
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleIncludePlans}
            title="Gộp chi phí từ Kế hoạch đi chơi vào những ngày đã có khoản chi"
            className={`px-3.5 py-2.5 rounded-full text-xs font-bold flex items-center gap-1.5 border transition whitespace-nowrap ${
              includePlans ? 'border-sky-300 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300' : 'border-zinc-200 dark:border-zinc-700 text-zinc-500'
            }`}
          >
            <Plane className="w-3.5 h-3.5" /> {includePlans ? 'Có chi phí kế hoạch' : 'Không gộp kế hoạch'}
          </button>
          <button
            onClick={openAdd}
            className="flex-1 lg:flex-none px-5 py-2.5 rounded-full bg-gradient-to-r from-[#FF758F] to-[#FF9A9E] text-white font-bold text-sm shadow-md shadow-rose-200 dark:shadow-rose-950 flex items-center justify-center gap-2 transition active:scale-95 whitespace-nowrap"
          >
            <Plus className="w-4 h-4 stroke-[3px]" /> Thêm khoản chi
          </button>
        </div>
      </div>

      {total === 0 ? (
        <div className={`text-center py-16 px-4 rounded-3xl ${currentTheme.cardBg} border ${currentTheme.borderSubtle}`}>
          <motion.div animate={{ y: [0, -8, 0], rotate: [0, 6, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} className="text-6xl mb-3">
            🧾
          </motion.div>
          <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-200 mb-1 font-cute">{datingExpenses.length === 0 ? 'Chưa có khoản chi nào' : `Chưa có khoản chi nào trong ${period.label.toLowerCase()}`}</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto mb-4">
            Ly trà sữa, tấm vé xem phim hay bữa lẩu cuối tuần — ghi lại để cuối tháng cùng nhìn lại nhé! Chi phí trong Kế hoạch đi chơi sẽ tự hiện ở đây vào những ngày bạn có ghi chi tiêu.
          </p>
          <button onClick={openAdd} className="px-5 py-2.5 rounded-full bg-gradient-to-r from-[#FF758F] to-[#FF9A9E] text-white font-bold text-sm shadow-md inline-flex items-center gap-2">
            <Plus className="w-4 h-4 stroke-[3px]" /> Thêm khoản chi đầu tiên
          </button>
        </div>
      ) : (
        <>
          {/* STATS */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 mb-6">
            {/* by category */}
            <div className={`lg:col-span-2 rounded-[28px] ${currentTheme.cardBg} border ${currentTheme.borderSubtle} shadow-md p-5`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-cute font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-rose-500" /> Theo danh mục
                </h3>
                <span className="text-[11px] font-semibold text-zinc-400">{ranked.length} danh mục</span>
              </div>

              <CompositionStrip parts={parts} total={total} isDark={isDark} />

              <ul className="mt-5 space-y-3.5">
                {ranked.map((p) => {
                  const pct = (p.amount / total) * 100;
                  const count = rows.filter((r) => r.category === p.category.id).length;
                  return (
                    <li key={p.category.id} className="flex items-center gap-3">
                      <CategoryBadge id={p.category.id} color={colorOf(p.category.id)} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-bold text-zinc-800 dark:text-zinc-100 truncate">{p.category.label}</span>
                          <span className="text-sm font-extrabold text-zinc-900 dark:text-white tabular-nums">{formatVND(p.amount)}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.6, ease: 'easeOut' }}
                              className="h-full rounded-full"
                              style={{ backgroundColor: colorOf(p.category.id) }}
                            />
                          </div>
                          <span className="w-16 text-right text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 tabular-nums">
                            {Math.round(pct)}% · {count}
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* over time */}
            <div className={`lg:col-span-3 rounded-[28px] ${currentTheme.cardBg} border ${currentTheme.borderSubtle} shadow-md p-5`}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-cute font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-rose-500" />
                  {kind === 'day' ? 'Trong ngày' : kind === 'week' ? 'Từng ngày trong tuần' : kind === 'month' ? 'Từng ngày trong tháng' : 'Từng tháng trong năm'}
                </h3>
                {kind !== 'day' && <span className="text-[11px] font-semibold text-zinc-400">Chạm vào cột để xem chi tiết</span>}
              </div>

              {kind === 'day' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {ranked.map((p) => (
                    <div key={p.category.id} className="rounded-2xl p-3 bg-zinc-50 dark:bg-zinc-800/50 flex items-center gap-2.5">
                      <CategoryBadge id={p.category.id} color={colorOf(p.category.id)} size="sm" />
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 truncate">{p.category.label}</p>
                        <p className="text-sm font-extrabold text-zinc-900 dark:text-white tabular-nums">{formatVNDShort(p.amount)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <TrendChart kind={kind} rows={rows} period={period} isDark={isDark} />
              )}

              {/* legend: the categories on screen, in the same fixed order as the stacks */}
              <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                {parts.map((p) => (
                  <span key={p.category.id} className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">
                    <span className="w-2.5 h-2.5 rounded-[3px]" style={{ backgroundColor: colorOf(p.category.id) }} />
                    {p.category.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* LIST */}
          <div className={`rounded-[28px] ${currentTheme.cardBg} border ${currentTheme.borderSubtle} shadow-md p-4 sm:p-5`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-cute font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-rose-500" /> Các khoản chi
              </h3>
              {planCount > 0 && (
                <span className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 flex items-center gap-1">
                  <Plane className="w-3 h-3" /> {planCount} khoản từ kế hoạch
                </span>
              )}
            </div>

            <div className="space-y-5">
              {grouped.map(([date, items]) => (
                <div key={date}>
                  <div className="flex items-center justify-between px-1 mb-2">
                    <span className="text-xs font-extrabold text-zinc-500 dark:text-zinc-400">{formatLongDate(date)}</span>
                    <span className="text-xs font-extrabold text-zinc-700 dark:text-zinc-200 tabular-nums">{formatVND(items.reduce((s, r) => s + r.amount, 0))}</span>
                  </div>
                  <ul className="space-y-2">
                    <AnimatePresence initial={false}>
                      {items.map((r) => {
                        const c = getCategory(r.category);
                        return (
                          <motion.li
                            key={r.id}
                            layout
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="group flex items-center gap-3 p-2.5 sm:p-3 rounded-2xl bg-zinc-50/80 dark:bg-zinc-800/40 hover:bg-white dark:hover:bg-zinc-800 border border-transparent hover:border-rose-100 dark:hover:border-zinc-700 transition"
                          >
                            <CategoryBadge id={r.category} color={colorOf(r.category)} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100 truncate">{r.title}</p>
                              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 min-w-0">
                                <span className="shrink-0">{c.label}</span>
                                {r.note && <span className="truncate">· {r.note}</span>}
                              </p>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {r.source === 'plan' ? (
                                  <span className="px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 text-[10px] font-bold">
                                    {r.planEmoji || '✈️'} Từ kế hoạch: {r.planTitle}
                                  </span>
                                ) : (
                                  r.authorName && <span className="px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 text-[10px] font-bold">✍️ {r.authorName}</span>
                                )}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm sm:text-base font-extrabold text-zinc-900 dark:text-white tabular-nums">{formatVND(r.amount)}</p>
                              {r.expense && (
                                <div className="flex justify-end gap-1 mt-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition">
                                  <button onClick={() => setEditing(r.expense!)} className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-zinc-700" title="Sửa">
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (window.confirm(`Xóa khoản "${r.title}" (${formatVND(r.amount)})?`)) deleteExpense(r.id);
                                    }}
                                    className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-zinc-700"
                                    title="Xóa"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </motion.li>
                        );
                      })}
                    </AnimatePresence>
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <AnimatePresence>
        {(isAdding || editing) && (
          <ExpenseModal
            key={editing?.id || 'new'}
            initial={editing || undefined}
            defaultDate={kind === 'day' ? anchor : isCurrent ? todayISO() : period.start}
            isDark={isDark}
            onClose={() => {
              setIsAdding(false);
              setEditing(null);
            }}
            onSave={(data) => {
              soundService.playSparkle();
              if (editing) updateExpense(editing.id, data);
              else addExpense(data);
              setIsAdding(false);
              setEditing(null);
            }}
            onDelete={
              editing
                ? () => {
                    if (!window.confirm(`Xóa khoản "${editing.title}"?`)) return;
                    deleteExpense(editing.id);
                    setEditing(null);
                  }
                : undefined
            }
          />
        )}
      </AnimatePresence>
    </div>
  );
};
