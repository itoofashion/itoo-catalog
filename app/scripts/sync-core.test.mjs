// @vitest-environment node
/**
 * The importer, end to end against stand-in servers: a FashionGo that answers
 * the published API's envelope, and a catalog that checks the secret and
 * remembers what it was pushed. Everything between them — paging, filtering,
 * the push, the photo warming with its shrinking batches — is the real code.
 */
import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { fullSync, syncIsRequested } from "./sync-core.mjs";

const servers = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map((server) => new Promise((done) => server.close(done))),
  );
  delete process.env.FASHIONGO_API_BASE;
});

function listen(handler) {
  const server = createServer(handler);
  servers.push(server);
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () =>
      resolve(`http://127.0.0.1:${server.address().port}`),
    );
  });
}

function item(id, overrides = {}) {
  return {
    itemId: id,
    styleCode: `ITT ${id}`,
    itemName: `Style ${id}`,
    sellingPrice: 20,
    activatedOn: "2026-08-01T00:00:00",
    active: true,
    images: [],
    ...overrides,
  };
}

/** A FashionGo whose whole history is `items`, one page per `pageSize`. */
async function standInFashionGo(items, { pageSize = 2 } = {}) {
  const requests = [];
  const origin = await listen((req, res) => {
    const url = new URL(req.url, "http://localhost");
    requests.push(req.headers.authorization);
    const pageNumber = Number(url.searchParams.get("pageNumber"));
    const page = items.slice((pageNumber - 1) * pageSize, pageNumber * pageSize);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        header: { isSuccessful: true },
        data: { contents: page, totalCount: items.length },
      }),
    );
  });
  process.env.FASHIONGO_API_BASE = `${origin}/v1.0/items`;
  return { requests };
}

/**
 * A catalog worker with the three routes the agent talks to. `pending` is what
 * GET /api/sync answers; `failWarms` makes that many warming calls fail first,
 * to watch the batch shrink.
 */
async function standInCatalog({ secret = "s3cret", pending = false, failWarms = 0 } = {}) {
  const seen = { syncs: [], warms: [], polls: 0 };
  let warmsFailed = 0;

  const origin = await listen((req, res) => {
    const answer = (status, body) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };

    if (req.headers["x-itoo-sync-secret"] !== secret) {
      return answer(401, { error: "Wrong secret" });
    }
    if (req.method === "GET") {
      seen.polls += 1;
      return answer(200, { pending });
    }

    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      if (req.url === "/api/sync") {
        const { items } = JSON.parse(body);
        seen.syncs.push(items);
        return answer(200, { count: items.length });
      }
      if (req.url === "/api/images/warm") {
        if (warmsFailed < failWarms) {
          warmsFailed += 1;
          return answer(500, {});
        }
        const { cursor, batch } = JSON.parse(body);
        seen.warms.push(batch);
        const total = 30;
        const next = Math.min(cursor + batch, total);
        return answer(200, {
          cursor: next,
          total,
          downloaded: next - cursor,
          skipped: 0,
          failed: 0,
          done: next >= total,
        });
      }
      answer(404, {});
    });
  });

  return { origin, seen, config: { apiKey: "key", syncSecret: secret, origin } };
}

describe("fullSync", () => {
  it("walks every FashionGo page, pushes only active styles, and warms the photos", async () => {
    const fashionGo = await standInFashionGo([
      item(1),
      item(2, { active: false }),
      item(3),
      item(4),
    ]);
    const catalog = await standInCatalog();

    await fullSync(catalog.config);

    expect(fashionGo.requests.every((auth) => auth === "Bearer key")).toBe(true);
    expect(catalog.seen.syncs).toHaveLength(1);
    expect(catalog.seen.syncs[0].map((pushed) => pushed.itemId)).toEqual([1, 3, 4]);
    // The warming walked to the end: 30 photos in batches of 100 is one call.
    expect(catalog.seen.warms).toEqual([100]);
  });

  it("halves the warming batch until the catalog accepts it", async () => {
    await standInFashionGo([item(1)]);
    const catalog = await standInCatalog({ failWarms: 2 });

    await fullSync(catalog.config);

    // 100 refused, 50 refused, 25 accepted — and 25 covers the remaining 30
    // in two calls.
    expect(catalog.seen.warms).toEqual([25, 25]);
  });

  it("refuses to sync with the wrong secret rather than half-succeeding", async () => {
    await standInFashionGo([item(1)]);
    const catalog = await standInCatalog();

    await expect(
      fullSync({ ...catalog.config, syncSecret: "wrong" }),
    ).rejects.toThrow(/sync secret/);
    expect(catalog.seen.syncs).toHaveLength(0);
  });
});

describe("syncIsRequested", () => {
  it("relays the catalog's answer", async () => {
    const idle = await standInCatalog({ pending: false });
    const asked = await standInCatalog({ pending: true });

    expect(await syncIsRequested(idle.config)).toBe(false);
    expect(await syncIsRequested(asked.config)).toBe(true);
  });

  it("throws on a wrong secret instead of treating it as nothing to do", async () => {
    const catalog = await standInCatalog();

    await expect(
      syncIsRequested({ ...catalog.config, syncSecret: "wrong" }),
    ).rejects.toThrow(/sync secret/);
  });
});
