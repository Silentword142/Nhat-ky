import React from 'react';
import { useCouple } from '../context/CoupleContext';
import { PaidBy } from '../types';
import { formatVND } from '../utils/money';
import { PARTNER_OF, PayerSide, SPLIT, payerSide, tallyPayments } from '../utils/payer';

const SIDE_EMOJI: Record<PayerSide, string> = { me: '🙋', partner: '💁', split: '🤝' };

/** The two people of this room as seen from this device, and how to read / write "who paid". */
export const usePayers = () => {
  const { myUserId, myProfile, partnerProfile } = useCouple();
  const myName = myProfile?.name?.trim() || 'Tôi';
  const partnerName = partnerProfile?.name?.trim() || 'Người ấy';
  // The partner's real id when it is known; otherwise "the other one, as seen by me".
  const partnerValue: PaidBy = partnerProfile?.id && partnerProfile.id !== myUserId ? partnerProfile.id : `${PARTNER_OF}${myUserId}`;

  const sideOf = (paidBy?: PaidBy) => payerSide(paidBy, myUserId);
  const valueFor = (side: PayerSide): PaidBy => (side === 'me' ? myUserId : side === 'partner' ? partnerValue : SPLIT);
  const nameFor = (side: PayerSide) => (side === 'me' ? myName : side === 'partner' ? partnerName : 'Chia đôi');
  const tally = (items: { amount: number; paidBy?: PaidBy }[]) => tallyPayments(items, myUserId);

  return { myUserId, myName, partnerName, sideOf, valueFor, nameFor, tally };
};

/** Three pills: me / the other one / half each. Tapping the chosen one again clears it. */
export const PayerPicker: React.FC<{ value?: PaidBy; onChange: (next: PaidBy | undefined) => void; label?: string }> = ({ value, onChange, label = 'Ai trả?' }) => {
  const { sideOf, valueFor, nameFor } = usePayers();
  const current = sideOf(value);
  return (
    <div>
      {label && <p className="text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1.5">{label}</p>}
      <div className="grid grid-cols-3 gap-2">
        {(['me', 'partner', 'split'] as PayerSide[]).map((side) => {
          const on = current === side;
          return (
            <button
              key={side}
              type="button"
              onClick={() => onChange(on ? undefined : valueFor(side))}
              className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-2xl border-2 text-xs font-bold transition min-w-0 ${
                on
                  ? 'border-rose-400 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 shadow-sm'
                  : 'border-transparent bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              <span className="text-base leading-none">{SIDE_EMOJI[side]}</span>
              <span className="truncate">{nameFor(side)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

/** A compact dropdown for a table cell. */
export const PayerSelect: React.FC<{ value?: PaidBy; onChange: (next: PaidBy | undefined) => void; className?: string }> = ({ value, onChange, className = '' }) => {
  const { sideOf, valueFor, nameFor } = usePayers();
  const current = sideOf(value) || '';
  return (
    <select
      value={current}
      onChange={(e) => onChange(e.target.value ? valueFor(e.target.value as PayerSide) : undefined)}
      className={`w-full bg-transparent border-0 text-xs font-semibold text-zinc-700 dark:text-zinc-200 focus:ring-2 focus:ring-inset focus:ring-rose-400 cursor-pointer ${className}`}
      aria-label="Ai trả"
    >
      <option value="">— chưa rõ —</option>
      {(['me', 'partner', 'split'] as PayerSide[]).map((side) => (
        <option key={side} value={side}>
          {SIDE_EMOJI[side]} {nameFor(side)}
        </option>
      ))}
    </select>
  );
};

/** "🙋 Minh trả" / "🤝 Chia đôi", or nothing when nobody is named. */
export const PayerChip: React.FC<{ paidBy?: PaidBy }> = ({ paidBy }) => {
  const { sideOf, nameFor } = usePayers();
  const side = sideOf(paidBy);
  if (!side) return null;
  return (
    <span className="px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 text-[10px] font-bold whitespace-nowrap">
      {SIDE_EMOJI[side]} {side === 'split' ? 'Chia đôi' : `${nameFor(side)} trả`}
    </span>
  );
};

/** Who paid how much, and what would even it out. */
export const PayerSummary: React.FC<{ items: { amount: number; paidBy?: PaidBy }[]; className?: string }> = ({ items, className = '' }) => {
  const { tally, myName, partnerName } = usePayers();
  const t = tally(items);
  const named = t.me + t.partner;
  if (named <= 0 && t.unassigned <= 0) return null;
  const mePct = named > 0 ? (t.me / named) * 100 : 50;
  const even = Math.abs(t.balance) < 1;

  return (
    <div className={`rounded-2xl p-3.5 bg-violet-50/70 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/40 ${className}`}>
      <div className="flex items-center justify-between gap-3 text-xs font-bold">
        <span className="text-zinc-700 dark:text-zinc-200 truncate">🙋 {myName}</span>
        <span className="text-zinc-700 dark:text-zinc-200 truncate text-right">{partnerName} 💁</span>
      </div>
      <div className="flex items-baseline justify-between gap-3 mt-0.5">
        <span className="text-base font-extrabold text-zinc-900 dark:text-white tabular-nums">{formatVND(t.me)}</span>
        <span className="text-base font-extrabold text-zinc-900 dark:text-white tabular-nums">{formatVND(t.partner)}</span>
      </div>
      {named > 0 && (
        <div className="flex h-2.5 gap-[2px] rounded-full overflow-hidden mt-1.5 bg-white dark:bg-zinc-800">
          <div className="h-full rounded-l-full bg-rose-400" style={{ width: `${mePct}%` }} />
          <div className="h-full rounded-r-full bg-violet-500" style={{ width: `${100 - mePct}%` }} />
        </div>
      )}
      <p className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 mt-2">
        {named <= 0
          ? 'Chưa ghi ai trả khoản nào.'
          : even
          ? 'Hai bạn đang chi đều nhau 💞'
          : t.balance > 0
          ? `Để chia đôi: ${partnerName} gửi lại ${myName} ${formatVND(t.balance)}`
          : `Để chia đôi: ${myName} gửi lại ${partnerName} ${formatVND(-t.balance)}`}
      </p>
      {t.unassigned > 0 && <p className="text-[10px] text-zinc-400 mt-0.5">Còn {formatVND(t.unassigned)} chưa ghi ai trả (không tính vào phần chia).</p>}
    </div>
  );
};
