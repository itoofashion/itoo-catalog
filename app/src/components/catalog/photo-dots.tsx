"use client";

import { cn } from "@/lib/utils";
import { dotWindow } from "@/lib/catalog/dots";

/**
 * Where a strip of photographs has got to, said in dots.
 *
 * Never more than seven of them, with the row travelling as the frames go past
 * and the dot at an edge with more behind it drawn smaller; the rule itself is
 * in lib/catalog/dots.ts, along with why. A number would have been easier to
 * write and is what this replaces: "4 / 29" is read, dots are seen, and this
 * sits on top of a photograph where nothing should ask to be read.
 *
 * The dots are pressable as well as printed, because on a card they are the
 * only way through the gallery that a finger can find.
 */
export function PhotoDots({
  count,
  current,
  onShow,
  className,
}: {
  count: number;
  /** The frame on screen. */
  current: number;
  onShow: (index: number) => void;
  className?: string;
}) {
  // One photograph is not a gallery, and a single dot under it says nothing.
  if (count < 2) return null;

  return (
    <div
      data-photo-dots=""
      className={cn(
        "pointer-events-auto absolute bottom-1 left-1/2 flex -translate-x-1/2",
        className,
      )}
    >
      {dotWindow(count, current).map((dot, slot) => (
        <button
          // Keyed by its place in the row rather than by the photograph it
          // stands for: the row is seven slots that change what they point at,
          // so the dots resize into one another instead of appearing and
          // vanishing at the edges.
          key={slot}
          type="button"
          aria-label={`Photo ${dot.index + 1}`}
          aria-current={dot.index === current ? "true" : undefined}
          onClick={() => onShow(dot.index)}
          /* The dot is 6px; the target around it is a finger wide. */
          className="flex h-6 w-4 cursor-pointer items-center justify-center"
        >
          {/* Half these photographs are shot against white, so the dot carries
              its own edge rather than trusting the backdrop. */}
          <span
            className={cn(
              "rounded-full bg-white/70 drop-shadow-[0_0_2px_rgba(0,0,0,0.65)] transition-all motion-reduce:transition-none",
              dot.size === "full" && "size-1.5",
              dot.size === "medium" && "size-1",
              dot.size === "small" && "size-[3px]",
              dot.index === current && "bg-white",
            )}
          />
        </button>
      ))}
    </div>
  );
}
