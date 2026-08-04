/**
 * Reads products out of the FashionGo vendor admin.
 *
 * FashionGo publishes no export API, so this rides on the session the operator
 * already has: the vendor admin keeps its bearer token in localStorage, and the
 * same API the admin screens use answers with the products behind it.
 *
 * Nothing is interpreted here — the raw payloads go to the catalog, which owns
 * the (tested) mapping into catalog products.
 */
const API = "https://vendoradmin.fashiongo.net/api/";
const ADMIN_URL = "https://vendoradmin.fashiongo.net/";

/** FashionGo rejects other page sizes; 20 is the smallest it accepts. */
const PAGE_SIZE = 20;

export class SyncError extends Error {}

/**
 * Finds the vendor admin's bearer token by reading it out of an open tab. If no
 * tab is open one is created in the background, which also lets us tell "not
 * logged in" apart from "not open".
 */
export async function getVendorToken() {
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
 * Products, newest first, with each one's detail — that is where the per-color
 * photos live.
 */
export async function fetchProducts(token, limit) {
  const list = await get(token, `items?pn=1&ps=${PAGE_SIZE}&saleType=W&pageType=1`);
  const records = list?.data?.active?.records ?? [];
  if (records.length === 0) {
    throw new SyncError("FashionGo returned no active products.");
  }

  const wanted = records.slice(0, limit);
  const products = [];
  for (const record of wanted) {
    const detail = await get(token, `item/${record.productId}`).catch(() => null);
    products.push({ record, detail: detail?.data ?? null });
  }
  return products;
}
