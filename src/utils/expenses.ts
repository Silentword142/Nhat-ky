import { DatingExpense, ExpenseCategoryId, TripPlan } from '../types';
import { resolveStop } from './planStops';

/* ------------------------------------------------------------------ categories */

export interface ExpenseCategory {
  id: ExpenseCategoryId;
  label: string;
  emoji: string;
  /** Mark colour on the light surface / the dark surface. */
  light: string;
  dark: string;
  /** Soft tile behind the emoji badge (Tailwind classes, both themes). */
  tile: string;
}

/**
 * The fixed order below is also the order the colours are handed out in and the order segments
 * are stacked in, so a category always wears the same colour whatever the period shows. The eight
 * hues are the validated categorical set (distinguishable for colour-blind readers in both themes,
 * checked adjacent pair by adjacent pair); "Khác" is the neutral slot and sits first so its only
 * neighbour is the blue it separates cleanly from.
 */
export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { id: 'other', label: 'Khác', emoji: '✨', light: '#8a8983', dark: '#8f8e88', tile: 'bg-zinc-100 dark:bg-zinc-800' },
  { id: 'travel', label: 'Đi lại', emoji: '🚕', light: '#2a78d6', dark: '#3987e5', tile: 'bg-sky-100 dark:bg-sky-950/60' },
  { id: 'food', label: 'Ăn uống', emoji: '🍜', light: '#eb6834', dark: '#d95926', tile: 'bg-orange-100 dark:bg-orange-950/60' },
  { id: 'fun', label: 'Vui chơi', emoji: '🎡', light: '#1baf7a', dark: '#199e70', tile: 'bg-emerald-100 dark:bg-emerald-950/60' },
  { id: 'cafe', label: 'Cà phê', emoji: '☕', light: '#eda100', dark: '#c98500', tile: 'bg-amber-100 dark:bg-amber-950/60' },
  { id: 'gift', label: 'Quà tặng', emoji: '🎁', light: '#e87ba4', dark: '#d55181', tile: 'bg-pink-100 dark:bg-pink-950/60' },
  { id: 'hotel', label: 'Lưu trú', emoji: '🏨', light: '#008300', dark: '#008300', tile: 'bg-green-100 dark:bg-green-950/60' },
  { id: 'movie', label: 'Xem phim', emoji: '🎬', light: '#4a3aa7', dark: '#9085e9', tile: 'bg-violet-100 dark:bg-violet-950/60' },
  { id: 'shopping', label: 'Mua sắm', emoji: '🛍️', light: '#e34948', dark: '#e66767', tile: 'bg-red-100 dark:bg-red-950/60' },
];

const CATEGORY_BY_ID = new Map(EXPENSE_CATEGORIES.map((c) => [c.id, c]));

export const getCategory = (id: ExpenseCategoryId | undefined): ExpenseCategory =>
  CATEGORY_BY_ID.get(id || 'other') || EXPENSE_CATEGORIES[0];

/** Categories in the order people usually reach for them when adding a spend (not the colour order). */
export const PICKER_ORDER: ExpenseCategoryId[] = ['food', 'cafe', 'movie', 'fun', 'travel', 'hotel', 'gift', 'shopping', 'other'];

const stripAccents = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd');

