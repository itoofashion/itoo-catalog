"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  EXTENSION_READY_ATTRIBUTE,
  SYNC_MESSAGE_SOURCE,
  type SyncMessage,
} from "@/lib/sync/messages";

/**
 * The team's own controls, parked in the corner rather than across the top: the
 * catalog is a shop window, and the tools for running it should not be the first
 * thing in the frame.
 *
 * Sync is performed by the Chrome extension, not by the server — FashionGo has
 * no export API, so the products are read through the vendor admin session that
 * already exists in the operator's browser.
 */
export function StatusBar({
  productCount,
  syncedAt,
  onPreview,
}: {
  productCount: number;
  syncedAt: string;
  onPreview: () => void;
}) {
  const router = useRouter();
  const [hasExtension, setHasExtension] = useState(false);
  const [status, setStatus] = useState<"idle" | "running" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const check = () =>
      setHasExtension(document.documentElement.hasAttribute(EXTENSION_READY_ATTRIBUTE));
    check();
    // The content script may announce itself after this component mounts.
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    function onMessage(event: MessageEvent<SyncMessage>) {
      if (event.source !== window || event.data?.source !== SYNC_MESSAGE_SOURCE) return;

      if (event.data.type === "sync-progress") {
        const { done, total, stage } = event.data;
        setMessage(
          stage === "listing"
            ? `Listing products — ${done} of ${total}`
            : `Reading details — ${done} of ${total}`,
        );
      }
      if (event.data.type === "sync-complete") {
        setStatus("idle");
        setMessage(`Imported ${event.data.count} products.`);
        router.refresh();
      }
      if (event.data.type === "sync-failed") {
        setStatus("error");
        setMessage(event.data.error);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [router]);

  function requestSync() {
    setStatus("running");
    setMessage(null);
    window.postMessage(
      { source: SYNC_MESSAGE_SOURCE, type: "sync-request" } satisfies SyncMessage,
      window.location.origin,
    );
  }

  return (
    <aside
      data-status-bar=""
      className="fixed bottom-6 right-6 z-30 hidden max-w-[min(28rem,calc(100vw-3rem))] flex-col items-end gap-2 sm:flex"
    >
      {(message || !hasExtension) && (
        <p
          className={cn(
            "rounded-full border bg-card/95 px-4 py-1.5 text-sm shadow-lg backdrop-blur",
            status === "error" ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {message ?? "Chrome extension not detected"}
        </p>
      )}

      <div className="flex items-center gap-2 rounded-full border bg-card/95 p-2 pl-5 shadow-lg backdrop-blur">
        <span className="text-sm text-muted-foreground">
          <b className="font-semibold text-foreground">{productCount}</b> products ·{" "}
          {/* Rendered in the reader's own locale and timezone, which the server
              cannot know, so the first client render is allowed to differ. */}
          <time dateTime={syncedAt} suppressHydrationWarning>
            {formatSyncTime(syncedAt)}
          </time>
        </span>

        <Button variant="ghost" size="sm" onClick={onPreview}>
          <Eye /> Preview
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={requestSync}
          disabled={status === "running" || !hasExtension}
          title={
            hasExtension
              ? "Import the current products from FashionGo"
              : "Install the itoo Chrome extension to sync"
          }
        >
          {status === "running" ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          {status === "running" ? "Syncing…" : "Sync"}
        </Button>
      </div>
    </aside>
  );
}

function formatSyncTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "never"
    : date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}
