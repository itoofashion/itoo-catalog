"use client";

import { useMemo, useState, useTransition } from "react";
/* eslint-disable @next/next/no-img-element -- the optimizer is off on Workers
   (see next.config.ts); these are our own /i/ photos at thumbnail size. */
import { setStyleHidden } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ARRIVALS_COOKIE, type ReviewStyle } from "./review-style";

/**
 * Every hidden style on one screen, with the way back beside each.
 *
 * Hiding happens in the catalog, on the card, where the style is in front of
 * the eye that hides it. Un-hiding is different: sold-out styles pile up over
 * weeks and come back one by one, and hunting dimmed cards across pages was the
 * complaint this list answers.
 */
export function HiddenStylesReview({ styles }: { styles: ReviewStyle[] }) {
  // What this visit has already put back, kept out of the list at once; the
  // server is asked in the background and the row returns only on a refusal.
  const [restored, setRestored] = useState<Set<string>>(new Set());
  const [refusal, setRefusal] = useState<string | null>(null);
  const [, startRestoring] = useTransition();

  const hidden = styles.filter((style) => style.hidden && !restored.has(style.sku));

  function restore(sku: string) {
    setRestored((current) => new Set(current).add(sku));
    setRefusal(null);
    startRestoring(async () => {
      const result = await setStyleHidden(sku, false);
      if ("error" in result) {
        setRestored((current) => {
          const next = new Set(current);
          next.delete(sku);
          return next;
        });
        setRefusal(result.error);
      }
    });
  }

  return (
    <section aria-label="Hidden styles" className="flex flex-col gap-2">
      <h2 className="tracked text-[10px] text-muted-foreground">
        Hidden styles{hidden.length > 0 && ` — ${hidden.length}`}
      </h2>

      {hidden.length === 0 ? (
        <p className="rounded-sm border p-5 text-sm text-muted-foreground">
          Nothing is hidden. The eye on a card in the catalog is what puts a
          style here.
        </p>
      ) : (
        <ul className="flex flex-col rounded-sm border px-5 py-1">
          {hidden.map((style) => (
            <li
              key={style.sku}
              className="flex items-center gap-3 border-t py-2.5 first:border-t-0 last:pb-0"
            >
              <Thumb style={style} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{style.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  SKU: {style.sku} · {style.category} · ${style.price.toFixed(2)}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => restore(style.sku)}
                aria-label={`Show ${style.sku} to clients again`}
              >
                Show again
              </Button>
            </li>
          ))}
        </ul>
      )}

      {refusal && <p className="pt-2 text-xs text-destructive">{refusal}</p>}
    </section>
  );
}

/** Rows drawn before the list says how many more there are. */
const ARRIVALS_SHOWN = 50;

/**
 * What arrived when — the delivery answer to "what came in since I last
 * looked". Newest first, from a chosen day. The day arrives from the server,
 * which read it from the cookie this component writes: the list reopens on the
 * question it was left with, and reloading is not starting over.
 */
export function RecentArrivals({
  styles,
  initialSince,
}: {
  styles: ReviewStyle[];
  initialSince: string;
}) {
  const [since, setSince] = useState(initialSince);

  function chooseDay(value: string) {
    setSince(value);
    // Path "/" rather than "/admin" so the whole admin area, present and
    // future, reads one answer. A year, renewed on every choice.
    document.cookie = `${ARRIVALS_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
  }

  const arrived = useMemo(
    () =>
      styles
        // ISO dates compare as strings, day against day. A style with no date
        // cannot claim to qualify, so it is left out rather than guessed at.
        .filter((style) => since && style.addedAt.slice(0, 10) >= since)
        .sort((a, b) => b.addedAt.localeCompare(a.addedAt)),
    [styles, since],
  );
  const shown = arrived.slice(0, ARRIVALS_SHOWN);

  return (
    <section aria-label="Recent arrivals" className="flex flex-col gap-2">
      <h2 className="tracked text-[10px] text-muted-foreground">Recent arrivals</h2>

      <div
        className={cn(
          "flex flex-col rounded-sm border p-5",
          // The list runs to the card's own bottom edge, so the row the cap
          // cuts in half is cut by the card itself.
          arrived.length > 0 && "pb-0",
        )}
      >
        {/* The count is the card's answer and wears the boldest text in it;
            the chooser beside it is the question being answered. */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pb-3">
          <p className="text-sm font-semibold" role="status">
            {arrived.length} {arrived.length === 1 ? "style" : "styles"}
          </p>
          <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
            Added after
            <input
              type="date"
              value={since}
              onChange={(event) => chooseDay(event.target.value)}
              className="rounded-sm border border-border bg-transparent px-2 py-1 font-sans text-[13px] text-foreground outline-none transition focus:border-foreground"
            />
          </label>
        </div>

        {arrived.length > 0 && (
          /* Capped and scrolled: a month of arrivals is a long list, and this
             card is one of two on the page, not the page itself. The cap lands
             mid-row on purpose — a half-cut row is what says "there is more"
             without a scrollbar having to. */
          <ul className="flex max-h-[21rem] flex-col overflow-y-auto border-t">
          {shown.map((style) => (
            <li
              key={style.sku}
              className={cn(
                "flex items-center gap-3 border-t py-2.5 first:border-t-0 last:pb-0",
                style.hidden && "opacity-50",
              )}
            >
              <Thumb style={style} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{style.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  SKU: {style.sku} · {style.category}
                  {style.hidden && " · hidden"}
                </p>
              </div>
              <time
                dateTime={style.addedAt}
                className="shrink-0 text-[11px] tabular-nums text-muted-foreground"
              >
                {style.addedAt.slice(0, 10)}
              </time>
            </li>
          ))}
          </ul>
        )}

        {arrived.length > shown.length && (
          <p className="border-t py-2.5 text-[11px] text-muted-foreground">
            Showing the first {shown.length}; narrow the day to see the rest.
          </p>
        )}
      </div>
    </section>
  );
}

function Thumb({ style }: { style: ReviewStyle }) {
  return style.photo ? (
    <img
      src={style.photo}
      alt=""
      className="h-14 w-10 shrink-0 rounded-sm border object-cover"
    />
  ) : (
    <div aria-hidden className="h-14 w-10 shrink-0 rounded-sm border bg-muted" />
  );
}

