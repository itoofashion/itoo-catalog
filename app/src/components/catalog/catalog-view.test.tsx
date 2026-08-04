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

/** Signed in as the team unless a test says otherwise (see lib/admin/auth.ts). */
function renderCatalog(
  selection: CatalogSelection = EMPTY_SELECTION,
  filters: CatalogFilters = NO_FILTERS,
  { isTeam = true } = {},
) {
  return render(
    <CatalogView
      products={products}
      syncedAt={NOW}
      selection={selection}
      filters={filters}
      isTeam={isTeam}
    />,
  );
}

const grid = () => screen.getByRole("main");
const cards = () => within(grid()).queryAllByRole("article");

beforeEach(() => {
  replace.mockClear();
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
    await user.click(screen.getByRole("button", { name: /^New$/ }));

    expect(cards()).toHaveLength(1);
    expect(within(grid()).getByText("Style TOP-1")).toBeInTheDocument();
  });

  it("marks recent styles as new", () => {
    renderCatalog();
    // By the badge, not by the word: the filter chip says "New" as well.
    expect(grid().querySelectorAll('[data-badge="new"]')).toHaveLength(1);
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
    renderCatalog(EMPTY_SELECTION, { category: "Pants", newOnly: false, page: 1 });
    expect(cards()).toHaveLength(2);
  });

  it("offers a way back out of a filter that matches nothing", async () => {
    const user = userEvent.setup();
    // Nothing in Pants is new, so this pair of filters can only come up empty.
    renderCatalog(EMPTY_SELECTION, { category: "Pants", newOnly: true, page: 1 });
    expect(cards()).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: /Show every style/ }));
    expect(cards()).toHaveLength(3);
  });
});

describe("the photo gallery", () => {
  const threePhotos = product({
    sku: "TOP-9",
    images: [
      { url: "/i/one", color: "Beige" },
      { url: "/i/two", color: "Beige" },
      { url: "/i/three", color: "Beige" },
    ],
  });

  /** One style on the page, so the dots under it are unambiguous. */
  function renderGallery() {
    render(
      <CatalogView
        products={[threePhotos]}
        syncedAt={NOW}
        selection={EMPTY_SELECTION}
        filters={NO_FILTERS}
        isTeam={false}
      />,
    );
    return within(screen.getByRole("article"));
  }

  const dotsOf = (card: ReturnType<typeof renderGallery>) =>
    card.getAllByRole("button", { name: /^Photo \d+$/ });

  it("gives every photo a dot of its own", () => {
    expect(dotsOf(renderGallery())).toHaveLength(3);
  });

  it("opens on the first photo, which has nothing before it", () => {
    const card = renderGallery();

    expect(dotsOf(card)[0]).toHaveAttribute("aria-current", "true");
    expect(card.queryByRole("button", { name: "Previous photo" })).not.toBeInTheDocument();
    expect(card.getByRole("button", { name: "Next photo" })).toBeInTheDocument();
  });

  it("moves to the photo whose dot was pressed", async () => {
    const user = userEvent.setup();
    const card = renderGallery();
    const dots = dotsOf(card);

    await user.click(dots[2]);

    expect(dots[2]).toHaveAttribute("aria-current", "true");
    expect(dots[0]).not.toHaveAttribute("aria-current");
    // Nothing follows the last photo, so nothing offers to go there.
    expect(card.queryByRole("button", { name: "Next photo" })).not.toBeInTheDocument();
    expect(card.getByRole("button", { name: "Previous photo" })).toBeInTheDocument();
  });

  it("moves one photo at a time with the arrows", async () => {
    const user = userEvent.setup();
    const card = renderGallery();

    await user.click(card.getByRole("button", { name: "Next photo" }));

    expect(dotsOf(card)[1]).toHaveAttribute("aria-current", "true");
  });

  it("leaves a single-photo style without a gallery to steer", () => {
    renderCatalog();
    expect(
      within(cards()[0]).queryByRole("button", { name: /^Photo \d+$/ }),
    ).not.toBeInTheDocument();
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
    await user.click(screen.getByRole("button", { name: /^New$/ }));

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
    expect(screen.getByText(/all of Pants/)).toBeInTheDocument();
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

    expect(screen.getByText(/all of Pants · 2 items/)).toBeInTheDocument();
  });
});

