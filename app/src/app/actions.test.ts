import { beforeEach, describe, expect, it, vi } from "vitest";
import { hiddenStyles } from "@/lib/catalog/hidden";
import { setStyleHidden } from "./actions";

/**
 * The action is a public endpoint, and that is the whole of what these tests are
 * about: the eye is only drawn for the team, but anyone who reads the page's
 * JavaScript can find the endpoint behind it, so the check has to be here and
 * not on the button.
 */
const { isTeamViewer } = vi.hoisted(() => ({ isTeamViewer: vi.fn() }));
vi.mock("@/lib/admin/request", () => ({ isTeamViewer }));

/** The store is shared across the whole test run, so each test starts clean. */
async function clear() {
  const styles = await hiddenStyles();
  for (const sku of await styles.list()) await styles.show(sku);
}

beforeEach(async () => {
  isTeamViewer.mockReset().mockResolvedValue(true);
  await clear();
});

async function hiddenNow(): Promise<Set<string>> {
  return (await hiddenStyles()).list();
}

describe("hiding a style", () => {
  it("takes it out of the catalog", async () => {
    expect(await setStyleHidden("Y-542", true)).toEqual({ ok: true });
    expect(await hiddenNow()).toEqual(new Set(["Y-542"]));
  });

  it("puts it back", async () => {
    await setStyleHidden("Y-542", true);

    expect(await setStyleHidden("Y-542", false)).toEqual({ ok: true });
    expect(await hiddenNow()).toEqual(new Set());
  });

  it("survives the same press arriving twice", async () => {
    // A slow connection gets pressed again, and both presses reach the server.
    const [first, second] = await Promise.all([
      setStyleHidden("Y-542", true),
      setStyleHidden("Y-542", true),
    ]);

    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: true });
    expect(await hiddenNow()).toEqual(new Set(["Y-542"]));
  });

  it("survives being brought back twice", async () => {
    await setStyleHidden("Y-542", true);

    expect(await setStyleHidden("Y-542", false)).toEqual({ ok: true });
    expect(await setStyleHidden("Y-542", false)).toEqual({ ok: true });
    expect(await hiddenNow()).toEqual(new Set());
  });

  it("brings back a style that was never hidden", async () => {
    expect(await setStyleHidden("NEVER-1", false)).toEqual({ ok: true });
    expect(await hiddenNow()).toEqual(new Set());
  });

  it("leaves other styles alone", async () => {
    await setStyleHidden("Y-542", true);
    await setStyleHidden("WP-2160", true);
    await setStyleHidden("Y-542", false);

    expect(await hiddenNow()).toEqual(new Set(["WP-2160"]));
  });
});

describe("hiding a style, asked by somebody who is not the team", () => {
  beforeEach(() => isTeamViewer.mockResolvedValue(false));

  it("is refused", async () => {
    expect(await setStyleHidden("Y-542", true)).toEqual({
      error: "Sign in to change the catalog.",
    });
  });

  it("changes nothing", async () => {
    await setStyleHidden("Y-542", true);
    expect(await hiddenNow()).toEqual(new Set());
  });

  it("cannot bring a style back either", async () => {
    isTeamViewer.mockResolvedValueOnce(true);
    await setStyleHidden("Y-542", true);

    expect(await setStyleHidden("Y-542", false)).toHaveProperty("error");
    expect(await hiddenNow()).toEqual(new Set(["Y-542"]));
  });
});

describe("hiding something that is not a style", () => {
  it("refuses an empty style number", async () => {
    expect(await setStyleHidden("", true)).toHaveProperty("error");
    expect(await setStyleHidden("   ", true)).toHaveProperty("error");
  });

  it("refuses a style number no style could have", async () => {
    expect(await setStyleHidden("x".repeat(500), true)).toHaveProperty("error");
    expect(await hiddenNow()).toEqual(new Set());
  });

  it("refuses an argument that is not a string at all", async () => {
    // It arrives over the wire, so its TypeScript type promises nothing.
    expect(await setStyleHidden(null as unknown as string, true)).toHaveProperty("error");
    expect(await setStyleHidden(7 as unknown as string, true)).toHaveProperty("error");
  });
});
