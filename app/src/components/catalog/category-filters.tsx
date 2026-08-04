"use client";

import { Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { ALL_CATEGORIES } from "@/lib/catalog/share";

/**
 * Two jobs in one control, which is why the checkbox sits inside the chip
 * rather than beside it: pressing the name narrows what is on screen, ticking
 * the box puts the whole category into the link being built. A sales person
 * browsing and a sales person assembling a link are the same person, a second
 * apart.
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
  return (
    <div className="flex flex-wrap items-center gap-2">
      {categories.map((name) => {
        const isActive = name === active;
        const isPicked = selectedCategories.includes(name);
        const canPick = selectable && name !== ALL_CATEGORIES;

        return (
          <span
            key={name}
            data-category={name}
            className={cn(
              "flex items-center rounded-full border transition",
              isActive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground",
              isPicked && !isActive && "border-brand/60",
            )}
          >
            {canPick && (
              <button
                type="button"
                onClick={() => onToggleCategory(name)}
                aria-pressed={isPicked}
                aria-label={
                  isPicked ? `Remove all of ${name} from the link` : `Add all of ${name} to the link`
                }
                className={cn(
                  "my-1 ml-1.5 flex size-6 items-center justify-center rounded-full border transition",
                  isPicked
                    ? "border-brand bg-brand text-brand-foreground"
                    : isActive
                      ? "border-primary-foreground/40"
                      : "border-border",
                )}
              >
                {isPicked && <Check className="size-4" strokeWidth={3} />}
              </button>
            )}
            <button
              type="button"
              onClick={() => onSelect(name)}
              aria-pressed={isActive}
              className={cn("px-4 py-2 text-base", canPick && "pl-2.5")}
            >
              {name}
            </button>
          </span>
        );
      })}

      <button
        type="button"
        onClick={onToggleNew}
        aria-pressed={newOnly}
        className={cn(
          "flex items-center gap-2 rounded-full border px-4 py-2 text-base transition",
          newOnly
            ? "border-brand bg-brand text-brand-foreground"
            : "border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground",
        )}
      >
        <Sparkles className="size-4" /> New arrivals
      </button>
    </div>
  );
}
