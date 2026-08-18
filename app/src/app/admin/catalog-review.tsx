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
    <section aria-label="Hidden styles" className="flex flex-col">
      <h2 className="tracked pb-2 text-[10px] text-muted-foreground">
        Hidden styles{hidden.length > 0 && ` — ${hidden.length}`}
      </h2>

      {hidden.length === 0 ? (
        <p className="border-y py-4 text-sm text-muted-foreground">
          Nothing is hidden. The eye on a card in the catalog is what puts a
          style here.
        </p>
      ) : (
        <ul className="flex flex-col border-y">
          {hidden.map((style) => (
            <li
              key={style.sku}
              className="flex items-center gap-3 border-t py-2.5 first:border-t-0"
            >
              <Thumb style={style} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{style.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  Style {style.sku} · {style.category} · ${style.price.toFixed(2)}
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
    <section aria-label="Recent arrivals" className="flex flex-col">
      <h2 className="tracked pb-2 text-[10px] text-muted-foreground">Recent arrivals</h2>

      <label className="flex items-center gap-2 pb-3 text-[13px] text-muted-foreground">
        Added after
        <input
          type="date"
          value={since}
          onChange={(event) => chooseDay(event.target.value)}
          className="rounded-sm border border-border bg-transparent px-2 py-1 font-sans text-[13px] text-foreground outline-none transition focus:border-foreground"
        />
      </label>

      <p className="pb-2 text-[11px] text-muted-foreground" role="status">
        {arrived.length} {arrived.length === 1 ? "style" : "styles"} added since{" "}
        {since || "the beginning"}
      </p>

      {arrived.length > 0 && (
        <ul className="flex flex-col border-y">
          {shown.map((style) => (
            <li
              key={style.sku}
              className={cn(
                "flex items-center gap-3 border-t py-2.5 first:border-t-0",
                style.hidden && "opacity-50",
              )}
            >
              <Thumb style={style} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{style.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  Style {style.sku} · {style.category}
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
        <p className="pt-2 text-[11px] text-muted-foreground">
          Showing the first {shown.length}; narrow the day to see the rest.
        </p>
      )}
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

