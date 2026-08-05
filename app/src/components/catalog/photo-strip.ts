"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A gallery that is scrolled rather than swapped.
 *
 * The page shows up to forty-eight of these at once, so the gallery is the
 * browser's own scroller with CSS scroll snapping: it costs nothing per card,
 * and swiping on a phone and two-finger scrolling on a trackpad come for free,
 * which a carousel library would have had to reimplement.
 *
 * Which frame is showing is not the strip's to keep. The catalog holds it, by
 * style, so the card in the grid and the open style are looking at the same
 * photograph (see catalog-view.tsx). What this hook does is join the two
 * directions of that: the scroll position read back up, and the frame the
 * catalog names scrolled to.
 *
 * Both directions at once, on two strips at once, is the whole difficulty here,
 * because an open style has its own card scrolling along behind it. What keeps
 * the two from pulling each other apart is that each strip remembers the frame
 * it is showing and acts only on a frame that is news to it: a strip never
 * chases a reading it made itself, and says nothing about a position it is only
 * passing through on its way to one it was told to take.
 *
 * `onShow` has to keep its identity between renders, or the listener below is
 * torn down and hung again on every one of them.
 */
export function usePhotoStrip(
  count: number,
  /** The frame the catalog says this style is showing. */
  index: number,
  onShow: (index: number) => void,
) {
  /**
   * The strip itself, kept as state rather than in a ref, because it does not
   * always arrive with the component that renders it: the open style is drawn
   * through a portal, and a portal puts its children in the document one commit
   * after the component that owns them has mounted. The listener below used to
   * be hung on a ref read on mount, which in the dialog was still empty, and
   * with nothing in its dependencies to change it never ran again: the open
   * style's strip scrolled and nothing anywhere heard it. That was the frozen
   * indicator, on a phone and on a laptop alike, and the reason the arrows in
   * an open style went dead once a swipe had carried past them.
   */
  const [strip, setStrip] = useState<HTMLDivElement | null>(null);

  /**
   * The frame this strip is showing, as this strip understands it. Written only
   * from the listener and from the effect that moves the strip, never during a
   * render, so it describes the thing on screen rather than the last thing
   * React thought about it. It starts as no frame at all, so that the first
   * placement happens even when the catalog asks for the first photograph.
   */
  const at = useRef(-1);
  /** Where this strip is taking itself, while it is still on the way. */
  const travellingTo = useRef<number | null>(null);

  useEffect(() => {
    if (!strip) return;

    // Scrolling fires far more often than the screen repaints, and one reading
    // per frame is all an indicator can show.
    let pending = 0;
    let settling: ReturnType<typeof setTimeout> | undefined;

    const read = () => {
      pending = 0;
      const width = strip.clientWidth;
      if (width === 0) return;
      const frame = Math.min(count - 1, Math.max(0, Math.round(strip.scrollLeft / width)));

      // A move of this strip's own can land short and be snapped the rest of
      // the way. Announcing what it passes over would say the reader had
      // arrived somewhere they are only travelling through, and the card behind
      // an open style would set off after them.
      if (travellingTo.current !== null) {
        if (frame !== travellingTo.current) return;
        travellingTo.current = null;
      }

      if (frame === at.current) return;
      at.current = frame;
      onShow(frame);
    };

    const onScroll = () => {
      if (pending === 0) pending = requestAnimationFrame(read);
      // A move can be cut short, by a finger landing on the strip or by another
      // move replacing it, and then it never arrives. Once the strip has been
      // still for a moment, wherever it stopped is the truth again.
      clearTimeout(settling);
      settling = setTimeout(() => {
        travellingTo.current = null;
        read();
      }, SETTLE_MS);
    };

    strip.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      strip.removeEventListener("scroll", onScroll);
      clearTimeout(settling);
      if (pending !== 0) cancelAnimationFrame(pending);
    };
  }, [count, onShow, strip]);

  // The other direction: a pressed dot, a thumbnail, an arrow, or a style opened
  // on the photograph its card had reached. A frame this strip reported itself
  // is not news and is left alone, which is what stops a finger still moving on
  // the strip from being pulled back to where it has just been.
  useEffect(() => {
    if (!strip || index === at.current) return;

    const align = () => {
      const width = strip.clientWidth;
      // The dialog takes its width from the layout that follows, so the first
      // attempt can land on a strip that is still nought pixels wide.
      if (width === 0) return false;

      at.current = index;
      if (Math.round(strip.scrollLeft / width) !== index) {
        travellingTo.current = index;
        // Put there outright rather than glided there. A press on a dot or a
        // thumbnail is a jump between photographs, not a journey, and the
        // gliding version of this was a fault: an animation is a stretch of
        // time in which the strip is between frames, another strip can be told
        // it has arrived somewhere it is only passing, and a glide the browser
        // cuts short leaves the pair of them arguing about where the reader is.
        // Swiping is still as smooth as the browser makes it; that motion is
        // the reader's own.
        strip.scrollTo?.({ left: index * width, behavior: "auto" });
      }
      return true;
    };

    if (align()) return;
    const frame = requestAnimationFrame(align);
    return () => cancelAnimationFrame(frame);
  }, [index, strip]);

  return setStrip;
}

/** How long a strip has to be still before it is taken to have stopped. */
const SETTLE_MS = 120;

/** A press that travelled this far was a swipe, not a tap on the photograph. */
export const DRAG_SLOP_PX = 10;
