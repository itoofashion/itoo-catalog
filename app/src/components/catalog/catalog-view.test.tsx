import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CatalogView } from "./catalog-view";
import type { PublicProduct } from "@/lib/catalog/public";
import {
  EMPTY_SELECTION,
  NO_FILTERS,
  type CatalogFilters,
  type CatalogSelection,
} from "@/lib/catalog/share";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh: vi.fn() }),
  usePathname: () => "/",
}));

const NOW = "2026-08-04T12:00:00.000Z";

function product(overrides: Partial<PublicProduct> & { sku: string }): PublicProduct {
  return {
    name: `Style ${overrides.sku}`,
    price: 19.75,
    category: "Tops",
    colors: ["Beige"],
    images: [{ url: "/i/abc", color: "Beige" }],
    sizes: ["S", "M", "L"],
    packBreakdown: [2, 2, 2],
    minimumUnits: 6,
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
  selection: CatalogSelection = EMPTY_SELECTION,
  filters: CatalogFilters = NO_FILTERS,
) {
  return render(
    <CatalogView
      products={products}
      syncedAt={NOW}
      selection={selection}
      filters={filters}
    />,
  );
}

const grid = () => screen.getByRole("main");
const cards = () => within(grid()).queryAllByRole("article");

beforeEach(() => {
  replace.mockClear();
  sessionStorage.clear();
});

describe("browsing", () => {
  it("shows every product by default", () => {
    renderCatalog();
    expect(cards()).toHaveLength(3);
  });

  it("narrows the grid to a category", async () => {
    const user = userEvent.setup();
    renderCatalog();
    await user.click(screen.getByRole("button", { name: "Pants" }));

    expect(cards()).toHaveLength(2);
    expect(within(grid()).queryByText("Style TOP-1")).not.toBeInTheDocument();
  });

  it("narrows the grid to new arrivals", async () => {
    const user = userEvent.setup();
    renderCatalog();
    await user.click(screen.getByRole("button", { name: /New arrivals/ }));

    expect(cards()).toHaveLength(1);
    expect(within(grid()).getByText("Style TOP-1")).toBeInTheDocument();
  });

  it("marks recent styles as new", () => {
    renderCatalog();
    expect(screen.getAllByText("New")).toHaveLength(1);
  });

  it("opens a style when its photo is clicked", async () => {
    const user = userEvent.setup();
    renderCatalog();
    await user.click(within(cards()[0]).getByRole("img"));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Style TOP-1")).toBeInTheDocument();
    expect(within(dialog).getByText("$19.75")).toBeInTheDocument();
  });

  it("starts from the filters the address arrived with", () => {
    renderCatalog(EMPTY_SELECTION, { category: "Pants", newOnly: false });
    expect(cards()).toHaveLength(2);
  });
});

describe("the address bar", () => {
  it("follows the category being browsed, so it can just be copied", async () => {
    const user = userEvent.setup();
    renderCatalog();
    await user.click(screen.getByRole("button", { name: "Pants" }));

    expect(replace).toHaveBeenCalledWith("/?show=Pants", expect.anything());
  });

  it("follows the new-arrivals filter", async () => {
    const user = userEvent.setup();
    renderCatalog();
    await user.click(screen.getByRole("button", { name: /New arrivals/ }));

    expect(replace).toHaveBeenCalledWith("/?new=1", expect.anything());
  });

  it("carries what has been picked for a client", async () => {
    const user = userEvent.setup();
    renderCatalog();
    await user.click(screen.getByRole("button", { name: /Add TOP-1 to selection/ }));

    expect(replace).toHaveBeenCalledWith("/?items=TOP-1", expect.anything());
  });
});

describe("picking whole categories", () => {
  it("puts every style of the category into the selection", async () => {
    const user = userEvent.setup();
    renderCatalog();
    await user.click(screen.getByRole("button", { name: /Add all of Pants to the link/ }));

    expect(replace).toHaveBeenCalledWith("/?cats=Pants", expect.anything());
    expect(screen.getByText(/All of Pants/)).toBeInTheDocument();
  });

  it("locks those styles so the link keeps meaning the whole category", async () => {
    const user = userEvent.setup();
    renderCatalog();
    await user.click(screen.getByRole("button", { name: /Add all of Pants to the link/ }));

    const locked = within(grid()).getByRole("button", {
      name: /PANT-1 is included through its category/,
    });
    expect(locked).toBeDisabled();
  });

  it("leaves styles outside the category free to pick", async () => {
    const user = userEvent.setup();
    renderCatalog();
    await user.click(screen.getByRole("button", { name: /Add all of Pants to the link/ }));

    expect(screen.getByRole("button", { name: /Add TOP-1 to selection/ })).toBeEnabled();
  });

  it("counts what the client will actually receive", async () => {
    const user = userEvent.setup();
    renderCatalog();
    await user.click(screen.getByRole("button", { name: /Add all of Pants to the link/ }));

    expect(screen.getByText(/2 items for the client/)).toBeInTheDocument();
  });
});

describe("the client's view", () => {
  it("opens straight into it for a shared link", () => {
    renderCatalog({ categories: [], skus: ["TOP-1", "PANT-1"] });

    expect(screen.getByText(/2 styles picked for you/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Sync$/ }),
    ).not.toBeInTheDocument();
  });

  it("shows only what the link carried", () => {
    renderCatalog({ categories: [], skus: ["PANT-1"] });
    expect(cards()).toHaveLength(1);
    expect(within(grid()).getByText("Style PANT-1")).toBeInTheDocument();
  });

  it("shows a whole category, including styles added since the link was sent", () => {
    renderCatalog({ categories: ["Pants"], skus: [] });
    expect(cards()).toHaveLength(2);
  });

  it("hides the controls a client should never see", () => {
    renderCatalog({ categories: [], skus: ["PANT-1"] });
    expect(screen.queryByRole("button", { name: /to selection/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Get link/ })).not.toBeInTheDocument();
  });

  it("offers only categories the shared selection can fill", () => {
    renderCatalog({ categories: [], skus: ["TOP-1"] });

    expect(screen.getByRole("button", { name: "Tops" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pants" })).not.toBeInTheDocument();
  });

  it("gives no way back to a client who was simply sent the link", () => {
    // Nothing in this session ever saw the admin view.
    renderCatalog({ categories: [], skus: ["PANT-1"] });
    expect(screen.queryByRole("button", { name: /Back to admin/ })).not.toBeInTheDocument();
  });

  it("gives a way back to whoever built the link and then opened it", () => {
    sessionStorage.setItem("itoo.admin", "1");
    renderCatalog({ categories: [], skus: ["PANT-1"] });
    expect(screen.getByRole("button", { name: /Back to admin/ })).toBeInTheDocument();
  });

  it("gives the team a way back out of their own preview", async () => {
    const user = userEvent.setup();
    renderCatalog();
    await user.click(screen.getByRole("button", { name: /Add TOP-1 to selection/ }));
    await user.click(screen.getByRole("button", { name: /Preview/ }));

    const back = screen.getByRole("button", { name: /Back to admin/ });
    expect(back).toBeInTheDocument();

    await user.click(back);
    expect(screen.getByRole("button", { name: /^Sync$/ })).toBeInTheDocument();
  });
});

describe("copy to order", () => {
  it("shows the line before it is copied", async () => {
    const user = userEvent.setup();
    renderCatalog();
    await user.click(within(cards()[0]).getByRole("button", { name: /Copy to order/ }));

    const popover = await screen.findByText(/This is what gets copied/);
    expect(popover).toBeInTheDocument();
    expect(screen.getByText(/SKU: TOP-1/)).toBeInTheDocument();
  });

  it("copies that line", async () => {
    const user = userEvent.setup();
    renderCatalog();
    await user.click(within(cards()[0]).getByRole("button", { name: /Copy to order/ }));
    await user.click(await screen.findByRole("button", { name: /^Copy$/ }));

    await expect(navigator.clipboard.readText()).resolves.toContain("SKU: TOP-1");
  });
});
