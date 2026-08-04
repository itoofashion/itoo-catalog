import { SYNC_MESSAGE_SOURCE, SYNC_SECRET_HEADER } from "./messages.js";
import { fetchCategories, fetchProducts, getVendorToken, SyncError } from "./fashiongo.js";

/**
 * Runs the import: read the products out of FashionGo using the operator's own
 * vendor admin session, then hand them to the catalog, which maps and stores
 * them. Triggered either by the catalog page's Sync button or the popup.
 */
async function runImport(catalogOrigin, report) {
  const token = await getVendorToken();
  const categories = await fetchCategories(token);
  const products = await fetchProducts(token, report);

  // The catalog is on a public address, so it only accepts a sync that proves it
  // came from us. The secret is set in the extension popup.
  const { syncSecret } = await chrome.storage.local.get("syncSecret");
  const headers = { "Content-Type": "application/json" };
  if (syncSecret) headers[SYNC_SECRET_HEADER] = syncSecret;

  const response = await fetch(`${catalogOrigin}/api/sync`, {
    method: "POST",
    headers,
    body: JSON.stringify({ categories, products }),
  });

  const body = await response.json().catch(() => ({}));
  if (response.status === 401) {
    throw new SyncError(
      "The catalog rejected the sync secret. Check it in the extension popup.",
    );
  }
  if (!response.ok) {
    throw new SyncError(body.error ?? `The catalog rejected the import (${response.status})`);
  }
  return body.count ?? products.length;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "import") return false;

  const catalogOrigin =
    message.catalogOrigin ??
    (sender.tab?.url ? new URL(sender.tab.url).origin : null);

  if (!catalogOrigin) {
    sendResponse({ ok: false, error: "Could not tell which catalog to sync." });
    return false;
  }

  // Importing the whole catalog takes a while, so the page is told how far along
  // it is rather than being left with a spinner.
  const tabId = sender.tab?.id;
  const report = (done, total, stage) => {
    if (tabId === undefined) return;
    chrome.tabs
      .sendMessage(tabId, {
        source: SYNC_MESSAGE_SOURCE,
        type: "sync-progress",
        done,
        total,
        stage,
      })
      .catch(() => {});
  };

  runImport(catalogOrigin, report)
    .then((count) => sendResponse({ ok: true, count }))
    .catch((error) => {
      const message =
        error instanceof SyncError ? error.message : `Import failed: ${error.message}`;
      sendResponse({ ok: false, error: message });
    });

  // Keeps the message channel open for the async work above.
  return true;
});
