/**
 * Runs on the catalog page. It announces that the extension is installed, and
 * relays the page's sync request to the background worker. The page itself
 * never talks to FashionGo.
 *
 * Content scripts cannot be ES modules, so the shared constants are repeated
 * here; they are also defined in src/messages.js and in the app.
 */
const SYNC_MESSAGE_SOURCE = "itoo-catalog";
const EXTENSION_READY_ATTRIBUTE = "data-itoo-extension";

document.documentElement.setAttribute(
  EXTENSION_READY_ATTRIBUTE,
  chrome.runtime.getManifest().version,
);

function reply(message) {
  window.postMessage({ source: SYNC_MESSAGE_SOURCE, ...message }, window.location.origin);
}

// Progress arrives from the background worker and is handed to the page, which
// cannot listen to extension messages itself.
chrome.runtime.onMessage.addListener((message) => {
  if (message?.source === SYNC_MESSAGE_SOURCE && message.type === "sync-progress") {
    reply(message);
  }
});

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data?.source !== SYNC_MESSAGE_SOURCE || event.data?.type !== "sync-request") {
    return;
  }

  chrome.runtime.sendMessage(
    { type: "import", catalogOrigin: window.location.origin },
    (response) => {
      if (chrome.runtime.lastError) {
        reply({ type: "sync-failed", error: chrome.runtime.lastError.message });
        return;
      }
      if (response?.ok) reply({ type: "sync-complete", count: response.count });
      else reply({ type: "sync-failed", error: response?.error ?? "Import failed" });
    },
  );
});
