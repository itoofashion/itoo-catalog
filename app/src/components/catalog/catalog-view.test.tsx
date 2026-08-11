import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CatalogView } from "./catalog-view";
import { toPublicCatalog, type PublicProduct } from "@/lib/catalog/public";
import type { Product } from "@/lib/catalog/types";
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

/**
 * The eye on a card goes to the server, and what it does there is the action's
 * own test (see app/actions.test.ts). What matters here is that the press gets
 * sent, that the card shows the answer, and that a refusal puts the card back.
 */
const { setStyleHidden } = vi.hoisted(() => ({ setStyleHidden: vi.fn() }));
vi.mock("@/app/actions", () => ({ setStyleHidden }));

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
    isHidden: false,
    ...overrides,
  };
}

/** A product as the store holds it, for the tests that start before publication. */
function storedProduct(sku: string): Product {
  return {
    sku,
    name: `Style ${sku}`,
    price: 19.75,
    category: "Tops",
    colors: ["Beige"],
    images: [{ url: "/i/abc", sourceUrl: "https://fg-image.fashiongo.net/1_a.jpg", color: "Beige" }],
    sizes: ["S", "M", "L"],
    packBreakdown: [2, 2, 2],
    minimumUnits: 6,
    createdAt: "2020-01-01T00:00:00.000Z",
    sourceId: 1,
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

/** Where the browser says it is, which is the link a visitor would send. */
const address = () => `${window.location.pathname}${window.location.search}`;

/**
 * The browser's Back and Forward buttons, as the page hears them: the address
 * has already changed by the time the event arrives.
 */
function travelTo(to: string) {
  window.history.replaceState(null, "", to);
  act(() => {
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
}

beforeEach(() => {
  replace.mockClear();
  setStyleHidden.mockReset().mockResolvedValue({ ok: true });
  window.history.replaceState(null, "", "/");
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

  it("prices the minimum order under the words the client asked for", async () => {
    const user = userEvent.setup();
    renderCatalog();
    await user.click(within(cards()[0]).getByRole("img"));

    const dialog = await screen.findByRole("dialog");
    // 6 pieces at $19.75, labelled "Total cost:" — the client's own words for it.
    expect(within(dialog).getByText("Total cost:")).toBeInTheDocument();
    expect(within(dialog).getByText("$118.50")).toBeInTheDocument();
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

  it("keeps the logo, New and the categories on one line, in that order", () => {
    renderCatalog();
    const header = screen.getByRole("banner");
    // What makes one line fit a phone: everything after the logo is a single
    // strip that runs out of screen sideways instead of onto a second row.
    const strip = header.querySelector("[data-filter-strip]") as HTMLElement;

    expect(strip.className).toContain("overflow-x-auto");
    expect(within(strip).getByRole("button", { name: /^New$/ })).toBeInTheDocument();
    expect(within(strip).getByRole("button", { name: "Pants" })).toBeInTheDocument();
    // New at the head of the strip, where it sits on a laptop.
    expect(within(strip).getAllByRole("button")[0]).toHaveTextContent("New");
    // The logo is held out of the scroll, so it stays reachable at any width.
    expect(
      within(header).getByRole("img", { name: "itoo" }).closest("[data-filter-strip]"),
    ).toBeNull();
  });

  it("does not wrap onto a second line on a phone", () => {
    renderCatalog();
    const row = screen.getByRole("banner").firstElementChild as HTMLElement;
    expect(row.className).not.toContain("flex-wrap");
  });
});

describe("searching the catalog", () => {
  const searchBox = () => screen.getByRole("searchbox", { name: /search/i });

  it("sits in the header, for the team and for a client alike", () => {
    renderCatalog(EMPTY_SELECTION, NO_FILTERS, { isTeam: false });
    expect(within(screen.getByRole("banner")).getByRole("searchbox")).toBeInTheDocument();
  });

  it("narrows the grid to matching names as it is typed", async () => {
    const user = userEvent.setup();
    renderCatalog();
    await user.type(searchBox(), "pant");

    expect(cards()).toHaveLength(2);
    expect(within(grid()).queryByText("Style TOP-1")).not.toBeInTheDocument();
  });

  it("finds a style by its number", async () => {
    const user = userEvent.setup();
    renderCatalog(EMPTY_SELECTION, NO_FILTERS, { isTeam: false });
    await user.type(searchBox(), "pant-2");

    expect(cards()).toHaveLength(1);
    expect(within(grid()).getByText("Style PANT-2")).toBeInTheDocument();
  });

  it("narrows a category rather than escaping it", async () => {
    const user = userEvent.setup();
    renderCatalog();
    await user.click(screen.getByRole("button", { name: "Pants" }));
    await user.type(searchBox(), "PANT-1");

    expect(cards()).toHaveLength(1);
  });

  it("keeps the search in the address, so it can just be copied", async () => {
    const user = userEvent.setup();
    renderCatalog();
    await user.type(searchBox(), "lace");

    expect(address()).toBe("/?q=lace");
  });

  it("starts from the search the address arrived with", () => {
    renderCatalog(EMPTY_SELECTION, { ...NO_FILTERS, query: "TOP" });
    expect(cards()).toHaveLength(1);
    expect(searchBox()).toHaveValue("TOP");
  });

  it("offers the way out of a search that matches nothing", async () => {
    const user = userEvent.setup();
    renderCatalog();
    await user.type(searchBox(), "no such style");
    expect(cards()).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: /Show every style/ }));
    expect(cards()).toHaveLength(3);
    expect(searchBox()).toHaveValue("");
  });
});

/**
 * The day a style was added is published to the team alone (see
 * lib/catalog/public.ts), so the filter over it exists only in their view. It is
 * deliberately not in the address: the address is the link a client gets sent.
 */
describe("the team's filter by the day a style was added", () => {
  const dated = [
    product({ sku: "TOP-1", category: "Tops", addedAt: "2026-06-01T00:00:00.000Z" }),
    product({ sku: "PANT-1", category: "Pants", addedAt: "2026-07-10T00:00:00.000Z" }),
  ];

  function renderDated({ isTeam = true } = {}) {
    return render(
      <CatalogView
        products={dated}
        selection={EMPTY_SELECTION}
        filters={NO_FILTERS}
        isTeam={isTeam}
      />,
    );
  }

  const dateBox = () => screen.getByLabelText(/added after/i);

  it("narrows the grid to styles added on the chosen day or after", () => {
    renderDated();
    fireEvent.change(dateBox(), { target: { value: "2026-07-01" } });

    expect(cards()).toHaveLength(1);
    expect(within(grid()).getByText("Style PANT-1")).toBeInTheDocument();
  });

  it("composes with a search", async () => {
    const user = userEvent.setup();
    renderDated();
    fireEvent.change(dateBox(), { target: { value: "2026-07-01" } });
    await user.type(screen.getByRole("searchbox"), "top");

    expect(cards()).toHaveLength(0);
  });

  it("is nowhere in a client's view", () => {
    renderDated({ isTeam: false });
    expect(screen.queryByLabelText(/added after/i)).not.toBeInTheDocument();
  });

  it("neither shows nor applies in the team's preview of the client view", async () => {
    const user = userEvent.setup();
    renderDated();
    fireEvent.change(dateBox(), { target: { value: "2026-07-01" } });
    await user.click(screen.getByRole("button", { name: /Public view/ }));

    // The preview is a promise about what the client will see, and the client
    // sees every style whatever day it arrived.
    expect(screen.queryByLabelText(/added after/i)).not.toBeInTheDocument();
    expect(cards()).toHaveLength(2);
  });

  it("is cleared by the way out of an empty grid", async () => {
    const user = userEvent.setup();
    renderDated();
    fireEvent.change(dateBox(), { target: { value: "2027-01-01" } });
    expect(cards()).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: /Show every style/ }));
    expect(cards()).toHaveLength(2);
  });
});

