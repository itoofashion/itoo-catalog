"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SyncRun } from "@/lib/sync/state";
import { requestSync } from "./actions";

/** While a sync is on its way the page checks in this often; at rest, hourly
    numbers do not change by the second, so it looks far less eagerly. */
const POLL_PENDING_MS = 15_000;
const POLL_IDLE_MS = 60_000;

/**
 * How much catalog there is, when it last changed, and the button that asks for
 * a sync. How the mirroring works stays out of the copy on purpose: this screen
 * is for managers, and the plumbing is documented in the repo, not in the
 * product. Navigation is the shell's job, not this block's.
 *
 * The button asks rather than syncs: FashionGo answers a whitelisted address
 * and the Worker has no fixed one, so the press leaves a note that the sync
 * agent polls for every minute (see lib/sync/state.ts). "Sync in progress…" is
 * therefore what a press achieves, and the page keeps asking the server until
 * a landed sync clears the note — nobody should have to reload to learn that
 * their sync finished.
 *
 * A client component for two reasons: the times have to be printed in the
 * reader's own timezone and against the reader's own clock, which only the
 * browser knows, and the button has an answer to show before any reload.
 */
export function CatalogStatus({
  productCount,
  syncedAt,
  lastRun,
  syncRequestedAt,
}: {
  productCount: number;
  syncedAt: string;
  /** The last completed sync, or null before the first one lands. */
  lastRun: SyncRun | null;
  /** When a sync was asked for and has not landed yet, or null. */
  syncRequestedAt: string | null;
}) {
  /** A press that has been accepted this visit; the prop covers earlier ones. */
  const [asked, setAsked] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [sending, startSending] = useTransition();
  const router = useRouter();

  // The server has answered for itself: a refreshed page either carries the
  // request in its own props, or carries the sync that landed. Either way the
  // local echo of the press has done its bridging job and retires, or a landed
  // sync could never clear the "in progress" line. Adjusted during render, the
  // way React resets state on a prop change, rather than in an effect.
  const answer = { requestedAt: syncRequestedAt, finishedAt: lastRun?.finishedAt ?? null };
  const [seenAnswer, setSeenAnswer] = useState(answer);
  if (
    seenAnswer.requestedAt !== answer.requestedAt ||
    seenAnswer.finishedAt !== answer.finishedAt
  ) {
    setSeenAnswer(answer);
    setAsked(false);
  }

  const pending = asked || syncRequestedAt !== null;

  // The numbers on this page belong to the server, so the page goes back for
  // them instead of letting a tab opened before lunch report the morning.
  useEffect(() => {
    const timer = setInterval(
      () => router.refresh(),
      pending ? POLL_PENDING_MS : POLL_IDLE_MS,
    );
    return () => clearInterval(timer);
  }, [pending, router]);

  function ask() {
    startSending(async () => {
      const result = await requestSync();
      if ("error" in result) {
        setRefusal(result.error);
        return;
      }
      setRefusal(null);
      setAsked(true);
    });
  }

  return (
    // The heading stands over the card rather than inside it, so the card
    // itself holds nothing but the facts.
    <section aria-label="FashionGo synchronization" className="flex flex-col gap-2">
      <h2 className="tracked text-[10px] text-muted-foreground">
        FashionGo synchronization
      </h2>

      <div className="flex flex-col rounded-sm border p-5">
        {/* Two stats side by side, each read the way the rows below read:
            label on the left, value against the right edge of its column, a
            rule between them so neither trails off into a gap. */}
        <dl className="grid grid-cols-2 divide-x divide-border pb-4">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pr-4">
            {/* "Styles" here because that is the word the catalog counts in:
                the grid says "737 styles" and this board has to say the same
                thing about the same number. */}
            <dt className="tracked text-[10px] text-muted-foreground">Styles</dt>
            <dd className="text-sm font-semibold">{productCount}</dd>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pl-4">
            <dt className="tracked text-[10px] text-muted-foreground">Last updated</dt>
            <dd className="text-sm font-semibold">
              {/* Rendered in the reader's own locale and timezone, which the
                  server cannot know, so the first client render is allowed to
                  differ from the markup it hydrates. */}
              <time dateTime={syncedAt} suppressHydrationWarning>
                {formatSyncTime(syncedAt)}
              </time>
            </dd>
          </div>
        </dl>

        {/* One fact in two lines on the left — how fresh, and when it freshens
            itself — and the way to freshen it sooner on the right. */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t pt-4">
          <div className="flex flex-col gap-1">
            <p className="text-sm">
              {lastRun ? (
                <>
                  Last synced{" "}
                  {/* Against the reader's clock, so it may disagree with the
                      markup the server rendered a moment earlier. */}
                  <time dateTime={lastRun.finishedAt} suppressHydrationWarning>
                    {timeAgo(lastRun.finishedAt)}
                  </time>{" "}
                  — {lastRun.styleCount} {lastRun.styleCount === 1 ? "style" : "styles"}
                </>
              ) : (
                "No sync has completed yet."
              )}
            </p>
            {/* No timezone on purpose: managers need "it happens every night",
                not an exercise in time arithmetic. */}
            <p className="text-xs text-muted-foreground">
              Updates automatically every night at midnight.
            </p>
          </div>

          {pending ? (
            /* Announced, because it replaces the button that was pressed. */
            <p role="status" className="flex items-center gap-2 text-sm font-semibold">
              <RefreshCw className="size-3.5 animate-spin" /> Sync in progress…
            </p>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={sending}
              onClick={ask}
              /* The brand's own pink, the one the New badges wear: the only
                 press on the page, allowed to be the only colour on it. */
              className="bg-brand text-brand-foreground hover:bg-brand/80"
            >
              <RefreshCw /> Sync now
            </Button>
          )}
        </div>

        {refusal && <p className="pt-2 text-xs text-destructive">{refusal}</p>}
      </div>
    </section>
  );
}

function formatSyncTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "never"
    : date.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}

/**
 * "3 hours ago", in the largest unit that has a whole one to count. The board
 * answers "is the catalog fresh?", and a reader answers that in minutes, hours
 * or days, never in an ISO timestamp.
 */
function timeAgo(value: string, now = new Date()): string {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "never";

  const seconds = Math.max(0, Math.round((now.getTime() - then) / 1000));
  if (seconds < 60) return "just now";

  const format = new Intl.RelativeTimeFormat("en", { numeric: "always" });
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return format.format(-minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return format.format(-hours, "hour");
  return format.format(-Math.floor(hours / 24), "day");
}
