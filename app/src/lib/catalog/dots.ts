/**
 * The row of dots under a photograph, when there are more photographs than
 * dots worth counting.
 *
 * Styles arrive with anything from one photograph to twenty-nine, and more than
 * half the catalog carries seven or more, so a dot per photograph is not a row
 * anybody can read: Apple's own guidance says a reader stops counting somewhere
 * around ten. The answer here is the one Instagram made familiar, a scrolling
 * page control: a fixed number of dots, a window that travels with the frame on
 * screen, and a dot drawn smaller at whichever edge has photographs past it.
 * The small dot is the whole trick, because it is what says there is more that
 * way without printing a number.
 */

/** How many dots the row shows at once, however many photographs there are. */
export const MAX_DOTS = 7;

export type PhotoDot = {
  /** The photograph this dot stands for. */
  index: number;
  /**
   * How large to draw it. Full for the photographs the window holds outright,
   * smaller at an edge that has photographs beyond it: the taper is the signal
   * that there is more to swipe to.
   */
  size: "full" | "medium" | "small";
};

/**
 * The dots to draw for a strip of `count` photographs showing frame `current`.
 *
 * The window holds still at the start of the strip, carries the current frame
 * in its middle once past that, and holds still again at the end rather than
 * running off past the last photograph. Which means the current frame is never
 * one of the tapered dots: whatever is on screen is always drawn full size.
 */
export function dotWindow(count: number, current: number, max = MAX_DOTS): PhotoDot[] {
  const total = Math.max(0, Math.floor(count) || 0);
  if (total === 0) return [];

  const width = Math.min(Math.max(1, Math.floor(max) || 1), total);
  // A frame out of a stale link should still draw a sensible row.
  const at = Math.min(Math.max(0, Math.floor(current) || 0), total - 1);

  const centred = at - Math.floor(width / 2);
  const start = Math.min(Math.max(0, centred), total - width);
  const before = start > 0;
  const after = start + width < total;

  return Array.from({ length: width }, (_, slot) => {
    const fromEnd = width - 1 - slot;
    const outermost = (before && slot === 0) || (after && fromEnd === 0);
    const nextIn = (before && slot === 1) || (after && fromEnd === 1);

    return {
      index: start + slot,
      size: outermost ? "small" : nextIn ? "medium" : "full",
    };
  });
}
