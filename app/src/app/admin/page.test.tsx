import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { seedProducts } from "@/lib/catalog/seed";
import AdminPage, { metadata } from "./page";
import HiddenPage, { metadata as hiddenMetadata } from "./hidden/page";

/**
 * The session itself is tested in lib/admin; what matters here is that every
 * admin page asks per request, and that a "no" leaves nothing about the catalog
 * in the markup.
 */
const { isTeamViewer } = vi.hoisted(() => ({ isTeamViewer: vi.fn() }));
vi.mock("@/lib/admin/request", () => ({ isTeamViewer }));

/** The pages read the arrivals cookie on the way in; the tests own its value. */
const { getCookie } = vi.hoisted(() => ({ getCookie: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: getCookie }),
}));

async function renderAdmin({ signedIn }: { signedIn: boolean }) {
  isTeamViewer.mockResolvedValue(signedIn);
  return render(await AdminPage());
}

beforeEach(() => {
  isTeamViewer.mockReset();
  getCookie.mockReset().mockReturnValue(undefined);
});

describe.each([
  ["signed out", false],
  ["signed in", true],
])("admin page, %s", (_state, signedIn) => {
  it("wears the brand's own logo rather than the word", async () => {
    await renderAdmin({ signedIn });
    const logo = screen.getByRole("img", { name: "itoo" });

    expect(logo.getAttribute("src")).toContain("logo.png");
    // Asked for at its full size and drawn small, so it stays sharp on a retina
    // screen; the image optimizer is off, so this is the file as shipped.
    expect(logo).toHaveAttribute("width", "1050");
    expect(logo).toHaveAttribute("height", "483");
  });

  it("calls itself the admin panel", async () => {
    await renderAdmin({ signedIn });
    // At the door the heading says what the door is for; inside it is the name
    // of the room. Either way the reader is told where they are.
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      signedIn ? "Admin panel" : "Sign in to the admin panel",
    );
  });
});

describe("admin pages", () => {
  it("go by the same names in the browser tab as on the page", () => {
    expect(metadata.title).toBe("Admin panel");
    expect(hiddenMetadata.title).toBe("Hidden styles");
  });
});

describe("admin page, signed out", () => {
  it("asks for the password", async () => {
    await renderAdmin({ signedIn: false });
    expect(screen.getByLabelText(/team password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("tells nothing about the catalog", async () => {
    const { container } = await renderAdmin({ signedIn: false });

    expect(screen.queryByText(/products/i)).toBeNull();
    expect(screen.queryByText(/last updated/i)).toBeNull();
    expect(screen.queryByText(/FashionGo/i)).toBeNull();
    // Not even in an attribute: the count and the sync time never reach the page.
    expect(container.querySelector("time")).toBeNull();
    expect(container.textContent).not.toMatch(String(seedProducts().length));
  });

  it("offers no way to sign out of a session that is not there", async () => {
    const { container } = await renderAdmin({ signedIn: false });
    expect(container.querySelector('form[action="/admin/sign-out"]')).toBeNull();
  });

  it("keeps the door on the hidden styles page too", async () => {
    isTeamViewer.mockResolvedValue(false);
    render(await HiddenPage());
    expect(screen.getByLabelText(/team password/i)).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).toBeNull();
  });
});

describe("admin page, signed in", () => {
  it("reports the catalog and drops the password form", async () => {
    const { container } = await renderAdmin({ signedIn: true });

    expect(screen.getByText("Styles").parentElement).toHaveTextContent(
      String(seedProducts().length),
    );
    expect(container.querySelector("time")).toBeInTheDocument();
    expect(screen.queryByLabelText(/team password/i)).toBeNull();
  });

  it("holds sync and arrivals in one room", async () => {
    await renderAdmin({ signedIn: true });
    expect(screen.getByRole("button", { name: /sync now/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/added after/i)).toBeInTheDocument();
  });

  it("opens the arrivals on the day the cookie remembered", async () => {
    getCookie.mockReturnValue({ name: "arrivals-after", value: "2026-07-01" });
    await renderAdmin({ signedIn: true });
    expect(screen.getByLabelText(/added after/i)).toHaveValue("2026-07-01");
  });

  it("falls back to the last month when the cookie holds nonsense", async () => {
    getCookie.mockReturnValue({ name: "arrivals-after", value: "yesterday-ish" });
    await renderAdmin({ signedIn: true });
    const value = (screen.getByLabelText(/added after/i) as HTMLInputElement).value;
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(value).not.toBe("yesterday-ish");
  });

  it("names the rooms and marks the one it is in", async () => {
    await renderAdmin({ signedIn: true });
    const nav = screen.getByRole("navigation", { name: /admin pages/i });

    expect(within(nav).getByRole("link", { name: /catalog/i })).toHaveAttribute("href", "/");
    expect(within(nav).getByRole("link", { name: /sync & arrivals/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav).getByRole("link", { name: /hidden styles/i })).toHaveAttribute(
      "href",
      "/admin/hidden",
    );
  });

  it("signs out with a plain form, which works without JavaScript", async () => {
    const { container } = await renderAdmin({ signedIn: true });
    const form = container.querySelector('form[action="/admin/sign-out"]');
    expect(form).not.toBeNull();
    expect((form as HTMLFormElement).method).toBe("post");
  });
});

describe("the hidden styles page, signed in", () => {
  it("is its own room, marked in the navigation, with the list in it", async () => {
    isTeamViewer.mockResolvedValue(true);
    render(await HiddenPage());

    const nav = screen.getByRole("navigation", { name: /admin pages/i });
    expect(within(nav).getByRole("link", { name: /hidden styles/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    // The seed catalog has nothing hidden, so the room says what it is for.
    expect(screen.getByText(/Nothing is hidden/)).toBeInTheDocument();
    // The sync lives in the other room.
    expect(screen.queryByRole("button", { name: /sync now/i })).toBeNull();
  });
});
