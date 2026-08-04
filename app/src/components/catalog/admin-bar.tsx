"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  EXTENSION_READY_ATTRIBUTE,
  SYNC_MESSAGE_SOURCE,
  type SyncMessage,
} from "@/lib/sync/messages";

/**
 * Sync is performed by the Chrome extension, not by the server: FashionGo has no
 * export API, so the products are read through the vendor admin session that
 * already exists in the operator's browser. This bar asks the extension to run
 * that import and reports what came back.
 */
export function AdminBar({
  syncedAt,
  productCount,
}: {
  syncedAt: string;
  productCount: number;
}) {
  const router = useRouter();
  const [hasExtension, setHasExtension] = useState(false);
  const [status, setStatus] = useState<"idle" | "running" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const check = () =>
      setHasExtension(
        document.documentElement.hasAttribute(EXTENSION_READY_ATTRIBUTE),
      );
    check();
    // The content script may announce itself after this component mounts.
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    function onMessage(event: MessageEvent<SyncMessage>) {
      if (event.source !== window || event.data?.source !== SYNC_MESSAGE_SOURCE) return;

      if (event.data.type === "sync-complete") {
        setStatus("idle");
        setMessage(`Imported ${event.data.count} products from FashionGo.`);
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
    <div className="border-b bg-secondary/50">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-6 py-2.5 text-xs text-muted-foreground">
        <span>
          {productCount} products · last synced{" "}
          <time dateTime={syncedAt}>{formatSyncTime(syncedAt)}</time>
        </span>

        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          onClick={requestSync}
          disabled={status === "running" || !hasExtension}
          title={
            hasExtension
              ? "Import the current products from FashionGo"
              : "Install the itoo Chrome extension to sync"
          }
        >
          {status === "running" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          {status === "running" ? "Syncing…" : "Sync from FashionGo"}
        </Button>

        {!hasExtension && (
          <span className="basis-full text-[11px] sm:basis-auto">
            Chrome extension not detected
          </span>
        )}
        {message && (
          <span
            className={`basis-full text-[11px] sm:basis-auto ${
              status === "error" ? "text-destructive" : "text-foreground"
            }`}
          >
            {message}
          </span>
        )}
      </div>
    </div>
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
