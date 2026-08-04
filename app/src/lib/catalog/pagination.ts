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

/** How many page numbers the bar offers at once. */
export const WINDOW_SIZE = 5;

/**
 * A run of consecutive page numbers to offer, never longer than WINDOW_SIZE and
 * never broken by an ellipsis. The window holds still at the start of the
 * catalogue, carries the current page in its middle once past that, and holds
 * still again at the end rather than running off past the last page.
 */
export function pageWindow(page: number, pages: number, size = WINDOW_SIZE): number[] {
  const total = Math.max(1, Math.floor(pages) || 1);
  const width = Math.min(Math.max(1, Math.floor(size) || 1), total);
  // A page number out of a stale link should still draw a sensible window.
  const current = Math.min(Math.max(1, Math.floor(page) || 1), total);

  const centred = current - Math.floor(width / 2);
  const start = Math.min(Math.max(1, centred), total - width + 1);

  return Array.from({ length: width }, (_, index) => start + index);
}
