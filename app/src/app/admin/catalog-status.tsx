"use client";

import Link from "next/link";
import { ArrowLeft, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * What the team gets after signing in: how much catalog there is, when it last
 * changed, where it comes from, and the way out. Deliberately a read-only board
 * rather than a console. Syncing is started from the catalog itself, which is
 * where the operator can see what a sync did.
 *
 * A client component for one reason: the time has to be printed in the reader's
 * own timezone, which only the browser knows.
 */
export function CatalogStatus({
  productCount,
  syncedAt,
}: {
  productCount: number;
  syncedAt: string;
}) {
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

        <div className="flex flex-col gap-2 border-y py-3">
          <dt className="tracked text-[10px] text-muted-foreground">Source</dt>
          <dd className="text-sm leading-relaxed text-muted-foreground">
            The catalog is served from the snapshot of FashionGo that ships with
            this app. Continuous updates will move to the official FashionGo REST
            API, and the key for it has been requested.
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
