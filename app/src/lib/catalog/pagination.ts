/**
 * The catalogue is seven hundred styles and every card carries a photograph, so
 * showing all of them at once costs a phone its memory and the visitor their
 * patience. Pages are cheap by comparison, and the page number lives in the
 * address like every other piece of state here, so a link still opens where it
 * was sent from.
 */
export const PER_PAGE = 48;

export type Paged<T> = {
  items: T[];
  /** 1-based, clamped to what exists. */
  page: number;
  pages: number;
  total: number;
};

export function paginate<T>(items: T[], page: number, perPage = PER_PAGE): Paged<T> {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  // A page number from a stale link should land somewhere real rather than on
  // an empty grid.
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  const start = (current - 1) * perPage;

  return { items: items.slice(start, start + perPage), page: current, pages, total };
}

/**
 * Page numbers to offer, with gaps marked by null: first, last, and a window
 * around where the visitor is. Long catalogues would otherwise print forty
 * buttons nobody presses.
 */
export function pageWindow(page: number, pages: number, span = 1): (number | null)[] {
  if (pages <= 1) return [1];

  const wanted = new Set<number>([1, pages]);
  for (let offset = -span; offset <= span; offset += 1) {
    const candidate = page + offset;
    if (candidate >= 1 && candidate <= pages) wanted.add(candidate);
  }

  const sorted = [...wanted].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  for (const [index, value] of sorted.entries()) {
    if (index > 0 && value - sorted[index - 1] > 1) out.push(null);
    out.push(value);
  }
  return out;
}