describe("the logo", () => {
  it("is the way back to the whole catalog", () => {
    renderCatalog();
    expect(screen.getByRole("link", { name: /itoo/ })).toHaveAttribute("href", "/");
  });

  it("clears the category, the New filter and the page number", async () => {
    const user = userEvent.setup();
    // Nothing in Pants is new, so this pair of filters shows an empty grid.
    renderCatalog(EMPTY_SELECTION, { category: "Pants", newOnly: true, page: 1 });
    expect(cards()).toHaveLength(0);

    await user.click(screen.getByRole("link", { name: /itoo/ }));

    expect(cards()).toHaveLength(3);
    // Handled here rather than let through to the router: the catalog is
    // already in this browser, and fetching it again to clear two filters is a
    // wait for nothing.
    expect(replace).toHaveBeenLastCalledWith("/", expect.anything());
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

/**
 * Styles arrive with up to twenty-nine photographs, and more than half the
 * catalog carries seven or more. The row of dots travels instead of growing;
 * which dots it holds is decided in lib/catalog/dots.ts and tested there.
 */
describe("a style with more photographs than the row of dots can hold", () => {
  const twelvePhotos = product({
    sku: "TOP-9",
    images: Array.from({ length: 12 }, (_, index) => ({
      url: `/i/photo-${index}`,
      color: "Beige",
    })),
  });

  function renderGallery() {
    render(
      <CatalogView
        products={[twelvePhotos]}
        selection={EMPTY_SELECTION}
        filters={NO_FILTERS}
        isTeam={false}
      />,
    );
    return within(screen.getByRole("article"));
  }

  it("still draws dots, never a counter", () => {
    const card = renderGallery();
    expect(card.getAllByRole("button", { name: /^Photo \d+$/ }).length).toBeGreaterThan(0);
    expect(card.queryByText(/^\d+ \/ \d+$/)).not.toBeInTheDocument();
  });

  it("draws no more than seven of them", () => {
    expect(renderGallery().getAllByRole("button", { name: /^Photo \d+$/ })).toHaveLength(7);
  });

  it("moves the row along with the frame on screen", async () => {
    const user = userEvent.setup();
    const card = renderGallery();
    // The seventh photograph is the last the opening window reaches.
    await user.click(card.getByRole("button", { name: "Photo 7" }));

    expect(card.getByRole("button", { name: "Photo 7" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    // The window has travelled: the first photograph has dropped off the near
    // end and one that was out of reach has arrived at the far end.
    expect(card.queryByRole("button", { name: "Photo 1" })).not.toBeInTheDocument();
    expect(card.getByRole("button", { name: "Photo 10" })).toBeInTheDocument();
  });
});

/**
 * The open style says where the gallery has got to with the rail of thumbnails,
 * not with a second row of dots underneath: the thumbnails carry the same
 * meaning and show the photographs themselves, and two indicators one above the
 * other are noise. The numeric counter is gone from both.
 */
describe("the indicator in an open style", () => {
  const fourPhotos = product({
    sku: "TOP-4",
    images: Array.from({ length: 4 }, (_, index) => ({
      url: `/i/photo-${index}`,
      color: "Beige",
    })),
  });

  async function openIt() {
    const user = userEvent.setup();
    render(
      <CatalogView
        products={[fourPhotos]}
        selection={EMPTY_SELECTION}
        filters={NO_FILTERS}
        isTeam={false}
      />,
    );
    await user.click(within(screen.getByRole("article")).getAllByRole("img")[0]);
    return { user, dialog: within(await screen.findByRole("dialog")) };
  }

  it("is a thumbnail of every photograph, with the one on screen marked", async () => {
    const { dialog } = await openIt();
    expect(dialog.getAllByRole("button", { name: /^Photo \d+ of 4$/ })).toHaveLength(4);
    expect(dialog.getByRole("button", { name: "Photo 1 of 4" })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("carries no dots of its own and no counter", async () => {
    const { dialog } = await openIt();
    expect(dialog.queryByText(/^\d+ \/ \d+$/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("dialog").querySelector("[data-photo-dots]"),
    ).toBeNull();
  });

  it("puts the rail beside the photograph on a laptop and under it on a phone", async () => {
    const { dialog } = await openIt();
    const rail = dialog.getByRole("button", { name: "Photo 1 of 4" })
      .parentElement as HTMLElement;

    // A row that scrolls sideways by default, a column that scrolls down from
    // the small breakpoint up. The photograph is put above it by reversing the
    // column, so the rail still comes first for the keyboard.
    expect(rail.className).toContain("overflow-x-auto");
    expect(rail.className).toContain("sm:flex-col");
    expect(rail.parentElement?.className).toContain("flex-col-reverse");
  });
});

/**
 * The frame on screen is one thing held by the catalog, exactly as the chosen
 * color is: the card in the grid and the open style are two views of one
 * gallery, and they have to agree in both directions.
 */
describe("one frame shared by the card and the open style", () => {
  const eightPhotos = product({
    sku: "TOP-8",
    images: Array.from({ length: 8 }, (_, index) => ({
      url: `/i/photo-${index}`,
      color: "Beige",
    })),
  });

  function renderStyle() {
    render(
      <CatalogView
        products={[eightPhotos]}
        selection={EMPTY_SELECTION}
        filters={NO_FILTERS}
        isTeam={false}
      />,
    );
    return within(screen.getByRole("article"));
  }

  it("opens the style on the photograph the card had reached", async () => {
    const user = userEvent.setup();
    const card = renderStyle();
    await user.click(card.getByRole("button", { name: "Photo 5" }));
    // The photograph on screen is the one a tap lands on.
    await user.click(card.getByRole("button", { name: /photo 5 of 8/ }));

    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByRole("button", { name: "Photo 5 of 8" })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("leaves the card on the photograph the style was closed on", async () => {
    const user = userEvent.setup();
    const card = renderStyle();
    await user.click(card.getByRole("button", { name: /photo 1 of 8/ }));

    const dialog = within(await screen.findByRole("dialog"));
    await user.click(dialog.getByRole("button", { name: "Photo 6 of 8" }));
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // The bug this answers: swiping to the middle of a gallery and pressing the
    // cross used to hand back a card still showing the first photograph.
    expect(card.getByRole("button", { name: "Photo 6" })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });
});

describe("the address bar", () => {
  it("follows the category being browsed, so it can just be copied", async () => {
    const user = userEvent.setup();
    renderCatalog();
    await user.click(screen.getByRole("button", { name: "Pants" }));

    expect(replace).toHaveBeenCalledWith("/?show=pants", expect.anything());
  });

  it("writes a category as a slug rather than as a run of percent signs", async () => {
    const user = userEvent.setup();
    render(
      <CatalogView
        products={[product({ sku: "JR-1", category: "Jumpsuits & Rompers" })]}
        selection={EMPTY_SELECTION}
        filters={NO_FILTERS}
        isTeam
      />,
    );
    await user.click(screen.getByRole("button", { name: "Jumpsuits & Rompers" }));

    expect(replace).toHaveBeenCalledWith("/?show=jumpsuits-rompers", expect.anything());
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

    expect(replace).toHaveBeenCalledWith("/?cats=pants", expect.anything());
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

    expect(screen.getByText(/all of Pants · 2 styles/)).toBeInTheDocument();
  });

  it("swallows a style that had been picked by hand, instead of listing it twice", async () => {
    const user = userEvent.setup();
    renderCatalog();
    await user.click(screen.getByRole("button", { name: /Add PANT-1 to selection/ }));
    await user.click(screen.getByRole("button", { name: /Add all of Pants to the link/ }));

    // The address is the link, and it now says "all of Pants" and nothing else.
    expect(replace).toHaveBeenLastCalledWith("/?cats=pants", expect.anything());
    expect(screen.getByText(/^all of Pants · 2 styles$/)).toBeInTheDocument();
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

    expect(screen.getByText(/2 styles picked for you/)).toBeInTheDocument();
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
    expect(screen.queryByRole("link", { name: /Admin panel/ })).not.toBeInTheDocument();
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

  it("points the team at the admin page, and says that is where it goes", () => {
    renderCatalog();
    // "Admin" on its own was read as one more filter above the grid.
    expect(screen.getByRole("link", { name: /Admin panel/ })).toHaveAttribute(
      "href",
      "/admin",
    );
  });

  it("shows no admin page to someone who never signed in", () => {
    renderCatalog(EMPTY_SELECTION, NO_FILTERS, { isTeam: false });
    expect(screen.queryByRole("link", { name: /Admin/ })).not.toBeInTheDocument();
  });
});

describe("copying a style into a chat", () => {
  const copyButtonOf = (card: ReturnType<typeof within>) =>
    card.getByRole("button", { name: /^Copy Item Details/ });

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

  it("ends on a link to the style, so the message is one press from the photos", async () => {
    const user = userEvent.setup();
    renderCatalog();
    await user.click(copyButtonOf(within(cards()[0])));

    const copied = await navigator.clipboard.readText();
    // Absolute, or a chat app shows it as text rather than as a link.
    expect(copied.split("\n").at(-1)).toBe("http://localhost:3000/p/top-1?c=beige");
  });

  it("sends the color the buyer is looking at in the link as well", async () => {
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

    await expect(navigator.clipboard.readText()).resolves.toContain(
      "http://localhost:3000/p/top-7?c=black",
    );
  });
});

/** Two colors, so there is something to disagree about. */
const twoColors = product({ sku: "TOP-7", colors: ["Beige", "Black"] });

function renderOneStyle(props: { openSku?: string; openColor?: string } = {}) {
  render(
    <CatalogView
      products={[twoColors]}
      selection={EMPTY_SELECTION}
      filters={NO_FILTERS}
      isTeam={false}
      {...props}
    />,
  );
  return within(screen.getByRole("article"));
}

describe("an address of its own for every style", () => {
  it("names the style in the address when it is opened", async () => {
    const user = userEvent.setup();
    renderCatalog();
    await user.click(within(cards()[0]).getByRole("img"));

    await screen.findByRole("dialog");
    expect(address()).toBe("/p/top-1?c=beige");
  });

  it("gives the address back when the style is closed", async () => {
    const user = userEvent.setup();
    renderCatalog();
    await user.click(within(cards()[0]).getByRole("img"));
    await screen.findByRole("dialog");

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(address()).toBe("/");
  });

  it("keeps the filters of the catalog it came from in that address", async () => {
    const user = userEvent.setup();
    renderCatalog();
    await user.click(screen.getByRole("button", { name: "Pants" }));
    await user.click(within(cards()[0]).getByRole("img"));
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");

    expect(address()).toBe("/?show=pants");
  });

  it("opens the style the address arrived with, for a link sent in a chat", () => {
    renderOneStyle({ openSku: "TOP-7" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("follows the browser going back out of a style and forward into it", async () => {
    const user = userEvent.setup();
    renderCatalog();
    await user.click(within(cards()[0]).getByRole("img"));
    await screen.findByRole("dialog");

    travelTo("/");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    travelTo("/p/top-1?c=beige");
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("leaves the catalog alone for a style number the address invents", async () => {
    renderCatalog();
    travelTo("/p/no-such-style");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(cards()).toHaveLength(3);
  });
});

describe("one chosen color for the card and the open style", () => {
  const swatchIn = (view: ReturnType<typeof within>, name: string) =>
    view.getByRole("button", { name });
  const chosenIn = (view: ReturnType<typeof within>, name: string) =>
    swatchIn(view, name).getAttribute("aria-pressed") === "true";

  it("opens the style on the color that was picked on the card", async () => {
    const user = userEvent.setup();
    const card = renderOneStyle();

    await user.click(swatchIn(card, "Black"));
    await user.click(card.getAllByRole("img")[0]);

    const dialog = within(await screen.findByRole("dialog"));
    expect(chosenIn(dialog, "Black")).toBe(true);
    expect(chosenIn(dialog, "Beige")).toBe(false);
  });

  it("shows the color chosen inside the style on its card once it is closed", async () => {
    const user = userEvent.setup();
    const card = renderOneStyle();
    await user.click(card.getAllByRole("img")[0]);

    const dialog = within(await screen.findByRole("dialog"));
    await user.click(swatchIn(dialog, "Black"));
    await user.keyboard("{Escape}");

    expect(chosenIn(card, "Black")).toBe(true);
    expect(chosenIn(card, "Beige")).toBe(false);
  });

  it("puts the chosen color in the address of the open style", async () => {
    const user = userEvent.setup();
    const card = renderOneStyle();
    await user.click(card.getAllByRole("img")[0]);

    const dialog = within(await screen.findByRole("dialog"));
    await user.click(swatchIn(dialog, "Black"));

    expect(address()).toBe("/p/top-7?c=black");
  });

  // An open style hides the page behind it from a screen reader, so the card is
  // only asked about once the style has been closed.
  it("opens on the color the address asked for, and hands it to the card", async () => {
    const user = userEvent.setup();
    const card = renderOneStyle({ openSku: "TOP-7", openColor: "black" });

    expect(chosenIn(within(screen.getByRole("dialog")), "Black")).toBe(true);

    await user.keyboard("{Escape}");
    expect(chosenIn(card, "Black")).toBe(true);
  });

  it("ignores a color the style does not come in, rather than falling over", async () => {
    const user = userEvent.setup();
    const card = renderOneStyle({ openSku: "TOP-7", openColor: "chartreuse" });

    expect(chosenIn(within(screen.getByRole("dialog")), "Beige")).toBe(true);

    await user.keyboard("{Escape}");
    expect(chosenIn(card, "Beige")).toBe(true);
  });

  it("carries the color back and forward with the browser buttons", async () => {
    const user = userEvent.setup();
    const card = renderOneStyle();
    await user.click(card.getAllByRole("img")[0]);
    await screen.findByRole("dialog");

    travelTo("/p/top-7?c=black");

    expect(chosenIn(within(screen.getByRole("dialog")), "Black")).toBe(true);
  });
});

/**
 * A hidden style never reaches a client's browser at all, which is the
 * publication boundary's job and is tested there (lib/catalog/public.test.ts).
 * What the grid owes on top of that: the team can still see the style, can tell
 * at a glance that it is out of the catalog, and has somewhere to press to put
 * it back.
 */
describe("a style the team has hidden", () => {
  const withHidden = [
    product({ sku: "TOP-1", category: "Tops" }),
    product({ sku: "PANT-1", category: "Pants", isHidden: true }),
  ];

  function renderWithHidden({ isTeam = true } = {}) {
    return render(
      <CatalogView
        products={withHidden}
        selection={EMPTY_SELECTION}
        filters={NO_FILTERS}
        isTeam={isTeam}
      />,
    );
  }

  const cardOf = (sku: string) => grid().querySelector(`[data-sku="${sku}"]`);

  it("stays on the team's grid, marked, because that is where it is undone", () => {
    renderWithHidden();
    expect(cards()).toHaveLength(2);
    expect(cardOf("PANT-1")).toHaveAttribute("data-hidden");
    expect(cardOf("TOP-1")).not.toHaveAttribute("data-hidden");
    expect(within(grid()).getByText("Hidden from clients")).toBeInTheDocument();
  });

  it("takes a press on the eye to the server", async () => {
    const user = userEvent.setup();
    renderWithHidden();
    await user.click(screen.getByRole("button", { name: "Hide TOP-1 from clients" }));

    expect(setStyleHidden).toHaveBeenCalledWith("TOP-1", true);
  });

  it("marks the card as soon as it is pressed, without waiting for a reload", async () => {
    const user = userEvent.setup();
    renderWithHidden();
    await user.click(screen.getByRole("button", { name: "Hide TOP-1 from clients" }));

    expect(cardOf("TOP-1")).toHaveAttribute("data-hidden");
    expect(
      screen.getByRole("button", { name: "Show TOP-1 to clients again" }),
    ).toBeInTheDocument();
  });

  it("puts a hidden style back", async () => {
    const user = userEvent.setup();
    renderWithHidden();
    await user.click(screen.getByRole("button", { name: "Show PANT-1 to clients again" }));

    expect(setStyleHidden).toHaveBeenCalledWith("PANT-1", false);
    expect(cardOf("PANT-1")).not.toHaveAttribute("data-hidden");
  });

  it("puts the card back the way it was when the server refuses", async () => {
    const user = userEvent.setup();
    setStyleHidden.mockResolvedValue({ error: "Sign in to change the catalog." });
    renderWithHidden();
    await user.click(screen.getByRole("button", { name: "Hide TOP-1 from clients" }));

    // The card has to end up showing the catalog as it really is, not as the
    // press meant it to be.
    expect(cardOf("TOP-1")).not.toHaveAttribute("data-hidden");
  });

  it("has no eye on it at all for anyone but the team", () => {
    renderWithHidden({ isTeam: false });
    expect(screen.queryByRole("button", { name: /from clients/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /to clients again/ })).not.toBeInTheDocument();
  });
});

describe("the team's preview of the client view", () => {
  const withHidden = [
    product({ sku: "TOP-1", category: "Tops" }),
    product({ sku: "PANT-1", category: "Pants", isHidden: true }),
  ];

  async function previewAsClient() {
    const user = userEvent.setup();
    render(
      <CatalogView
        products={withHidden}
        selection={EMPTY_SELECTION}
        filters={NO_FILTERS}
        isTeam
      />,
    );
    await user.click(screen.getByRole("button", { name: /Public view/ }));
    return user;
  }

  it("drops the hidden style, because the client's page does not contain one", async () => {
    await previewAsClient();
    expect(cards()).toHaveLength(1);
    expect(within(grid()).queryByText("Style PANT-1")).not.toBeInTheDocument();
  });

  it("counts what the client will actually see", async () => {
    await previewAsClient();
    expect(styleCount()).toBe("1 style");
  });

  it("takes a style out of the preview the moment it is hidden", async () => {
    const user = userEvent.setup();
    render(
      <CatalogView
        products={withHidden}
        selection={EMPTY_SELECTION}
        filters={NO_FILTERS}
        isTeam
      />,
    );
    await user.click(screen.getByRole("button", { name: "Hide TOP-1 from clients" }));
    await user.click(screen.getByRole("button", { name: /Public view/ }));

    expect(cards()).toHaveLength(0);
  });
});

/**
 * The end of the chain, in one test: a stored catalog with a hidden style in it,
 * put through the publication boundary and drawn. Everything before this checks
 * a link in the chain; this checks that what comes out the far end of it, the
 * markup a client's browser is sent, has no trace of the style in it.
 */
describe("the markup a client's browser is sent", () => {
  const catalog = {
    products: [storedProduct("TOP-1"), storedProduct("PANT-1")],
    syncedAt: "2026-08-04T09:00:00.000Z",
  };
  const hidden = new Set(["PANT-1"]);

  function drawFor(isTeam: boolean) {
    const { products: published } = toPublicCatalog(catalog, new Date(), {
      hidden,
      isTeam,
    });
    const { container } = render(
      <CatalogView
        products={published}
        selection={EMPTY_SELECTION}
        filters={NO_FILTERS}
        isTeam={isTeam}
      />,
    );
    return container;
  }

  it("never mentions the hidden style, by number or by name", () => {
    const markup = drawFor(false).innerHTML;
    expect(markup).not.toContain("PANT-1");
    expect(markup).not.toContain("Style PANT-1");
    expect(markup).toContain("TOP-1");
  });

  it("counts only what is left", () => {
    drawFor(false);
    expect(styleCount()).toBe("1 style");
  });

  it("does mention it to the team, with the mark and the way back", () => {
    const markup = drawFor(true).innerHTML;
    expect(markup).toContain("PANT-1");
    expect(markup).toContain("Hidden from clients");
    expect(
      screen.getByRole("button", { name: "Show PANT-1 to clients again" }),
    ).toBeInTheDocument();
  });
});

describe("the link panel, when part of the selection is hidden", () => {
  /** The floating panel that turns a selection into one link to send. */
  const panel = () =>
    screen.getByText("Selected for a client").closest("[data-link-panel]") as HTMLElement;

  it("counts only what the client's page will contain", async () => {
    const user = userEvent.setup();
    render(
      <CatalogView
        products={[
          product({ sku: "TOP-1", category: "Tops" }),
          product({ sku: "TOP-2", category: "Tops" }),
        ]}
        selection={{ categories: ["Tops"], skus: [] }}
        filters={NO_FILTERS}
        isTeam
      />,
    );
    // Arriving on a selection opens in the client's view, even for the team;
    // the panel is on the other side of that switch.
    await user.click(screen.getByRole("button", { name: /Admin view/ }));

    expect(within(panel()).getByText(/2 styles/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Hide TOP-2 from clients" }));

    // The panel is a promise about what the client will see, so hiding one of
    // the two has to change the promise.
    expect(within(panel()).getByText(/1 style/)).toBeInTheDocument();
  });
});

/**
 * The page numbers sit under forty-eight cards, which on a phone is several
 * screens below the first row. The jump back to the top is the only sign the
 * press landed at all.
 */
describe("turning the page", () => {
  const manyStyles = Array.from({ length: 60 }, (_, index) =>
    product({ sku: `TOP-${index + 1}` }),
  );

  it("goes to the top first and fetches the page after", async () => {
    const user = userEvent.setup();
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    render(
      <CatalogView
        products={manyStyles}
        selection={EMPTY_SELECTION}
        filters={NO_FILTERS}
        isTeam={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: "2" }));

    // Outright, not glided: drawing the next forty-eight cards holds the main
    // thread long enough to strand a glide halfway up a page whose height has
    // just changed under it.
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    // The other way round, which is how this was, the press did nothing where
    // the finger was until the new photographs had arrived.
    expect(scrollTo.mock.invocationCallOrder[0]).toBeLessThan(
      replace.mock.invocationCallOrder[0],
    );
    scrollTo.mockRestore();
  });
});
