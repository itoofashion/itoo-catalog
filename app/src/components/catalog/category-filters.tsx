"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { ALL_CATEGORIES } from "@/lib/catalog/share";

/**
 * One row, scrolled sideways rather than wrapped. Fifteen categories wrapped
 * into three rows pushed the photographs below the fold on a laptop and made a
 * phone unusable; a single row keeps the catalogue itself the first thing seen.
 *
 * What a scrolled row has to say for itself is that it scrolls: the fade at each
 * end appears only while there is something past it, so the row admits it is cut
 * off and stops pretending once the end is reached.
 *
 * The checkbox lives inside the chip because two jobs meet here a second apart:
 * pressing the name narrows what is on screen, ticking the box puts the whole
 * category into the link being built for a client.
 */
export function CategoryFilters({
  categories,
  active,
  onSelect,
  newOnly,
  onToggleNew,
  selectable,
  selectedCategories,
  onToggleCategory,
}: {
  categories: string[];
  active: string;
  onSelect: (category: string) => void;
  newOnly: boolean;
  onToggleNew: () => void;
  selectable: boolean;
  selectedCategories: string[];
  onToggleCategory: (category: string) => void;
}) {
  const row = useRef<HTMLDivElement>(null);
  const activeChip = useRef<HTMLSpanElement>(null);
  const [more, setMore] = useState({ before: false, after: false });

  const measure = useCallback(() => {
    const el = row.current;
    if (!el) return;
    const end = el.scrollWidth - el.clientWidth;
    // A pixel of rounding is not something anybody can scroll to.
    setMore({ before: el.scrollLeft > 1, after: el.scrollLeft < end - 1 });
  }, []);

  useEffect(() => {
    const el = row.current;
    if (!el) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    // The row is cut off by the width of the header, which changes with the window
    // and with the categories the current selection can fill.
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      observer?.disconnect();
    };
  }, [measure, categories]);

  // Arriving on /?show=Skirts must not leave the page filtered by a category
  // that sits off the right-hand edge of its own filter row.
  useEffect(() => {
    const el = row.current;
    const chip = activeChip.current;
    if (!el || !chip) return;
    const left = chip.offsetLeft;
    const right = left + chip.offsetWidth;
    if (left >= el.scrollLeft && right <= el.scrollLeft + el.clientWidth) return;
    el.scrollTo?.({ left: left - (el.clientWidth - chip.offsetWidth) / 2 });
  }, [active]);

  return (
    <div className="flex min-w-0 items-center gap-2">
      <button
        type="button"
        onClick={onToggleNew}
        aria-pressed={newOnly}
        className={cn(
          "tracked flex shrink-0 cursor-pointer items-center gap-1.5 rounded-sm border px-3 py-1.5 text-[11px] font-semibold transition",
          newOnly
            ? "border-foreground bg-foreground text-background"
            : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
        )}
      >
        <Sparkles className="size-3" /> New
      </button>

      <div className="h-5 w-px shrink-0 bg-border" />

      <div className="relative min-w-0 flex-1">
        {/* Scrolled, not wrapped (see the note above). */}
        <div
          ref={row}
          className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {categories.map((name) => {
            const isActive = name === active;
            const isPicked = selectedCategories.includes(name);
            const canPick = selectable && name !== ALL_CATEGORIES;

            return (
              <span
                key={name}
                ref={isActive ? activeChip : undefined}
                data-category={name}
                className={cn(
                  "flex shrink-0 items-center rounded-sm border transition",
                  isActive
                    ? "border-foreground bg-foreground text-background"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                  isPicked && !isActive && "border-border",
                )}
              >
                {canPick && (
                  <button
                    type="button"
                    onClick={() => onToggleCategory(name)}
                    aria-pressed={isPicked}
                    aria-label={
                      isPicked
                        ? `Remove all of ${name} from the link`
                        : `Add all of ${name} to the link`
                    }
                    className={cn(
                      "my-1 ml-1.5 flex size-4 cursor-pointer items-center justify-center rounded-[2px] border transition",
                      isPicked
                        ? "border-foreground bg-background text-foreground"
                        : isActive
                          ? "border-background/50"
                          : "border-border",
                    )}
                  >
                    {isPicked && <Check className="size-3" strokeWidth={3} />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onSelect(name)}
                  aria-pressed={isActive}
                  className={cn(
                    "cursor-pointer whitespace-nowrap px-3 py-1.5 text-[13px]",
                    canPick && "pl-2",
                  )}
                >
                  {name}
                </button>
              </span>
            );
          })}
        </div>

        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 w-10 bg-linear-to-r from-background to-transparent transition-opacity duration-200",
            more.before ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 w-14 bg-linear-to-l from-background to-transparent transition-opacity duration-200",
            more.after ? "opacity-100" : "opacity-0",
          )}
        />
      </div>
    </div>
  );
}