// Checked in this order: the more specific kinds first ("vé xem phim" is a film, not an outing;
// "trà sữa" is a drink, not a meal; "vé máy bay" is travel).
const KEYWORDS: [ExpenseCategoryId, string[]][] = [
  ['movie', ['phim', 'cgv', 'lotte cinema', 'galaxy', 'rap chieu', 'cinema', 'bhd']],
  ['cafe', ['ca phe', 'cafe', 'coffee', 'tra sua', 'highlands', 'starbucks', 'phuc long', 'katinat', 'tra chanh', 'sinh to', 'nuoc ep']],
  ['hotel', ['khach san', 'homestay', 'resort', 'villa', 'hotel', 'airbnb', 'nha nghi', 'luu tru', 'phong nghi']],
  ['travel', ['may bay', 'grab', 'taxi', 'xang', 'tau hoa', 'xe khach', 'xe buyt', 'bus', 'gui xe', 'di lai', 'di chuyen', 'thue xe', 'xe may', 'phi cau duong', 've tau']],
  ['gift', ['qua', 'hoa tuoi', 'bo hoa', 'gift', 'sinh nhat', 'nhan doi']],
  ['shopping', ['mua sam', 'shopping', 'quan ao', 'giay', 'my pham', 'sieu thi', 'shop', 'tui xach']],
  ['food', ['an ', 'an sang', 'an trua', 'an toi', 'bun', 'pho', 'com', 'lau', 'nuong', 'nha hang', 'quan', 'banh', 'bua', 'buffet', 'pizza', 'kem', 'che', 'oc', 'mi ', 'hai san', 'do an', 'an vat']],
  ['fun', ['ve ', 'vui choi', 'cong vien', 'karaoke', 'bowling', 'game', 'bao tang', 'tham quan', 'ngam', 'check-in', 'chup anh', 'boi', 'spa', 'massage', 'show', 'concert', 'le hoi']],
];

/** A best guess from what an activity is called, used for costs that come in from a trip plan. */
export const guessCategory = (...texts: (string | undefined)[]): ExpenseCategoryId => {
  const hay = ` ${stripAccents(texts.filter(Boolean).join(' '))} `;
  for (const [id, words] of KEYWORDS) {
    if (words.some((w) => hay.includes(w))) return id;
  }
  return 'other';
};

/* ------------------------------------------------------------------ money */

export const formatVND = (n: number) => `${Math.round(n).toLocaleString('vi-VN')}đ`;

/** Compact form for axis ticks and tight tiles: 350k, 1,2tr, 2,5 tỷ. */
export const formatVNDShort = (n: number) => {
  const abs = Math.abs(n);
  const trim = (x: number) => x.toFixed(x < 10 ? 1 : 0).replace(/\.0$/, '').replace('.', ',');
  if (abs >= 1e9) return `${trim(n / 1e9)} tỷ`;
  if (abs >= 1e6) return `${trim(n / 1e6)}tr`;
  if (abs >= 1e3) return `${Math.round(n / 1e3)}k`;
  return `${Math.round(n)}đ`;
};

/* ------------------------------------------------------------------ dates (local, no timezone drift) */

export const parseISODate = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

export const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const todayISO = () => toISO(new Date());

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

const WEEKDAY_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const WEEKDAY_LONG = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const dm = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

export const formatLongDate = (iso: string) => {
  const d = parseISODate(iso);
  return `${WEEKDAY_LONG[d.getDay()]}, ${dm(d)}/${d.getFullYear()}`;
};

export type PeriodKind = 'day' | 'week' | 'month' | 'year';

export interface Period {
  start: string; // inclusive
  end: string; // inclusive
  label: string;
}

/** The day / week (Monday → Sunday, as calendars here run) / month / year that contains `anchor`. */
export const periodOf = (kind: PeriodKind, anchor: string): Period => {
  const d = parseISODate(anchor);
  if (kind === 'day') {
    const label = anchor === todayISO() ? `Hôm nay · ${dm(d)}/${d.getFullYear()}` : formatLongDate(anchor);
    return { start: anchor, end: anchor, label };
  }
  if (kind === 'week') {
    const monday = addDays(d, -((d.getDay() + 6) % 7));
    const sunday = addDays(monday, 6);
    return { start: toISO(monday), end: toISO(sunday), label: `${dm(monday)} – ${dm(sunday)}/${sunday.getFullYear()}` };
  }
  if (kind === 'month') {
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return { start: toISO(first), end: toISO(last), label: `Tháng ${d.getMonth() + 1}/${d.getFullYear()}` };
  }
  return { start: `${d.getFullYear()}-01-01`, end: `${d.getFullYear()}-12-31`, label: `Năm ${d.getFullYear()}` };
};

