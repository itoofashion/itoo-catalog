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
      selection={selection}
      filters={filters}
      isTeam={isTeam}
    />,
  );
}

const grid = () => screen.getByRole("main");
const cards = () => within(grid()).queryAllByRole("article");
/** The live count above the grid, which is how a filter says it did something. */
const styleCount = () => screen.getByText(/^\d+ styles?$/).textContent;

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

describe("the header", () => {
  it("wears the brand's own logo rather than the word", () => {
    renderCatalog();
    const logo = within(screen.getByRole("banner")).getByRole("img", { name: "itoo" });

    expect(logo.getAttribute("src")).toContain("logo.png");
    // Asked for at its full size and drawn at 28px, so it stays sharp on a
    // retina screen; the image optimizer is off, so this is the file as shipped.
    expect(logo).toHaveAttribute("width", "1050");
    expect(logo).toHaveAttribute("height", "483");
  });

  it("puts the New toggle beside the logo and the categories under them", () => {
    renderCatalog();
    const header = within(screen.getByRole("banner"));

    expect(header.getByRole("button", { name: /^New$/ })).toBeInTheDocument();
    expect(header.getByRole("button", { name: "Pants" })).toBeInTheDocument();
  });
});

describe("the count above the grid", () => {
  it("says how many styles are on show", () => {
    renderCatalog();
    expect(styleCount()).toBe("3 styles");
  });

  it("moves the moment a filter is applied, which is the whole point of it", async () => {
    const user = userEvent.setup();
    renderCatalog();
    await user.click(screen.getByRole("button", { name: /^New$/ }));

    expect(styleCount()).toBe("1 style");
  });

  it("follows a category as well", async () => {
    const user = userEvent.setup();
    renderCatalog();
    await user.click(screen.getByRole("button", { name: "Pants" }));

    expect(styleCount()).toBe("2 styles");
  });

  it("does not repeat the page number the pagination already carries", () => {
    renderCatalog();
    expect(within(grid()).queryByText(/page 1 of/)).not.toBeInTheDocument();
  });

  it("counts for a client too, not only for the team", () => {
    renderCatalog(EMPTY_SELECTION, NO_FILTERS, { isTeam: false });
    expect(styleCount()).toBe("3 styles");
  });
});

