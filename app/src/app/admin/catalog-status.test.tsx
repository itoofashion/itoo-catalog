import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SyncRun } from "@/lib/sync/state";
import { CatalogStatus } from "./catalog-status";

/**
 * What the button does on the server is the action's own test (see
 * actions.test.ts). Here: that the press is sent, that the panel says a sync
 * has been asked for, and that a refusal is shown rather than swallowed.
 */
const { requestSync } = vi.hoisted(() => ({ requestSync: vi.fn() }));
vi.mock("./actions", () => ({ requestSync }));

/** The page re-asks the server for its numbers; the router is how it asks. */
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const SYNCED_AT = "2026-08-04T12:00:00.000Z";

const HOUR = 60 * 60 * 1000;
/** Three hours before the test runs, so "3 hours ago" is the honest reading. */
const threeHoursAgo = () => new Date(Date.now() - 3 * HOUR).toISOString();

function renderStatus({
  productCount = 42,
  syncedAt = SYNCED_AT,
  lastRun = null as SyncRun | null,
  syncRequestedAt = null as string | null,
} = {}) {
  return render(
    <CatalogStatus
      productCount={productCount}
      syncedAt={syncedAt}
      lastRun={lastRun}
      syncRequestedAt={syncRequestedAt}
    />,
  );
}

beforeEach(() => {
  requestSync.mockReset().mockResolvedValue({ ok: true });
  refresh.mockReset();
});

describe("catalog status", () => {
  it("reports how much catalog there is", () => {
    renderStatus({ productCount: 137 });
    expect(screen.getByText("Styles").parentElement).toHaveTextContent("137");
  });

  it("prints the sync time for a reader to read, and for a machine to parse", () => {
    const { container } = renderStatus();
    const stamp = container.querySelector("time");
    expect(stamp).toHaveAttribute("datetime", SYNCED_AT);
    // Formatted in the reader's own timezone, so the test can only insist that
    // the raw timestamp is not what ends up on screen.
    expect(stamp?.textContent).not.toBe(SYNCED_AT);
    expect(stamp?.textContent).toMatch(/2026/);
  });

  it("says never rather than showing an unreadable date", () => {
    renderStatus({ syncedAt: "" });
    expect(screen.getByText("never")).toBeInTheDocument();
  });

  it("says in plain words how long ago the last sync landed, and what it brought", () => {
    renderStatus({ lastRun: { finishedAt: threeHoursAgo(), styleCount: 737 } });
    // The relative time sits in its own <time>, so the line is read whole.
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === "P" &&
          /Last synced 3 hours ago — 737 styles/.test(element.textContent ?? ""),
      ),
    ).toBeInTheDocument();
  });

  it("says when the catalog catches up on its own", () => {
    renderStatus();
    expect(
      screen.getByText(/Updates automatically every night at midnight/),
    ).toBeInTheDocument();
  });

  it("admits when no sync has ever landed", () => {
    renderStatus({ lastRun: null });
    expect(screen.getByText(/No sync has completed yet/)).toBeInTheDocument();
  });

  it("sends a press on Sync now to the server and says it is in progress", async () => {
    const user = userEvent.setup();
    renderStatus();
    await user.click(screen.getByRole("button", { name: /sync now/i }));

    expect(requestSync).toHaveBeenCalledOnce();
    expect(await screen.findByText(/Sync in progress/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sync now/i })).not.toBeInTheDocument();
  });

  it("opens already in progress when a request is on the table", () => {
    renderStatus({ syncRequestedAt: "2026-08-11T08:00:00.000Z" });
    expect(screen.getByText(/Sync in progress/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sync now/i })).not.toBeInTheDocument();
  });

  it("shows the refusal instead of pretending the sync started", async () => {
    const user = userEvent.setup();
    requestSync.mockResolvedValue({ error: "Sign in to start a sync." });
    renderStatus();
    await user.click(screen.getByRole("button", { name: /sync now/i }));

    expect(await screen.findByText("Sign in to start a sync.")).toBeInTheDocument();
    expect(screen.queryByText(/Sync in progress/)).not.toBeInTheDocument();
    // The button stays: the press did not land, so there is still one to make.
    expect(screen.getByRole("button", { name: /sync now/i })).toBeInTheDocument();
  });

  it("keeps asking the server while a sync is on its way", () => {
    vi.useFakeTimers();
    try {
      renderStatus({ syncRequestedAt: "2026-08-11T08:00:00.000Z" });
      expect(refresh).not.toHaveBeenCalled();

      vi.advanceTimersByTime(16_000);
      expect(refresh).toHaveBeenCalledOnce();
      vi.advanceTimersByTime(15_000);
      expect(refresh).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("still checks in at rest, just far less eagerly", () => {
    vi.useFakeTimers();
    try {
      renderStatus();
      vi.advanceTimersByTime(16_000);
      expect(refresh).not.toHaveBeenCalled();

      vi.advanceTimersByTime(45_000);
      expect(refresh).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

});
