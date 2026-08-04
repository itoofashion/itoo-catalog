"use client";

import { useEffect, useState } from "react";
import { Check, Link2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CatalogSelection } from "@/lib/catalog/share";
import { encodeSelection } from "@/lib/links/code";

/**
 * The whole point of the admin view: pick what a client asked for, get one link
 * to send them. It sits centred along the bottom edge because it is the outcome
 * of the work above it, and it is the only thing on the page allowed to shout.
 *
 * The link is shortened before it is handed over — a wholesale client judges the
 * sender by what lands in the chat, and a hundred characters of query string
 * reads as a machine talking.
 */
export function LinkPanel({
  selection,
  productCount,
  onClear,
}: {
  selection: CatalogSelection;
  productCount: number;
  onClear: () => void;
}) {
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(timer);
  }, [copied]);

  async function makeLink() {
    const url = `${window.location.origin}/s/${encodeSelection(selection)}`;
    setLink(url);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Clipboard access can be denied; the link stays on screen to copy by hand.
    }
  }

  const summary = describe(selection, productCount);

  return (
    <div
      data-link-panel=""
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-6 sm:bottom-6 sm:pb-0"
    >
      <div className="flex w-full max-w-xl flex-col gap-4 rounded-2xl border bg-card/95 p-5 shadow-2xl backdrop-blur sm:flex-row sm:items-center sm:gap-5 sm:p-6">
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold">{summary}</p>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {link || "One link, ready to send in chat."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={makeLink} className="flex-1 sm:flex-none">
            {copied ? <Check /> : <Link2 />}
            {copied ? "Copied" : link ? "Copy again" : "Get link"}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClear}
            aria-label="Clear selection"
            title="Clear selection"
          >
            <X />
          </Button>
        </div>
      </div>
    </div>
  );
}

function describe(selection: CatalogSelection, productCount: number): string {
  const parts: string[] = [];
  if (selection.categories.length > 0) {
    parts.push(
      selection.categories.length === 1
        ? `All of ${selection.categories[0]}`
        : `${selection.categories.length} categories`,
    );
  }
  if (selection.skus.length > 0) {
    parts.push(`${selection.skus.length} ${selection.skus.length === 1 ? "style" : "styles"}`);
  }
  const picked = parts.join(" + ");
  return `${picked} — ${productCount} ${productCount === 1 ? "item" : "items"} for the client`;
}
