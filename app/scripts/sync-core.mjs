/**
 * The importer's working parts, shared by its two entry points.
 *
 * scripts/sync-from-api.mjs runs a full sync unconditionally;
 * scripts/sync-agent.mjs does the same on a schedule and on demand. Both are
 * thin: everything they do lives here, so there is one implementation of the
 * pipeline, the same way the item mapping has exactly one implementation on the
 * server (src/lib/fashiongo/sync-request.ts explains that arrangement, and why
 * this runs on a machine with a whitelisted address rather than in the Worker).
 *
 * Neither the key nor the sync secret may be written down in this repository:
 * both come from the environment, and the repository goes to the client.
 */

// Overridable so a rehearsal or a test can stand in for FashionGo with a local
// server. Production leaves it unset and talks to the real one.
const API = process.env.FASHIONGO_API_BASE ?? "https://pubapi.fashiongo.net/v1.0/items";

/** FashionGo caps a page at a hundred items however large a page you ask for. */
const PAGE_SIZE = 100;

/** ~2,600 items today. The cap is a stop for a walk that will not end, not a limit. */
const MAX_PAGES = 200;

/**
 * Photos per call to the warming endpoint. Every photo costs the Worker a
 * handful of outbound requests, and how many it may make depends on the
 * Cloudflare plan, so rather than guessing this starts optimistic and halves on
 * failure until it finds a size that goes through.
 */
const FIRST_BATCH = 100;
const SMALLEST_BATCH = 10;

const SYNC_SECRET_HEADER = "x-itoo-sync-secret";

/**
 * What both entry points need from the environment, checked in one place.
 * A missing variable is a setup mistake, and the message says which one.
 */
export function readEnv() {
  const apiKey = process.env.FASHIONGO_API_KEY;
  const syncSecret = process.env.SYNC_SECRET;
  const origin = (process.env.CATALOG_ORIGIN ?? "https://itoo.website").replace(/\/+$/, "");

  if (!apiKey) {
    console.error("Set FASHIONGO_API_KEY in the environment.");
    process.exit(1);
  }
  if (!syncSecret) {
    console.error("Set SYNC_SECRET in the environment: the catalog refuses a sync without it.");
    process.exit(1);
  }
  return { apiKey, syncSecret, origin };
}

/**
 * FashionGo answers 200 with the failure inside the body, so the header is
 * checked as well as the status. A page that fails is retried rather than
 * abandoned: twenty-six requests in a row over a public network will sometimes
 * lose one, and losing one means importing a catalog with a hole in it.
 */
async function fetchPage(apiKey, pageNumber, attempt = 1) {
  try {
    const response = await fetch(`${API}?pageNumber=${pageNumber}&pageSize=${PAGE_SIZE}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`FashionGo answered ${response.status}`);

    const body = await response.json();
    if (!body?.header?.isSuccessful) {
      throw new Error(body?.header?.resultMessage ?? "FashionGo refused the request");
    }
    return {
      items: body.data?.contents ?? [],
      total: body.data?.totalCount ?? 0,
    };
  } catch (error) {
    if (attempt >= 3) throw error;
    await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    return fetchPage(apiKey, pageNumber, attempt + 1);
  }
}

/**
 * Every item FashionGo has for this vendor, sold styles and retired ones alike.
 * The reported total is trusted only as a stop condition alongside an empty
 * page: a vendor adding a style mid-walk must not turn this into a loop.
 */
async function fetchAllItems(apiKey) {
  const items = [];
  let total = Infinity;

  for (let pageNumber = 1; pageNumber <= MAX_PAGES && items.length < total; pageNumber += 1) {
    const page = await fetchPage(apiKey, pageNumber);
    total = page.total || items.length;
    if (page.items.length === 0) break;
    items.push(...page.items);
    process.stdout.write(`\rReading FashionGo: ${items.length}/${total}`);
  }

  process.stdout.write("\n");
  return items;
}

function headers(syncSecret) {
  return { "Content-Type": "application/json", [SYNC_SECRET_HEADER]: syncSecret };
}

async function pushCatalog({ syncSecret, origin }, items) {
  const response = await fetch(`${origin}/api/sync`, {
    method: "POST",
    headers: headers(syncSecret),
    body: JSON.stringify({ items }),
  });

  const body = await response.json().catch(() => ({}));
  if (response.status === 401) {
    throw new Error("The catalog rejected the sync secret. Check SYNC_SECRET.");
  }
  if (!response.ok) {
    throw new Error(body.error ?? `The catalog rejected the sync (${response.status})`);
  }
  return body.count ?? 0;
}

/**
 * Pulls the catalog's photos into the site's own storage.
 *
 * The catalog holds addresses, not photos, until somebody asks for them. Doing
 * that now means the first client to open a link is not the one paying for six
 * thousand downloads. Photos already stored are skipped, so a run over a
 * catalog that has barely changed costs one existence check per photo.
 */
async function warmPhotos({ syncSecret, origin }) {
  let cursor = 0;
  let batch = FIRST_BATCH;
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  for (;;) {
    const response = await fetch(`${origin}/api/images/warm`, {
      method: "POST",
      headers: headers(syncSecret),
      body: JSON.stringify({ cursor, batch }),
    });

    if (!response.ok) {
      if (batch > SMALLEST_BATCH) {
        batch = Math.max(SMALLEST_BATCH, Math.floor(batch / 2));
        continue;
      }
      // Photos are not worth failing a sync over: the catalog still shows them,
      // it just fetches each one the first time somebody opens it.
      console.warn(`\nWarming stopped at ${cursor}: the catalog answered ${response.status}.`);
      return { downloaded, skipped, failed, done: false };
    }

    const progress = await response.json();
    cursor = progress.cursor;
    downloaded += progress.downloaded;
    skipped += progress.skipped;
    failed += progress.failed;
    process.stdout.write(`\rWarming photos: ${cursor}/${progress.total}`);
    if (progress.done) {
      process.stdout.write("\n");
      return { downloaded, skipped, failed, done: true };
    }
  }
}

/**
 * Whether the "Sync now" button has been pressed since the last sync landed.
 * GET /api/sync answers that and nothing else, to the holder of the secret.
 */
export async function syncIsRequested({ syncSecret, origin }) {
  const response = await fetch(`${origin}/api/sync`, {
    headers: { [SYNC_SECRET_HEADER]: syncSecret },
  });
  if (response.status === 401) {
    throw new Error("The catalog rejected the sync secret. Check SYNC_SECRET.");
  }
  if (!response.ok) {
    throw new Error(`The catalog answered ${response.status} to the poll.`);
  }
  const body = await response.json();
  return body.pending === true;
}

/**
 * One whole sync: read everything out of FashionGo, push the styles that are
 * for sale, warm the photos. Exits the process on an empty read rather than
 * pushing, because a sync is a full replacement and an empty one would replace
 * the shop with nothing.
 */
export async function fullSync(config) {
  const items = await fetchAllItems(config.apiKey);
  const active = items.filter((item) => item?.active === true);
  console.log(`${items.length} styles in FashionGo, ${active.length} of them for sale.`);

  if (active.length === 0) {
    console.error("Nothing is for sale. Refusing to push an empty catalog.");
    process.exit(1);
  }

  const count = await pushCatalog(config, active);
  console.log(`Pushed to ${config.origin}: the catalog now holds ${count} styles.`);

  const photos = await warmPhotos(config);
  console.log(
    `Photos: ${photos.downloaded} downloaded, ${photos.skipped} already stored` +
      (photos.failed ? `, ${photos.failed} failed` : "") +
      (photos.done ? "." : ", not finished."),
  );
}
