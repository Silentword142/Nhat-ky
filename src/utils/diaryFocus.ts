/**
 * A tiny hand-off for "open the diary on this day": the notice card asks for a date, the diary
 * view picks it up. A module variable rather than state because the diary may not be mounted yet
 * when the ask happens — it reads the pending date as it mounts, and the event covers the case
 * where it is already on screen.
 */
const DIARY_DATE_EVENT = 'lovesync:diary-date';

let pendingDate: string | null = null;

export const requestDiaryDate = (date?: string) => {
  if (!date) return;
  pendingDate = date;
  try {
    window.dispatchEvent(new CustomEvent(DIARY_DATE_EVENT));
  } catch {
    // the mount-time read below still covers it
  }
};

/** Returns the requested date once, then forgets it. */
export const consumeDiaryDate = (): string | null => {
  const date = pendingDate;
  pendingDate = null;
  return date;
};

export const onDiaryDateRequest = (handler: () => void) => {
  window.addEventListener(DIARY_DATE_EVENT, handler);
  return () => window.removeEventListener(DIARY_DATE_EVENT, handler);
};