describe("the client's view", () => {
  it("opens straight into it for a shared link", () => {
    renderCatalog({ categories: [], skus: ["TOP-1", "PANT-1"] });

    expect(screen.getByText(/2 items picked for you/)).toBeInTheDocument();
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
    renderCatalog({ categories: [], skus: ["PANT-1"] }, NO_FILTERS, { isTeam: false });
    expect(screen.queryByRole("button", { name: /^Back/ })).not.toBeInTheDocument();
  });

  it("gives a way back to whoever built the link and then opened it", () => {
    renderCatalog({ categories: [], skus: ["PANT-1"] });
    expect(screen.getByRole("button", { name: /^Back/ })).toBeInTheDocument();
  });

  it("gives the team a way back out of their own preview", async () => {
    const user = userEvent.setup();
    renderCatalog();
    await user.click(screen.getByRole("button", { name: /Add TOP-1 to selection/ }));
    await user.click(screen.getByRole("button", { name: /Preview/ }));

    const back = screen.getByRole("button", { name: /^Back/ });
    expect(back).toBeInTheDocument();

    await user.click(back);
    expect(screen.getByRole("button", { name: /^Sync$/ })).toBeInTheDocument();
  });
});

describe("signing in", () => {
  it("still shows the whole catalog to a visitor who is not signed in", () => {
    renderCatalog(EMPTY_SELECTION, NO_FILTERS, { isTeam: false });
    expect(cards()).toHaveLength(3);
  });

  it("keeps the team's tools out of an unsigned visitor's hands", () => {
    renderCatalog(EMPTY_SELECTION, NO_FILTERS, { isTeam: false });

    expect(screen.queryByRole("button", { name: /to selection/ })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /to the link/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Sync$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Preview/ })).not.toBeInTheDocument();
  });

  it("shows no link panel to an unsigned visitor, whatever the address carries", () => {
    renderCatalog({ categories: [], skus: ["TOP-1"] }, NO_FILTERS, { isTeam: false });
    expect(screen.queryByRole("button", { name: /Get link/ })).not.toBeInTheDocument();
  });

  it("hands the tools to whoever signed in", () => {
    renderCatalog();

    expect(screen.getByRole("button", { name: /^Sync$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add TOP-1 to selection/ })).toBeInTheDocument();
  });

  it("offers the team a way out", () => {
    renderCatalog();
    expect(screen.getByRole("button", { name: /Sign out/ })).toBeInTheDocument();
  });

  it("offers no way out to someone who never signed in", () => {
    renderCatalog(EMPTY_SELECTION, NO_FILTERS, { isTeam: false });
    expect(screen.queryByRole("button", { name: /Sign out/ })).not.toBeInTheDocument();
  });
});

describe("copying a style into a chat", () => {
  const copyButtonOf = (card: ReturnType<typeof within>) =>
    card.getByRole("button", { name: /^Copy details/ });

  it("copies on the first press, with no step in between", async () => {
    const user = userEvent.setup();
    renderCatalog();
    await user.click(copyButtonOf(within(cards()[0])));

    await expect(navigator.clipboard.readText()).resolves.toContain("SKU: TOP-1");
  });

  it("copies the whole line sheet row, not just the style number", async () => {
    const user = userEvent.setup();
    renderCatalog();
    await user.click(copyButtonOf(within(cards()[0])));

    const copied = await navigator.clipboard.readText();
    expect(copied).toContain("Style TOP-1");
    expect(copied).toContain("Color: Beige");
    expect(copied).toContain("Sizes: S·M·L (pack 2-2-2)");
    expect(copied).toContain("Minimum order: 6 pieces");
    expect(copied).toContain("$19.75");
  });

  it("says on the button itself that the copy happened", async () => {
    const user = userEvent.setup();
    renderCatalog();
    const button = copyButtonOf(within(cards()[0]));
    await user.click(button);

    expect(button).toHaveTextContent(/Copied/);
    // The name has to follow the words, or a screen reader hears the old label.
    expect(button).toHaveAccessibleName(/^Copied/);
  });

  it("names the style it copied, so forty-eight buttons stay apart", () => {
    renderCatalog();
    expect(copyButtonOf(within(cards()[0]))).toHaveAccessibleName(/TOP-1/);
  });

  it("copies the color the buyer picked, not the first one", async () => {
    const user = userEvent.setup();
    render(
      <CatalogView
        products={[product({ sku: "TOP-7", colors: ["Beige", "Black"] })]}
        syncedAt={NOW}
        selection={EMPTY_SELECTION}
        filters={NO_FILTERS}
        isTeam={false}
      />,
    );
    const card = within(screen.getByRole("article"));

    await user.click(card.getByRole("button", { name: "Black" }));
    await user.click(copyButtonOf(card));

    await expect(navigator.clipboard.readText()).resolves.toContain("Color: Black");
  });

  it("copies from the open style as well as from its card", async () => {
    const user = userEvent.setup();
    renderCatalog();
    await user.click(within(cards()[0]).getByRole("img"));

    const dialog = within(await screen.findByRole("dialog"));
    await user.click(copyButtonOf(dialog));

    await expect(navigator.clipboard.readText()).resolves.toContain("SKU: TOP-1");
  });
});
