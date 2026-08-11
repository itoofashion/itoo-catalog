import { beforeEach, describe, expect, it } from "vitest";
import { syncState } from "@/lib/sync/state";
import { GET, POST } from "./route";

/**
 * The two ends of the sync loop, glued together: the puller's poll and the push
 * that answers it. The pieces have tests of their own (lib/sync/auth.ts,
 * lib/sync/state.ts, lib/fashiongo/sync-request.ts); what is checked here is
 * the glue, that a poll sees the note the button left and that a landed sync
 * writes itself down and takes the note with it.
 *
 * There is no secret configured in a test run and NODE_ENV is not production,
 * so the guard waves these requests through; the guard itself is tested in
 * lib/sync/auth.test.ts.
 */

/** The least FashionGo item the validator will believe. */
function item(styleCode: string) {
  return {
    itemId: 26144615,
    styleCode,
    itemName: `Style ${styleCode}`,
    sellingPrice: 20.75,
    activatedOn: "2026-08-01T00:00:00.000Z",
    active: true,
  };
}

function get() {
  return GET(new Request("http://localhost/api/sync"));
}

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/sync", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(async () => {
  // The store is shared across the file, so each test starts unpending.
  await (await syncState()).complete({ finishedAt: "2026-08-10T00:00:00.000Z", styleCount: 1 });
});

describe("the poll the puller makes", () => {
  it("says nothing is pending when nothing is", async () => {
    const answer = await get();
    expect(answer.status).toBe(200);
    expect(await answer.json()).toEqual({ pending: false, requestedAt: null });
  });

  it("hands over the note the button left", async () => {
    await (await syncState()).request("2026-08-11T08:00:00.000Z");

    expect(await (await get()).json()).toEqual({
      pending: true,
      requestedAt: "2026-08-11T08:00:00.000Z",
    });
  });
});

describe("a sync landing", () => {
  it("writes the run down: when, and how many styles", async () => {
    const answer = await post({ items: [item("Y-542"), item("WP-2160")] });
    expect(answer.status).toBe(200);
    expect(await answer.json()).toEqual({ count: 2 });

    const { lastRun } = await (await syncState()).read();
    expect(lastRun?.styleCount).toBe(2);
    expect(Number.isNaN(new Date(lastRun?.finishedAt ?? "").getTime())).toBe(false);
  });

  it("answers the pending request, so the puller stops being asked", async () => {
    await (await syncState()).request("2026-08-11T08:00:00.000Z");
    await post({ items: [item("Y-542")] });

    expect(await (await get()).json()).toEqual({ pending: false, requestedAt: null });
  });

  it("records nothing for a push that was refused", async () => {
    const before = await (await syncState()).read();
    const answer = await post({ items: [] });

    expect(answer.status).toBe(400);
    expect(await (await syncState()).read()).toEqual(before);
  });
});
