"use client";

import { useEffect, useState } from "react";
import { Check, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The point of the admin view: pick items, get one link to send to a client.
 * The link carries the selection, so there is nothing to save and nothing that
 * can go stale.
 */
export function ShareTray({
  count,
  shareQuery,
  onPreview,
  onClear,
}: {
  count: number;
  shareQuery: string;
  onPreview: () => void;
  onClear: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copyLink() {
    const url = `${window.location.origin}${window.location.pathname}${shareQuery}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard permission can be denied; the confirmation still shows so the
      // button never looks stuck, and the link is visible in the address bar.
    }
    setCopied(true);
  }

  return (
    <div
      data-share-tray=""
      className="fixed bottom-5 right-5 z-40 w-72 rounded-xl border bg-card p-4 shadow-lg"
    >
      <p className="text-sm font-semibold">
        {count} item{count === 1 ? "" : "s"} picked for a client
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        They open one link showing only these.
      </p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" className="flex-1" onClick={copyLink}>
          {copied ? <Check className="size-3.5" /> : <Link2 className="size-3.5" />}
          {copied ? "Copied" : "Copy link"}
        </Button>
        <Button size="sm" variant="outline" onClick={onPreview}>
          Preview
        </Button>
      </div>
      <button
        type="button"
        onClick={onClear}
        className="mt-2 w-full text-center text-[11px] text-muted-foreground hover:text-foreground"
      >
        Clear selection
      </button>
    </div>
  );
}
