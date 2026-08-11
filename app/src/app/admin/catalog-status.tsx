"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SyncRun } from "@/lib/sync/state";
import { requestSync } from "./actions";

/**
 * What the team gets after signing in: how much catalog there is, when it last
 * changed, where it comes from, the button that asks for a sync, and the way
 * out.
 *
 * The button asks rather than syncs: FashionGo answers a whitelisted address
 * and the Worker has no fixed one, so the press leaves a note that the sync
 * agent polls for every minute (see lib/sync/state.ts). "Sync requested…" is
 * therefore the whole truth of what a press achieves, and the line stays until
 * a landed sync clears the note.
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

  const pending = asked || syncRequestedAt !== null;

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
    <div className="flex flex-col gap-8">
      <dl className="flex flex-col">
        <div className="flex items-center justify-between gap-4 border-t py-3">
          {/* "Styles" here because that is the word the catalog counts in: the
              grid says "737 styles" and this board has to say the same thing
              about the same number. */}
          <dt className="tracked text-[10px] text-muted-foreground">Styles</dt>
          <dd className="text-sm font-semibold">{productCount}</dd>
        </div>

        <div className="flex items-center justify-between gap-4 border-t py-3">
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

        <div className="flex flex-col gap-2.5 border-t py-3">
          <dt className="tracked text-[10px] text-muted-foreground">FashionGo sync</dt>
          <dd className="flex flex-col gap-2.5 text-sm">
            <p className="text-muted-foreground">
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

            {pending ? (
              /* Announced, because it replaces the button that was pressed. */
              <p role="status" className="font-semibold">
                Sync requested…
              </p>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                disabled={sending}
                onClick={ask}
              >
                <RefreshCw /> Sync now
              </Button>
            )}

            {refusal && <p className="text-xs text-destructive">{refusal}</p>}
          </dd>
        </div>

        <div className="flex flex-col gap-2 border-y py-3">
          <dt className="tracked text-[10px] text-muted-foreground">Source</dt>
          <dd className="text-sm leading-relaxed text-muted-foreground">
            The catalog mirrors the itoo account on FashionGo, read through the
            official FashionGo REST API by a sync agent on its own schedule.
            Sync now asks the agent to run sooner.
          </dd>
        </div>
      </dl>

      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="outline">
          <Link href="/">
            <ArrowLeft /> Catalog
          </Link>
        </Button>

        {/* A plain form, not a fetch: signing out has to work even when the
            page's JavaScript never loaded. */}
        <form action="/admin/sign-out" method="post">
          <Button type="submit" variant="ghost">
            <LogOut /> Sign out
          </Button>
        </form>
      </div>
    </div>
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
