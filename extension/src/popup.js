/**
 * A manual way to run the same import as the catalog's Sync button, useful when
 * the catalog page is not open. The catalog address is remembered between runs.
 */
const DEFAULT_ORIGIN = "http://localhost:3000";

const originInput = document.getElementById("origin");
const importButton = document.getElementById("import");
const status = document.getElementById("status");

const stored = await chrome.storage.local.get("catalogOrigin");
originInput.value = stored.catalogOrigin ?? DEFAULT_ORIGIN;

function show(message, kind = "") {
  status.textContent = message;
  status.className = kind;
}

importButton.addEventListener("click", async () => {
  let origin;
  try {
    origin = new URL(originInput.value.trim()).origin;
  } catch {
    show("That does not look like a web address.", "error");
    return;
  }

  await chrome.storage.local.set({ catalogOrigin: origin });
  importButton.disabled = true;
  show("Reading products from FashionGo…");

  chrome.runtime.sendMessage({ type: "import", catalogOrigin: origin }, (response) => {
    importButton.disabled = false;
    if (chrome.runtime.lastError) {
      show(chrome.runtime.lastError.message, "error");
    } else if (response?.ok) {
      show(`Imported ${response.count} products.`, "done");
    } else {
      show(response?.error ?? "Import failed.", "error");
    }
  });
});