/** Moves the anchor one whole period back (-1) or forward (+1). */
export const shiftAnchor = (kind: PeriodKind, anchor: string, dir: -1 | 1): string => {
  const d = parseISODate(anchor);
  if (kind === 'day') return toISO(addDays(d, dir));
  if (kind === 'week') return toISO(addDays(d, 7 * dir));
  if (kind === 'month') return toISO(new Date(d.getFullYear(), d.getMonth() + dir, 1));
  return toISO(new Date(d.getFullYear() + dir, 0, 1));
};

export interface Bucket {
  key: string;
  label: string; // short tick label
  title: string; // full label for the tooltip
  start: string;
  end: string;
}

/** The slices a period's trend chart is drawn in: days of a week, days of a month, months of a year. */
export const bucketsOf = (kind: PeriodKind, period: Period): Bucket[] => {
  const start = parseISODate(period.start);
  if (kind === 'week' || kind === 'month') {
    const out: Bucket[] = [];
    for (let d = start; toISO(d) <= period.end; d = addDays(d, 1)) {
      const iso = toISO(d);
      out.push({
        key: iso,
        label: kind === 'week' ? WEEKDAY_SHORT[d.getDay()] : String(d.getDate()),
        title: formatLongDate(iso),
        start: iso,
        end: iso,
      });
    }
    return out;
  }
  if (kind === 'year') {
    return Array.from({ length: 12 }, (_, m) => {
      const first = new Date(start.getFullYear(), m, 1);
      const last = new Date(start.getFullYear(), m + 1, 0);
      return { key: `m${m}`, label: `T${m + 1}`, title: `Tháng ${m + 1}/${start.getFullYear()}`, start: toISO(first), end: toISO(last) };
    });
  }
  return [];
};

/* ------------------------------------------------------------------ rows: hand-entered + from trip plans */

export interface ExpenseRow {
  id: string;
  date: string;
  title: string;
  amount: number;
  category: ExpenseCategoryId;
  note?: string;
  source: 'manual' | 'plan';
  authorName?: string;
  /** Set for rows that come from a trip plan (read-only here; edited in Đi Chơi). */
  planTitle?: string;
  planEmoji?: string;
  /** Set for hand-entered rows, so they can be edited. */
  expense?: DatingExpense;
}

export const manualRows = (expenses: DatingExpense[]): ExpenseRow[] =>
  expenses
    .filter((e) => e && e.date && Number(e.amount) > 0)
    .map((e) => ({
      id: e.id,
      date: e.date,
      title: e.title || getCategory(e.category).label,
      amount: Number(e.amount),
      category: e.category || 'other',
      note: e.note,
      source: 'manual' as const,
      authorName: e.authorName,
      expense: e,
    }));

/**
 * Every priced activity of every trip plan, dated by the plan day it falls on (the ticked backup
 * option counts, as it does in the plan's own cost tab). Costs not tied to an activity — hotel,
 * transport — land on the plan's first day.
 */
export const planRows = (plans: TripPlan[]): ExpenseRow[] => {
  const out: ExpenseRow[] = [];
  plans.forEach((plan) => {
    if (!plan?.startDate) return;
    const start = parseISODate(plan.startDate);
    (plan.stops || []).forEach((raw) => {
      const stop = resolveStop(raw);
      const amount = Number(stop.cost) || 0;
      if (amount <= 0) return;
      out.push({
        id: `plan:${plan.id}:${stop.id}`,
        date: toISO(addDays(start, Math.max(0, (stop.day || 1) - 1))),
        title: stop.title || 'Hoạt động',
        amount,
        category: guessCategory(stop.title, stop.place),
        note: stop.place,
        source: 'plan',
        planTitle: plan.title,
        planEmoji: plan.emoji,
      });
    });
    (plan.extraCosts || []).forEach((x) => {
      const amount = Number(x.amount) || 0;
      if (amount <= 0) return;
      out.push({
        id: `plan:${plan.id}:x:${x.id}`,
        date: plan.startDate,
        title: x.label || 'Chi phí khác',
        amount,
        category: guessCategory(x.label),
        source: 'plan',
        planTitle: plan.title,
        planEmoji: plan.emoji,
      });
    });
  });
  return out;
};

export const inPeriod = (row: { date: string }, period: { start: string; end: string }) => row.date >= period.start && row.date <= period.end;
