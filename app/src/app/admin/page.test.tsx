import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { seedProducts } from "@/lib/catalog/seed";
import AdminPage from "./page";

/**
 * The session itself is tested in lib/admin; what matters here is that the page
 * asks, and that a "no" leaves nothing about the catalog in the markup.
 */
const { isTeamViewer } = vi.hoisted(() => ({ isTeamViewer: vi.fn() }));
vi.mock("@/lib/admin/request", () => ({ isTeamViewer }));

async function renderAdmin({ signedIn }: { signedIn: boolean }) {
  isTeamViewer.mockResolvedValue(signedIn);
  return render(await AdminPage());
}

beforeEach(() => isTeamViewer.mockReset());

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
});

describe("admin page, signed in", () => {
  it("reports the catalog and drops the password form", async () => {
    const { container } = await renderAdmin({ signedIn: true });

    expect(screen.getByText("Products").parentElement).toHaveTextContent(
      String(seedProducts().length),
    );
    expect(container.querySelector("time")).toBeInTheDocument();
    expect(container.querySelector('form[action="/admin/sign-out"]')).toBeInTheDocument();
    expect(screen.queryByLabelText(/team password/i)).toBeNull();
  });
});
