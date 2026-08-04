import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CatalogView } from "./catalog-view";
import type { PublicProduct } from "@/lib/catalog/public";
import type { CatalogSelection } from "@/lib/catalog/share";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const NOW = "2026-08-04T12:00:00.000Z";

function product(overrides: Partial<PublicProduct> & { sku: string }): PublicProduct {
  return {
    name: `Style ${overrides.sku}`,
    price: 19.75,
    category: "Tops",
    colors: ["Beige"],
    images: [
      { url: "https://fg-image.fashiongo.net/Vendors/x/ProductImage/large/a.jpg", color: "Beige" },
    ],
    isNew: false,
    ...overrides,
  };
}

const products = [
  product({ sku: "TOP-1", category: "Tops", isNew: true }),
  product({ sku: "PANT-1", category: "Pants" }),
  product({ sku: "PANT-2", category: "Pants" }),
];

function renderCatalog(
  selection: CatalogSelection = { skus: [], category: null },
) {
  return render(
    <CatalogView
      products={products}
      syncedAt={NOW}
      selection={selection}
    />,
  );
}

function grid() {
  return screen.getByRole("main");
}

describe("CatalogView", () => {
  it("shows every product by default", () => {
    renderCatalog();
    expect(within(grid()).getAllByRole("article")).toHaveLength(3);
  });

  it("filters the grid by category", async () => {
    const user = userEvent.setup();
    renderCatalog();
    await user.click(screen.getByRole("button", { name: "Pants" }));

    const shown = within(grid()).getAllByRole("article");
    expect(shown).toHaveLength(2);
    expect(within(grid()).queryByText("Style TOP-1")).not.toBeInTheDocument();
  });

  it("filters down to new arrivals", async () => {
    const user = userEvent.setup();
    renderCatalog();
    await user.click(screen.getByRole("button", { name: /New arrivals/ }));

    expect(within(grid()).getAllByRole("article")).toHaveLength(1);
    expect(within(grid()).getByText("Style TOP-1")).toBeInTheDocument();
  });

  it("marks recent products as new", () => {
    renderCatalog();
    expect(screen.getAllByText("New")).toHaveLength(1);
  });

  describe("admin view", () => {
    it("offers the sync control", () => {
      renderCatalog();
      expect(screen.getByRole("button", { name: /Sync from FashionGo/ })).toBeInTheDocument();
    });

    it("lets the team pick items for a client", async () => {
      const user = userEvent.setup();
      renderCatalog();
      await user.click(screen.getByRole("button", { name: /Add TOP-1 to selection/ }));

      expect(screen.getByText("1 item picked for a client")).toBeInTheDocument();
    });

    it("keeps picked items visible in the grid", async () => {
      const user = userEvent.setup();
      renderCatalog();
      await user.click(screen.getByRole("button", { name: /Add TOP-1 to selection/ }));

      expect(within(grid()).getAllByRole("article")).toHaveLength(3);
    });

    it("copies a link carrying the picked items", async () => {
      const user = userEvent.setup();
      renderCatalog();
      await user.click(screen.getByRole("button", { name: /Add TOP-1 to selection/ }));
      await user.click(screen.getByRole("button", { name: /Copy link/ }));

      await expect(navigator.clipboard.readText()).resolves.toContain("items=TOP-1");
    });
  });

  describe("client view", () => {
    it("hides the controls the client should never see", async () => {
      const user = userEvent.setup();
      renderCatalog();
      await user.click(screen.getByRole("button", { name: "Admin view" }));

      expect(screen.queryByRole("button", { name: /Sync from FashionGo/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /to selection/ })).not.toBeInTheDocument();
    });

    it("opens straight into the client view for a shared link", () => {
      renderCatalog({ skus: ["TOP-1", "PANT-1"], category: null });

      expect(screen.getByText(/Shared selection/)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Sync from FashionGo/ })).not.toBeInTheDocument();
    });

    it("shows only the items the link carried", () => {
      renderCatalog({ skus: ["PANT-1"], category: null });

      const shown = within(grid()).getAllByRole("article");
      expect(shown).toHaveLength(1);
      expect(within(grid()).getByText("Style PANT-1")).toBeInTheDocument();
    });

    it("respects a category-only link", () => {
      renderCatalog({ skus: [], category: "Pants" });
      expect(within(grid()).getAllByRole("article")).toHaveLength(2);
    });

    it("offers only categories present in what was shared", () => {
      // Offering the whole catalog's categories would let a client filter their
      // own selection down to an empty page.
      renderCatalog({ skus: ["TOP-1"], category: null });

      expect(screen.getByRole("button", { name: "Tops" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Pants" })).not.toBeInTheDocument();
    });

    it("never empties the page through a category the selection cannot fill", async () => {
      const user = userEvent.setup();
      renderCatalog();
      // Pick a top, then leave the category filter on Pants before previewing:
      // the shared page has no Pants in it and must not open on an empty grid.
      await user.click(screen.getByRole("button", { name: /Add TOP-1 to selection/ }));
      await user.click(screen.getByRole("button", { name: "Pants" }));
      await user.click(screen.getByRole("button", { name: "Admin view" }));

      expect(within(grid()).getAllByRole("article")).toHaveLength(1);
      expect(within(grid()).getByText("Style TOP-1")).toBeInTheDocument();
    });
  });

  it("opens a product when its photo is clicked", async () => {
    const user = userEvent.setup();
    renderCatalog();
    const card = within(grid()).getAllByRole("article")[0];
    await user.click(within(card).getByRole("img"));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Style TOP-1")).toBeInTheDocument();
    expect(within(dialog).getByText("$19.75")).toBeInTheDocument();
  });

  it("copies an order line a buyer can paste into chat", async () => {
    const user = userEvent.setup();
    renderCatalog();
    const card = within(grid()).getAllByRole("article")[0];
    await user.click(within(card).getByRole("button", { name: /Copy to order/ }));

    await expect(navigator.clipboard.readText()).resolves.toContain("SKU: TOP-1");
  });
});
