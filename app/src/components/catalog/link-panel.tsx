"use client";

import { useEffect, useState } from "react";
import { Check, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CatalogSelection } from "@/lib/catalog/share";
import { encodeSelection } from "@/lib/links/code";

/**
 * The outcome of the admin view: pick what a client asked for, get one link to
 * send them. It is the only thing on the page allowed to be loud, and it says
 * plainly what is in the link and how many items that comes to — a link sent to
 * a wholesale client is a promise about what they will see.
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

  return (
    <div
      data-link-panel=""
      className="pointer-events-auto w-full border border-border bg-background shadow-[0_-2px_20px_rgba(0,0,0,.06)] sm:w-auto sm:min-w-[26rem] sm:shadow-lg"
    >
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-5">
        <div className="min-w-0 flex-1">
          <p className="tracked text-[11px] text-muted-foreground">Selected for a client</p>
          <p className="mt-1 truncate text-sm font-semibold">{describe(selection, productCount)}</p>
          {link && (
            <p className="mt-1 truncate text-xs text-muted-foreground" title={link}>
              {link}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={makeLink} className="flex-1 sm:flex-none">
            {copied ? <Check /> : <Link2 />}
            {copied ? "Copied" : link ? "Copy again" : "Get link"}
          </Button>
          <Button variant="outline" onClick={onClear}>
            Clear
          </Button>
        </div>
      </div>
    </div>
  );
}

function describe(selection: CatalogSelection, productCount: number): string {
  const parts: string[] = [];
  if (selection.categories.length === 1) parts.push(`all of ${selection.categories[0]}`);
  else if (selection.categories.length > 1) parts.push(`${selection.categories.length} categories`);
  if (selection.skus.length > 0) {
    parts.push(`${selection.skus.length} picked ${selection.skus.length === 1 ? "item" : "items"}`);
  }

  const items = `${productCount} ${productCount === 1 ? "item" : "items"}`;
  return `${parts.join(" + ")} — ${items}`;
}
