"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Link2, Loader2 } from "lucide-react";
import posthog from "posthog-js";
import { createLink } from "@/app/s/actions";
import { Button } from "@/components/ui/button";
import type { CatalogSelection } from "@/lib/catalog/share";

/**
 * The outcome of the admin view: pick what a client asked for, get one link to
 * send them. It is the only thing on the page allowed to be loud, and it says
 * plainly what is in the link and how many styles that comes to, because a link
 * sent to a wholesale client is a promise about what they will see.
 */
export function LinkPanel({
  selection,
  productCount,
  newOnly,
  onClear,
}: {
  selection: CatalogSelection;
  productCount: number;
  /**
   * Whether the new-arrivals lens is on. It travels into the link: while the
   * team is looking at the new arrivals, that is what they are promising, and
   * the count above the button has already been narrowed to match.
   */
  newOnly: boolean;
  onClear: () => void;
}) {
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [minting, startMinting] = useTransition();

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(timer);
  }, [copied]);

  /**
   * The code used to be worked out here, in the browser, because it was the
   * selection spelled out in base64. Now it is six characters the database
   * hands out, so the press is a round trip and the button says so while it
   * waits: on a slow connection a silent button gets pressed twice.
   */
  function makeLink() {
    if (link) {
      void copy(link);
      return;
    }
    startMinting(async () => {
      setError("");
      const result = await createLink(selection, newOnly);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      const url = `${window.location.origin}/s/${result.code}`;
      setLink(url);
      posthog.capture("shared_catalog_link_created", {
        selected_category_count: selection.categories.length,
        selected_style_count: selection.skus.length,
        selected_product_count: productCount,
      });
      await copy(url);
    });
  }

  async function copy(url: string) {
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
          <p className="mt-1 truncate text-sm font-semibold">
            {describeSelection(selection, productCount, newOnly)}
          </p>
          {link && (
            <p className="mt-1 truncate text-xs text-muted-foreground" title={link}>
              {link}
            </p>
          )}
          {error && (
            <p role="alert" className="mt-1 text-xs text-destructive">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={makeLink} disabled={minting} className="flex-1 sm:flex-none">
            {minting ? <Loader2 className="animate-spin" /> : copied ? <Check /> : <Link2 />}
            {minting ? "Making link" : copied ? "Copied" : link ? "Copy again" : "Get link"}
          </Button>
          <Button variant="outline" onClick={onClear}>
            Clear
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * What the link promises, in one line.
 *
 * The total is spelled out only when it is news. Naming a category says what
 * the client asked for but not how much that is, so "all of Dresses" earns its
 * "67 styles". Styles picked by hand are already counted by the act of picking
 * them, and printing the total again gave us "5 picked items · 5 items", which
 * reads like a mistake because it is one.
 */
export function describeSelection(
  selection: CatalogSelection,
  productCount: number,
  /** Named on the line, because a lens that shrank the number has to say so. */
  newOnly = false,
): string {
  const styles = (count: number) => `${count} ${count === 1 ? "style" : "styles"}`;
  const lens = newOnly ? " · new arrivals" : "";

  if (selection.categories.length === 0) {
    // Under the lens the total is news again: fewer styles may open than were
    // picked, and the line must count what the client will see.
    return newOnly ? `${styles(productCount)}${lens}` : styles(selection.skus.length);
  }

  const parts =
    selection.categories.length === 1
      ? [`all of ${selection.categories[0]}`]
      : [`${selection.categories.length} categories`];
  if (selection.skus.length > 0) {
    parts.push(`${selection.skus.length} picked`);
  }

  return `${parts.join(" + ")} · ${styles(productCount)}${lens}`;
}
