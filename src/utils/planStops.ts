import { PlanStop } from '../types';

type OptionFields = Pick<PlanStop, 'place' | 'lat' | 'lng' | 'reviewUrl' | 'cost'>;

/** The stop as it should currently be shown / mapped / costed: the ticked backup option overrides the main one. */
export const resolveStop = (s: PlanStop): PlanStop => {
  const alt = s.activeAltId ? s.alts?.find((a) => a.id === s.activeAltId) : undefined;
  if (!alt) return s;
  return { ...s, place: alt.place, lat: alt.lat, lng: alt.lng, reviewUrl: alt.reviewUrl, cost: alt.cost };
};

/** Apply a change to whichever option is currently active (main or a backup). */
export const patchActiveOption = (s: PlanStop, patch: Partial<OptionFields>): PlanStop => {
  if (s.activeAltId && s.alts?.some((a) => a.id === s.activeAltId)) {
    return { ...s, alts: s.alts.map((a) => (a.id === s.activeAltId ? { ...a, ...patch, place: patch.place ?? a.place } : a)) };
  }
  return { ...s, ...patch };
};
