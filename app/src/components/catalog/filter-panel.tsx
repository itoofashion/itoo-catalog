"use client";

import { Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The filter rail: categories with counts, and the New arrivals switch.
 *
 * One panel serves both columns of the page: on a laptop it stands to the left
 * of the grid, on a phone the same panel opens under the Filters button. It is
 * written once so the two can never disagree about what filtering means.
 *
 * Two different marks live on a category row on purpose, because two different
 * things can be done to a category. The checkbox narrows what is on screen, for
 * everyone, and more than one can be ticked: a buyer stocking up on skirts and
 * blazers reads them as one rack. The small plus, which only the team sees, puts
 * the whole category into the link being built for a client — the same job as
 * the checkbox on a card, so it fills in and shows a check the same way.
 */
export function FilterPanel({
  categories,
  counts,
  activeCategories,
  onToggleShown,
  newOnly,
  onToggleNew,
  onClear,
  selectable,
  selectedCategories,
  onToggleLink,
}: {
  /** Every category the visitor can reach, without "All". */
  categories: string[];
  /** How many styles each category would show under the other filters. */
  counts: ReadonlyMap<string, number>;
  /** The categories currently ticked open. */
  activeCategories: string[];
  onToggleShown: (category: string) => void;
  newOnly: boolean;
  onToggleNew: () => void;
  /** Puts the panel back to showing everything. */
  onClear: () => void;
  /** Whether this visitor builds links: the team, not in the client preview. */
  selectable: boolean;
  /** Whole categories already in the link. */
  selectedCategories: string[];
  onToggleLink: (category: string) => void;
}) {
  const anythingOn = activeCategories.length > 0 || newOnly;

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col">
        <legend className="tracked pb-2 text-[10px] text-muted-foreground">
          Categories
        </legend>
        {categories.map((name) => {
          const shown = activeCategories.includes(name);
          const picked = selectedCategories.includes(name);
          // The count is a promise about ticking, so a category the other
          // filters have emptied says 0 rather than disappearing: a row that
          // vanishes underneath a search reads as a bug, not as an answer.
          const count = counts.get(name) ?? 0;

          return (
            <div key={name} className="flex items-center gap-1.5">
              <label
                data-category={name}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-sm py-1.5 text-[13px] transition hover:text-foreground"
              >
                <input
                  type="checkbox"
                  checked={shown}
                  onChange={() => onToggleShown(name)}
                  className="peer sr-only"
                />
                {/* The same square as the one on a card, to the pixel, but for
                    a different job; the plus beside it is what a card's box
                    does. */}
                <span
                  aria-hidden
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-sm border transition peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring",
                    shown
                      ? "border-foreground bg-foreground text-background"
                      : "border-border",
                  )}
                >
                  {shown && <Check className="size-3.5" strokeWidth={3} />}
                </span>
                <span
                  className={cn(
                    "truncate",
                    shown ? "font-semibold text-foreground" : "text-muted-foreground",
                  )}
                >
                  {name}
                </span>
                <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground">
                  {count}
                </span>
              </label>

              {selectable && (
                <button
                  type="button"
                  onClick={() => onToggleLink(name)}
                  aria-pressed={picked}
                  aria-label={
                    picked
                      ? `Remove all of ${name} from the link`
                      : `Add all of ${name} to the link`
                  }
                  className={cn(
                    "flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-sm border transition",
                    picked
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                  )}
                >
                  {picked ? (
                    <Check className="size-3.5" strokeWidth={3} />
                  ) : (
                    <Plus className="size-3" />
                  )}
                </button>
              )}
            </div>
          );
        })}
      </fieldset>

      <div className="flex flex-col border-t pt-4">
        <label className="flex cursor-pointer items-center gap-2.5 py-1.5 text-[13px]">
          <input
            type="checkbox"
            checked={newOnly}
            onChange={onToggleNew}
            className="peer sr-only"
          />
          <span
            aria-hidden
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-sm border transition peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring",
              newOnly ? "border-foreground bg-foreground text-background" : "border-border",
            )}
          >
            {newOnly && <Check className="size-3.5" strokeWidth={3} />}
          </span>
          <span
            className={cn(
              newOnly ? "font-semibold text-foreground" : "text-muted-foreground",
            )}
          >
            New arrivals only
          </span>
        </label>
      </div>

      {/* Rendered only while there is something to clear: a control that mostly
          does nothing teaches people to stop reading the panel. */}
      {anythingOn && (
        <button
          type="button"
          onClick={onClear}
          className="tracked self-start cursor-pointer border-b border-transparent pb-0.5 text-[11px] font-semibold text-muted-foreground transition hover:border-foreground hover:text-foreground"
        >
          Show everything
        </button>
      )}
    </div>
  );
}
