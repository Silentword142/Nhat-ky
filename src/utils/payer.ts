import { PaidBy } from '../types';

export type PayerSide = 'me' | 'partner' | 'split';

export const SPLIT: PaidBy = 'split';
/** "The other one" as seen by <userId> — for when the partner's own id isn't known yet. */
export const PARTNER_OF = 'partner-of:';

/**
 * Reads a stored payer from THIS device's point of view. The same record says "me" on one phone
 * and "the other one" on the other, which is why it is stored as an id and not as a name.
 */
export const payerSide = (paidBy: PaidBy | undefined, myUserId: string): PayerSide | null => {
  if (!paidBy) return null;
  if (paidBy === SPLIT) return 'split';
  if (paidBy.startsWith(PARTNER_OF)) return paidBy.slice(PARTNER_OF.length) === myUserId ? 'partner' : 'me';
  return paidBy === myUserId ? 'me' : 'partner';
};

export interface PaidTally {
  me: number;
  partner: number;
  /** Amounts nobody has been named for; left out of the settling-up. */
  unassigned: number;
  /** What the other one should hand over for the two of you to have paid the same: < 0 means I owe them. */
  balance: number;
}

/** Who has paid how much. Something paid half each counts half to each side. */
export const tallyPayments = (items: { amount: number; paidBy?: PaidBy }[], myUserId: string): PaidTally => {
  let me = 0;
  let partner = 0;
  let unassigned = 0;
  items.forEach(({ amount, paidBy }) => {
    if (!(amount > 0)) return;
    const side = payerSide(paidBy, myUserId);
    if (side === 'me') me += amount;
    else if (side === 'partner') partner += amount;
    else if (side === 'split') {
      me += amount / 2;
      partner += amount / 2;
    } else unassigned += amount;
  });
  // An even share of what has a payer is (me + partner) / 2, so I am (me - partner) / 2 over it.
  return { me, partner, unassigned, balance: (me - partner) / 2 };
};
