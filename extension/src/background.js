import { PILOT_PRODUCT_LIMIT } from "./messages.js";
import { fetchCategories, fetchProducts, getVendorToken, SyncError } from "./fashiongo.js";

/**
 * Runs the import: read the products out of FashionGo using the operator's own
 * vendor admin session, then hand them to the catalog, which maps and stores
 * them. Triggered either by the catalog page's Sync button or the popup.
 */
async function runImport(catalogOrigin) {
  const token = await getVendorToken();
  const [categories, products] = await Promise.all([
    fetchCategories(token),
    fetchProducts(token, PILOT_PRODUCT_LIMIT),
  ]);

  const response = await fetch(`${catalogOrigin}/api/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ categories, products }),
  });

  const body = await response.json().catch(() => ({}));
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

  runImport(catalogOrigin)
    .then((count) => sendResponse({ ok: true, count }))
    .catch((error) => {
      const message =
        error instanceof SyncError ? error.message : `Import failed: ${error.message}`;
      sendResponse({ ok: false, error: message });
    });

  // Keeps the message channel open for the async work above.
  return true;
});