describe("switching between the two views", () => {
  it("offers the team the client's view without calling it a preview", () => {
    renderCatalog();
    expect(screen.getByRole("button", { name: /Public view/ })).toBeInTheDocument();
  });

  it("swaps one button for the other in the same place", async () => {
    const user = userEvent.setup();
    renderCatalog();
    await user.click(screen.getByRole("button", { name: /Public view/ }));

    expect(screen.getByRole("button", { name: /Admin view/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Public view/ })).not.toBeInTheDocument();
  });

  it("hands the tools back on the way in", async () => {
    const user = userEvent.setup();
    renderCatalog();
    await user.click(screen.getByRole("button", { name: /Add TOP-1 to selection/ }));
    await user.click(screen.getByRole("button", { name: /Public view/ }));
    expect(screen.queryByRole("button", { name: /to selection/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Admin view/ }));
    expect(screen.getByRole("button", { name: /Remove TOP-1 from selection/ })).toBeInTheDocument();
  });

  it("has no floating status bar left to cover the catalogue", () => {
    const { container } = renderCatalog();
    expect(container.querySelector("[data-status-bar]")).toBeNull();
  });

  it("keeps the switch out of the header, where it used to jump to", async () => {
    const user = userEvent.setup();
    renderCatalog();
    await user.click(screen.getByRole("button", { name: /Public view/ }));

    const header = screen.getByRole("banner");
    expect(within(header).queryByRole("button", { name: /view$/ })).not.toBeInTheDocument();
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
    // The arrow stays where it is and goes quiet: taken away, the click that
    // was aimed at it lands on the photo and opens the style.
    expect(card.getByRole("button", { name: "Previous photo" })).toBeDisabled();
    expect(card.getByRole("button", { name: "Next photo" })).toBeEnabled();
  });

  it("moves to the photo whose dot was pressed", async () => {
    const user = userEvent.setup();
    const card = renderGallery();
    const dots = dotsOf(card);

    await user.click(dots[2]);

    expect(dots[2]).toHaveAttribute("aria-current", "true");
    expect(dots[0]).not.toHaveAttribute("aria-current");
    // Nothing follows the last photo, so the arrow stops offering to go there,
    // while still standing in the way of the click that overshot.
    expect(card.getByRole("button", { name: "Next photo" })).toBeDisabled();
    expect(card.getByRole("button", { name: "Previous photo" })).toBeEnabled();
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

  it("swallows a style that had been picked by hand, instead of listing it twice", async () => {
    const user = userEvent.setup();
    renderCatalog();
    await user.click(screen.getByRole("button", { name: /Add PANT-1 to selection/ }));
    await user.click(screen.getByRole("button", { name: /Add all of Pants to the link/ }));

    // The address is the link, and it now says "all of Pants" and nothing else.
    expect(replace).toHaveBeenLastCalledWith("/?cats=Pants", expect.anything());
    expect(screen.getByText(/^all of Pants · 2 items$/)).toBeInTheDocument();
  });

  it("takes the swallowed style with it when the category is unticked", async () => {
    const user = userEvent.setup();
    renderCatalog();
    await user.click(screen.getByRole("button", { name: /Add PANT-1 to selection/ }));
    await user.click(screen.getByRole("button", { name: /Add all of Pants to the link/ }));
    await user.click(screen.getByRole("button", { name: /Remove all of Pants from the link/ }));

    expect(replace).toHaveBeenLastCalledWith("/", expect.anything());
    expect(screen.getByRole("button", { name: /Add PANT-1 to selection/ })).toBeInTheDocument();
  });

  it("leaves a style picked in another category exactly where it was", async () => {
    const user = userEvent.setup();
    renderCatalog();
    await user.click(screen.getByRole("button", { name: /Add TOP-1 to selection/ }));
    await user.click(screen.getByRole("button", { name: /Add all of Pants to the link/ }));
    await user.click(screen.getByRole("button", { name: /Remove all of Pants from the link/ }));

    expect(replace).toHaveBeenLastCalledWith("/?items=TOP-1", expect.anything());
  });
});

describe("the client's view", () => {
  it("opens straight into it for a shared link", () => {
    renderCatalog({ categories: [], skus: ["TOP-1", "PANT-1"] });

    expect(screen.getByText(/2 items picked for you/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /to selection/ }),
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
    expect(screen.queryByRole("button", { name: /Admin view/ })).not.toBeInTheDocument();
  });

  it("gives a way back to whoever built the link and then opened it", () => {
    renderCatalog({ categories: [], skus: ["PANT-1"] });
    expect(screen.getByRole("button", { name: /Admin view/ })).toBeInTheDocument();
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
    expect(screen.queryByRole("button", { name: /Public view/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Admin$/ })).not.toBeInTheDocument();
  });

  it("shows no link panel to an unsigned visitor, whatever the address carries", () => {
    renderCatalog({ categories: [], skus: ["TOP-1"] }, NO_FILTERS, { isTeam: false });
    expect(screen.queryByRole("button", { name: /Get link/ })).not.toBeInTheDocument();
  });

  it("hands the tools to whoever signed in", () => {
    renderCatalog();

    expect(screen.getByRole("button", { name: /Public view/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add TOP-1 to selection/ })).toBeInTheDocument();
  });

  it("points the team at the admin page, where signing out and syncing live", () => {
    renderCatalog();
    expect(screen.getByRole("link", { name: /^Admin$/ })).toHaveAttribute("href", "/admin");
  });

  it("shows no admin page to someone who never signed in", () => {
    renderCatalog(EMPTY_SELECTION, NO_FILTERS, { isTeam: false });
    expect(screen.queryByRole("link", { name: /^Admin$/ })).not.toBeInTheDocument();
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
    expect(copied).toContain("Pack: S ×2 · M ×2 · L ×2");
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
