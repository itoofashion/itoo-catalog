"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A gallery that is scrolled rather than swapped.
 *
 * The page shows up to forty-eight of these at once, so the gallery is the
 * browser's own scroller with CSS scroll snapping: it costs nothing per card,
 * and swiping on a phone and two-finger scrolling on a trackpad come for free,
 * which a carousel library would have had to reimplement.
 *
 * The frame on screen is read back from the scroll position, so the swipe, the
 * arrows and the dots all agree without any one of them owning the truth.
 */
export function usePhotoStrip(count: number, initial = 0) {
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(initial);

  // Opening a style on its fourth photo has to start on the fourth photo, and
  // jumping there is not a movement the viewer should watch.
  useEffect(() => {
    if (initial === 0) return;
    const jump = () => {
      const strip = ref.current;
      if (strip) strip.scrollLeft = initial * strip.clientWidth;
    };
    jump();
    // The dialog arrives through a portal and takes its width from the layout
    // that follows, so the first attempt can land on a strip that is still
    // nought pixels wide.
    const frame = requestAnimationFrame(jump);
    return () => cancelAnimationFrame(frame);
  }, [initial]);

  useEffect(() => {
    const strip = ref.current;
    if (!strip) return;

    // Scrolling fires far more often than the screen repaints, and one reading
    // per frame is all the dots can show.
    let pending = 0;
    const read = () => {
      pending = 0;
      const width = strip.clientWidth;
      if (width === 0) return;
      const at = Math.round(strip.scrollLeft / width);
      setIndex(Math.min(count - 1, Math.max(0, at)));
    };
    const onScroll = () => {
      if (pending === 0) pending = requestAnimationFrame(read);
    };

    strip.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      strip.removeEventListener("scroll", onScroll);
      if (pending !== 0) cancelAnimationFrame(pending);
    };
  }, [count]);

  /**
   * Set here as well as read back from scrolling: a pressed dot has to light up
   * on the press, not when a smooth scroll settles half a second later.
   */
  const goTo = useCallback(
    (next: number) => {
      const target = Math.min(count - 1, Math.max(0, next));
      setIndex(target);
      const strip = ref.current;
      // Element scrolling exists in a browser after layout and nowhere else.
      strip?.scrollTo?.({ left: target * strip.clientWidth, behavior: "smooth" });
    },
    [count],
  );

  return { ref, index, goTo };
}

/** A press that travelled this far was a swipe, not a tap on the photograph. */
export const DRAG_SLOP_PX = 10;
