import { beforeEach, describe, expect, it, vi } from "vitest";
import { syncState } from "@/lib/sync/state";
import { requestSync } from "./actions";

/**
 * Like setStyleHidden (see app/actions.test.ts): the button is only drawn for
 * the team, but a Server Action is a public endpoint, so the check has to be
 * here. What is behind this one is the ability to make the puller hit
 * FashionGo, which is not something a stranger should be able to schedule.
 */
const { isTeamViewer } = vi.hoisted(() => ({ isTeamViewer: vi.fn() }));
vi.mock("@/lib/admin/request", () => ({ isTeamViewer }));

/** The store is shared across the whole run, so each test starts unpending. */
beforeEach(async () => {
  isTeamViewer.mockReset().mockResolvedValue(true);
  await (await syncState()).complete({ finishedAt: "2026-08-11T00:00:00.000Z", styleCount: 1 });
});

describe("asking for a sync", () => {
  it("leaves the note the puller polls for", async () => {
    expect(await requestSync()).toEqual({ ok: true });

    const { requestedAt } = await (await syncState()).read();
    expect(requestedAt).not.toBeNull();
    expect(Number.isNaN(new Date(requestedAt as string).getTime())).toBe(false);
  });

  it("asked twice, means one sync sooner rather than two", async () => {
    await requestSync();
    expect(await requestSync()).toEqual({ ok: true });

    expect((await (await syncState()).read()).requestedAt).not.toBeNull();
  });
});

describe("asking for a sync without being the team", () => {
  beforeEach(() => isTeamViewer.mockResolvedValue(false));

  it("is refused", async () => {
    expect(await requestSync()).toEqual({ error: "Sign in to start a sync." });
  });

  it("leaves no note behind", async () => {
    await requestSync();
    expect((await (await syncState()).read()).requestedAt).toBeNull();
  });
});
