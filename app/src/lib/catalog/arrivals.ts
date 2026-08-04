/** A product counts as a new arrival for this long after it was added. */
export const NEW_ARRIVAL_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * `now` is passed in rather than read from the clock so the badge is testable
 * and so server and client render the same thing.
 */
export function isNewArrival(createdAt: string, now: Date): boolean {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return false;

  const age = now.getTime() - created.getTime();
  if (age < 0) return true; // clock skew — a future date is certainly new
  return age <= NEW_ARRIVAL_DAYS * DAY_MS;
}
