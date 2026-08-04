/**
 * Reads products out of the FashionGo vendor admin. Superseded and switched off.
 *
 * Product data now comes from FashionGo's published REST API
 * (pubapi.fashiongo.net, `GET /v1.0/items`), which the catalog calls directly on
 * a schedule, so there is nothing for an extension to do, and this file is kept
 * only until that changeover is finished.
 */

/** Flipped on only if the API route is ever unavailable and someone re-enables it. */
const ENABLED = false;
const API = "https://vendoradmin.fashiongo.net/api/";
const ADMIN_URL = "https://vendoradmin.fashiongo.net/";

/** FashionGo rejects other page sizes; 20 is the smallest it accepts. */
const PAGE_SIZE = 20;

/** Polite towards an admin API that was never meant to be crawled. */
const DETAIL_CONCURRENCY = 4;

export class SyncError extends Error {}

/**
 * Finds the vendor admin's bearer token by reading it out of an open tab. If no
 * tab is open one is created in the background, which also lets us tell "not
 * logged in" apart from "not open".
 */
export async function getVendorToken() {
  if (!ENABLED) {
    throw new SyncError(
      "Importing through the vendor admin is switched off. The catalog syncs " +
        "itself from FashionGo's API.",
    );
  }

  let [tab] = await chrome.tabs.query({ url: `${ADMIN_URL}*` });
  let openedTab = false;

  if (!tab) {
    tab = await chrome.tabs.create({ url: ADMIN_URL, active: false });
    openedTab = true;
    await waitForTabToLoad(tab.id);
  }

  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.localStorage.getItem("token"),
    });
    const token = result?.result;
    if (!token) {
      throw new SyncError(
        "Not signed in to FashionGo. Open vendoradmin.fashiongo.net, sign in, then sync again.",
      );
    }
    return token;
  } finally {
    if (openedTab) await chrome.tabs.remove(tab.id).catch(() => {});
  }
}

function waitForTabToLoad(tabId) {
  return new Promise((resolve) => {
    const listener = (id, info) => {
      if (id === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
    // Don't hang forever if the tab never reports complete.
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, 15000);
  });
}

async function get(token, path) {
  const response = await fetch(API + path, {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      // The vendor admin identifies itself with "2" on its data endpoints.
      "Referer-Application-Type": "2",
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401 || response.status === 403) {
    throw new SyncError(
      "The FashionGo session expired. Sign in at vendoradmin.fashiongo.net and sync again.",
    );
  }
  if (!response.ok) {
    throw new SyncError(`FashionGo returned ${response.status} for ${path}`);
  }
  return response.json();
}

export async function fetchCategories(token) {
  const body = await get(token, "misc/categories");
  return Array.isArray(body?.data) ? body.data : [];
}

/**
 * Every active product, with each one's detail. That is where the per-color
 * photos and the size run live.
 *
 * This is around eight hundred requests against a vendor admin that was never
 * meant to be crawled, so details are fetched a few at a time and progress is
 * reported back to whoever started the sync.
 */
export async function fetchProducts(token, onProgress = () => {}) {
  const records = [];
  let total = Infinity;

  for (let page = 1; records.length < total; page += 1) {
    const list = await get(token, `items?pn=${page}&ps=${PAGE_SIZE}&saleType=W&pageType=1`);
    const active = list?.data?.active;
    const batch = active?.records ?? [];
    total = active?.total?.totalCount ?? records.length;
    if (batch.length === 0) break;
    records.push(...batch);
    onProgress(records.length, total, "listing");
  }

  if (records.length === 0) {
    throw new SyncError("FashionGo returned no active products.");
  }

  const products = new Array(records.length);
  let next = 0;
  let done = 0;

  async function worker() {
    for (;;) {
      const index = next++;
      if (index >= records.length) return;
      const record = records[index];
      const detail = await get(token, `item/${record.productId}`).catch(() => null);
      products[index] = { record, detail: detail?.data ?? null };
      onProgress(++done, records.length, "details");
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(DETAIL_CONCURRENCY, records.length) }, worker),
  );
  return products;
}
