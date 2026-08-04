/**
 * The contract between the catalog page and the Chrome extension.
 *
 * The page never talks to FashionGo itself. It posts a request on the window
 * and the extension's content script picks it up. Both sides import these
 * constants so a rename cannot silently break the handshake.
 */
export const SYNC_MESSAGE_SOURCE = "itoo-catalog";

/** The content script sets this on <html> so the page can tell it is installed. */
export const EXTENSION_READY_ATTRIBUTE = "data-itoo-extension";

export type SyncMessage =
  | { source: typeof SYNC_MESSAGE_SOURCE; type: "sync-request" }
  | {
      source: typeof SYNC_MESSAGE_SOURCE;
      type: "sync-progress";
      done: number;
      total: number;
      stage: "listing" | "details" | "photos";
    }
  | { source: typeof SYNC_MESSAGE_SOURCE; type: "sync-complete"; count: number }
  | { source: typeof SYNC_MESSAGE_SOURCE; type: "sync-failed"; error: string };
