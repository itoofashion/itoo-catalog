"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { pageWindow } from "@/lib/catalog/pagination";

export function PaginationBar({
  page,
  pages,
  onGo,
}: {
  page: number;
  pages: number;
  onGo: (page: number) => void;
}) {
  if (pages <= 1) return null;

  return (
    <nav
      data-pagination=""
      aria-label="Catalog pages"
      className="flex items-center justify-center gap-1 pt-12"
    >
      <button
        type="button"
        onClick={() => onGo(page - 1)}
        disabled={page === 1}
        aria-label="Previous page"
        className="flex size-9 cursor-pointer items-center justify-center rounded-sm border border-border text-muted-foreground transition hover:text-foreground disabled:cursor-default disabled:opacity-40"
      >
        <ChevronLeft className="size-4" />
      </button>

      {pageWindow(page, pages).map((entry, index) =>
        entry === null ? (
          <span key={`gap-${index}`} className="px-1.5 text-muted-foreground">
            …
          </span>
        ) : (
          <button
            key={entry}
            type="button"
            onClick={() => onGo(entry)}
            aria-current={entry === page ? "page" : undefined}
            className={cn(
              "flex h-9 min-w-9 cursor-pointer items-center justify-center rounded-sm border px-2.5 text-sm transition",
              entry === page
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {entry}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => onGo(page + 1)}
        disabled={page === pages}
        aria-label="Next page"
        className="flex size-9 cursor-pointer items-center justify-center rounded-sm border border-border text-muted-foreground transition hover:text-foreground disabled:cursor-default disabled:opacity-40"
      >
        <ChevronRight className="size-4" />
      </button>
    </nav>
  );
}
