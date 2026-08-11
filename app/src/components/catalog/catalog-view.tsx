"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Eye, Search, SlidersHorizontal, Undo2 } from "lucide-react";
import { setStyleHidden } from "@/app/actions";
import posthog from "posthog-js";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  categoriesOf,
  filterProducts,
  isSelected,
  selectedProducts,
} from "@/lib/catalog/filter";
import type { PublicProduct } from "@/lib/catalog/public";
import {
  ALL_CATEGORIES,
  buildCatalogQuery,
  isEmptySelection,
  NO_FILTERS,
  toggleCategory,
  toggleStyle,
  type CatalogFilters,
  type CatalogSelection,
} from "@/lib/catalog/share";
import { paginate } from "@/lib/catalog/pagination";
import {
  productAddress,
  productSlugs,
  readProductAddress,
  resolveSlug,
  slugifyCategories,
} from "@/lib/catalog/slug";
import { CategoryRow, NewFilterToggle } from "./category-filters";
import { LinkPanel } from "./link-panel";
import { PaginationBar } from "./pagination-bar";
import { ProductCard } from "./product-card";
import { ProductDialog } from "./product-dialog";

export type CatalogViewProps = {
  products: PublicProduct[];
  /** What the address asked for when the page opened. */
  selection: CatalogSelection;
  filters: CatalogFilters;
  /**
   * Whether this visitor signed in as the team. Decided on the server from the
   * session cookie, because a component cannot be trusted to decide it. See
   * lib/admin/auth.ts.
   */
  isTeam: boolean;
  /** Short links render the same page under /s/<code>; the address stays put. */
  readOnlyAddress?: boolean;
  /**
   * The style to open on arrival, for someone who was sent /p/y-542 in a chat.
   * The dialog is then rendered by the server, so the link opens on the style
   * rather than on the catalog with a flash of the grid first.
   */
  openSku?: string | null;
  /** The color that address asked for, already checked against the style. */
  openColor?: string | null;
  /**
   * Where the catalog itself lives, which is where closing a style goes back to.
   * The product route renders this same catalog under /p/<style>, so it says "/"
   * here rather than letting the component read its own address.
   */
  catalogPath?: string;
};

export function CatalogView({
  products,
  selection: initialSelection,
  filters: initialFilters,
  isTeam,
  readOnlyAddress = false,
  openSku = null,
  openColor = null,
  catalogPath,
}: CatalogViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  // Frozen on the first render: opening a style rewrites the address to /p/...,
  // and the way back out has to be the address the catalog came in on, not the
  // one the dialog just wrote.
  const [homePath] = useState(() => catalogPath ?? pathname);

  // A link that carries a selection is a client link: it opens as the client
  // sees it, with none of the team's controls.
  const arrivedViaClientLink = !isEmptySelection(initialSelection);

  const [selection, setSelection] = useState(initialSelection);
  const [filters, setFilters] = useState(initialFilters);
  // Opening one's own client link lands in the client's view, which is the point
  // of the link; the way back is a button, since this visitor is still the team.
  const [previewingAsClient, setPreviewingAsClient] = useState(arrivedViaClientLink);
  /**
   * A shared link is a shortcut through seven hundred styles, not a wall around
   * them: the client can step out of the selection and browse everything, and
   * step back into what was picked for them.
   */
  const [browsingAll, setBrowsingAll] = useState(false);

  const bySku = useMemo(
    () => new Map(products.map((product) => [product.sku, product])),
    [products],
  );
  const slugs = useMemo(() => productSlugs(products), [products]);

  /**
   * What the address asked for on arrival, resolved against the catalog once.
   * A color the style does not come in is dropped rather than shown: the style
   * is what makes the address, the color only decorates it.
   */
  const [arrival] = useState(() => {
    const product = openSku ? (products.find((item) => item.sku === openSku) ?? null) : null;
    return { product, color: product ? resolveSlug(openColor, product.colors) : null };
  });

  /**
   * The chosen color, by style, for every style the visitor has touched.
   *
   * It lives up here because the card and the open style are two views of one
   * choice: picking beige on the card and then opening the photograph has to
   * open beige, and changing it inside has to be what the grid shows on the way
   * out. Held apart, the two drifted, which is the bug this answers.
   */
  const [colors, setColors] = useState<Record<string, string>>(() =>
    arrival.product && arrival.color ? { [arrival.product.sku]: arrival.color } : {},
  );
  const colorOf = useCallback(
    (product: PublicProduct) => colors[product.sku] ?? product.colors[0] ?? null,
    [colors],
  );

  /**
   * The photograph each style is showing, by style, for the same reason and in
   * the same shape as the color above it.
   *
   * The card already handed its frame to the style it opened; the way back had
   * nothing, so someone who swiped to the middle of a gallery and pressed the
   * cross was returned to a card still showing the first photograph. One frame
   * held here is what makes the two sides of the same gallery agree in both
   * directions. It is deliberately not in the address: the address already
   * carries the style and its color, and a photo number in a shared link says
   * nothing to whoever receives it.
   */
  const [photos, setPhotos] = useState<Record<string, number>>(() =>
    arrival.product
      ? { [arrival.product.sku]: photoOfColor(arrival.product, arrival.color) }
      : {},
  );
  const photoOf = useCallback(
    (product: PublicProduct) =>
      Math.min(photos[product.sku] ?? 0, Math.max(0, product.images.length - 1)),
    [photos],
  );
  const showPhoto = useCallback((sku: string, index: number) => {
    // Scrolling reports the frame it lands on every time it settles, and most of
    // those are the frame already showing.
    setPhotos((current) => (current[sku] === index ? current : { ...current, [sku]: index }));
  }, []);

  const [openedSku, setOpenedSku] = useState<string | null>(
    () => arrival.product?.sku ?? null,
  );
  const openedProduct = openedSku ? (bySku.get(openedSku) ?? null) : null;

  const showTools = isTeam && !previewingAsClient;

  /**
   * Styles hidden or brought back since this page was rendered.
   *
   * The server has already decided what is hidden, and for a client it decided
   * by not sending the style at all. This is only the team's own view catching
   * up with a press before the server has answered it: without it the eye would
   * do nothing visible until the next reload, and a control that looks broken
   * gets pressed again.
   */
  const [hiddenNow, setHiddenNow] = useState<Record<string, boolean>>({});
  const hiddenOf = useCallback(
    (product: PublicProduct) => hiddenNow[product.sku] ?? product.isHidden,
    [hiddenNow],
  );

  async function toggleHidden(sku: string) {
    const product = bySku.get(sku);
    if (!product) return;
    const next = !hiddenOf(product);

    setHiddenNow((current) => ({ ...current, [sku]: next }));
    const result = await setStyleHidden(sku, next);
    // Put back the way it was when the server refuses, so the grid keeps showing
    // the catalog as it really is rather than as the press meant it to be.
    if ("error" in result) {
      setHiddenNow((current) => ({ ...current, [sku]: !next }));
      return;
    }
    posthog.capture("style_visibility_changed", { style_number: sku, hidden: next });
  }

  /** Where the catalog is, as filtered right now. Categories go in as slugs. */
  const catalogHref = useCallback(
    (nextSelection: CatalogSelection, nextFilters: CatalogFilters) => {
      const address = slugifyCategories({
        selection: nextSelection,
        filters: nextFilters,
      });
      return `${homePath}${buildCatalogQuery(address.selection, address.filters)}`;
    },
    [homePath],
  );

  /** Where one style is. Deliberately bare: this is the link that gets sent. */
  const productHref = useCallback(
    (sku: string, color: string | null) => productAddress(slugs.slugOf(sku), color),
    [slugs],
  );

  /** The address bar is the shareable link, so it tracks what is on screen. */
  const syncAddress = useCallback(
    (nextSelection: CatalogSelection, nextFilters: CatalogFilters) => {
      if (readOnlyAddress) return;
      router.replace(catalogHref(nextSelection, nextFilters), { scroll: false });
    },
    [catalogHref, readOnlyAddress, router],
  );

  /**
   * Opening a style is a change of address, not a navigation.
   *
   * The catalog is rendered per request and holds seven hundred styles, so
   * asking the router for /p/y-542 would rebuild the whole page to show a dialog
   * that is already in the browser. Next supports the native history API for
   * exactly this, and keeps usePathname in step with it (see "Native History
   * API" in the Next linking-and-navigating guide).
   */
  const writeAddress = useCallback(
    (address: string, entry: "push" | "replace") => {
      if (readOnlyAddress) return;
      if (entry === "push") window.history.pushState(null, "", address);
      else window.history.replaceState(null, "", address);
    },
    [readOnlyAddress],
  );

  function openStyle(product: PublicProduct, photoIndex: number) {
    const color = colorOf(product);
    showPhoto(product.sku, photoIndex);
    setOpenedSku(product.sku);
    writeAddress(productHref(product.sku, color), "push");
    posthog.capture("product_viewed", {
      style_number: product.sku,
      category: product.category,
      selected_color: color,
    });
  }

  function closeStyle() {
    setOpenedSku(null);
    // Pushed rather than replaced, so the address always describes what is on
    // screen and Back walks through the styles that were opened.
    writeAddress(catalogHref(selection, filters), "push");
  }

  /** One choice shared by the card and the open style, and it is in the link. */
  function pickColor(sku: string, color: string) {
    setColors((current) => ({ ...current, [sku]: color }));
    // Only an open style is named in the address, and changing its color is not
    // a step of its own to go back through.
    if (openedSku === sku) {
      writeAddress(productHref(sku, color), "replace");
      posthog.capture("product_color_selected", { style_number: sku, selected_color: color });
    }
  }

  // Back and forward move between the catalog and the styles that were opened
  // from it. Our own pushState never fires this, only the browser's buttons do.
  useEffect(() => {
    if (readOnlyAddress) return;

    function onPop() {
      const address = readProductAddress(window.location.pathname, window.location.search);
      const sku = address ? slugs.skuOf(address.slug) : null;
      const product = sku ? bySku.get(sku) : undefined;
      if (!product) {
        setOpenedSku(null);
        return;
      }
      const color = resolveSlug(address?.color, product.colors);
      // An address that names a color opens on a photograph of it; one that does
      // not leaves the style on the photograph it was left on.
      if (color) {
        setColors((current) => ({ ...current, [product.sku]: color }));
        showPhoto(product.sku, photoOfColor(product, color));
      }
      setOpenedSku(product.sku);
    }

    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [bySku, readOnlyAddress, showPhoto, slugs]);

  function changeFilters(next: Partial<CatalogFilters>) {
    const merged = { ...filters, ...next };
    setFilters(merged);
    syncAddress(selection, merged);
    posthog.capture("catalog_filter_changed", {
      category: merged.category ?? ALL_CATEGORIES,
      new_arrivals_only: merged.newOnly,
      page: merged.page,
    });
  }

  /**
   * Typed rather than pressed: the search narrows the grid on every keystroke,
   * so the address is written with the history API instead of through the
   * router, which would refetch a catalog that is already in this browser once
   * per letter. Same for analytics: a keystroke is not an event worth a row.
   */
  function changeQuery(value: string) {
    const merged = { ...filters, query: value || null, page: 1 };
    setFilters(merged);
    writeAddress(catalogHref(selection, merged), "replace");
  }

  function changeSelection(next: CatalogSelection) {
    setSelection(next);
    syncAddress(next, filters);
  }

  /**
   * The logo is the way back to the whole catalog: every category, every style,
   * from the first page. It is a real link, so it can be opened in a new tab and
   * so it says where it goes, but a press on it is handled here rather than let
   * through to the router: the catalog is already in this browser, and fetching
   * seven hundred styles again to clear two filters is a wait for nothing. A
   * short link renders this same catalog at an address that is not ours to
   * rewrite, and there the link is left to do its own work.
   */
  function goHome(event: { preventDefault: () => void }) {
    if (readOnlyAddress) return;
    event.preventDefault();
    setFilters(NO_FILTERS);
    syncAddress(selection, NO_FILTERS);
  }

  /**
   * The rule itself is in lib/catalog/share.ts; what the page contributes is the
   * one thing a pure function cannot know, which styles the category holds
   * right now, so ticking it can absorb the ones already ticked by hand.
   */
  function pickCategory(category: string) {
    changeSelection(
      toggleCategory(
        selection,
        category,
        products.filter((product) => product.category === category).map((p) => p.sku),
      ),
    );
  }

  function pickStyle(sku: string) {
    changeSelection(toggleStyle(selection, sku));
  }

  // What this visitor can reach: the whole catalog for the team, only what was
  // shared for a client.
  const scope = useMemo(() => {
    const reachable =
      showTools || browsingAll ? products : selectedProducts(products, selection);
    // A client's page never held a hidden style to begin with, so this only ever
    // does anything in the team's preview of the client view, which is exactly
    // where it should: the preview is a promise about what the client will see.
    return showTools ? reachable : reachable.filter((product) => !hiddenOf(product));
  }, [showTools, browsingAll, products, selection, hiddenOf]);

  // Offering a category the page cannot fill would let a client filter their own
  // selection down to nothing.
  const categories = useMemo(() => categoriesOf(scope), [scope]);
  const activeCategory =
    filters.category && categories.includes(filters.category)
      ? filters.category
      : ALL_CATEGORIES;

  const matching = useMemo(
    () =>
      filterProducts(scope, {
        category: activeCategory,
        newOnly: filters.newOnly,
        query: filters.query,
      }),
    [scope, activeCategory, filters.newOnly, filters.query],
  );

  const page = paginate(matching, filters.page);
  const visible = page.items;
  /** An empty page is a dead end when it was asked for, and a bug when it was not. */
  const filtered =
    activeCategory !== ALL_CATEGORIES || filters.newOnly || Boolean(filters.query);

  // What the link will actually open, which is what the panel promises. A
  // hidden style ticked before it was hidden is still in the selection, and
  // counting it would promise a client a style their page will not contain.
  const picked = useMemo(
    () => selectedProducts(products, selection).filter((product) => !hiddenOf(product)),
    [products, selection, hiddenOf],
  );

  return (
    <>
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        {/* One line, on a phone as much as on a laptop, and in the same order on
            both: the logo, then New, then the categories. What makes it fit on a
            390px screen is that everything after the logo is one strip that
            scrolls sideways, so the row runs out of screen instead of running
            onto a second line. Every pixel above the first photograph is one the
            catalogue does not get. */}
        <div className="mx-auto flex max-w-[1680px] items-center gap-x-3 px-4 py-3 sm:gap-x-5 sm:px-6 lg:px-10">
          <Link
            href="/"
            onClick={goHome}
            className="shrink-0"
            aria-label="itoo, back to the whole catalog"
          >
            {/* Served at its full 1050px because the image optimizer is off on
                Workers (see next.config.ts) and the file is only 15 KB: the
                browser scales it down to the 28px line, so it stays sharp on a
                retina screen at any density. */}
            <Image
              src="/logo.png"
              alt="itoo"
              width={1050}
              height={483}
              priority
              className="h-6 w-auto sm:h-7"
            />
          </Link>

          <CategoryRow
            categories={categories}
            active={activeCategory}
            onSelect={(category) =>
              changeFilters({
                category: category === ALL_CATEGORIES ? null : category,
                page: 1,
              })
            }
            selectable={showTools}
            selectedCategories={selection.categories}
            onToggleCategory={pickCategory}
            className="min-w-0 flex-1"
            /* Inside the strip rather than pinned beside the logo: it is a
               filter like the categories are, it has always sat at the head of
               them on a laptop, and a phone has no width to hold it out of the
               scroll. */
            leading={
              <>
                <NewFilterToggle
                  newOnly={filters.newOnly}
                  onToggle={() => changeFilters({ newOnly: !filters.newOnly, page: 1 })}
                />
                <div className="h-5 w-px shrink-0 bg-border" />
              </>
            }
          />

          {/* Held out of the scroll with the logo: a search box that can drift
              off screen is a search box nobody trusts. Narrow on a phone and
              wider on a laptop, and it stays a filter among filters: it narrows
              the grid keystroke by keystroke rather than opening a page. */}
          <div className="relative shrink-0">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="search"
              value={filters.query ?? ""}
              onChange={(event) => changeQuery(event.target.value)}
              placeholder="Search"
              aria-label="Search by name or style number"
              className="w-24 rounded-sm border border-border bg-transparent py-1.5 pl-8 pr-2 text-[13px] outline-none transition placeholder:text-muted-foreground focus:border-foreground sm:w-52"
            />
          </div>
        </div>
      </header>

      {!showTools && arrivedViaClientLink && (
        <div
          /* Painted in the foreground colour, so the keyboard ring on it is
             inverted rather than drawn on itself. See globals.css. */
          data-on-foreground=""
          className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-foreground px-4 py-2.5 text-center text-sm text-background"
        >
          {browsingAll ? (
            <>
              <span>Browsing the full catalog</span>
              <button
                type="button"
                onClick={() => {
                  setBrowsingAll(false);
                  changeFilters({ page: 1 });
                }}
                className="cursor-pointer underline underline-offset-4"
              >
                Back to your selection
              </button>
            </>
          ) : (
            <>
              <span>
                {page.total} {page.total === 1 ? "style" : "styles"} picked for you
              </span>
              <button
                type="button"
                onClick={() => {
                  setBrowsingAll(true);
                  changeFilters({ page: 1 });
                }}
                className="cursor-pointer underline underline-offset-4"
              >
                See everything
              </button>
            </>
          )}
        </div>
      )}

      {/* The link panel floats over the last row, so the page has to end above
          it; nobody else is given that much empty page to scroll past. */}
      <main
        className={cn(
          "mx-auto w-full max-w-[1680px] flex-1 px-4 sm:px-6 lg:px-10",
          showTools ? "pb-36" : "pb-16",
        )}
      >
        {/* The count on the left is the answer to "did that filter do
            anything": it is the first thing under the filters that just moved,
            and it changes as they do. The page number is not repeated here, the
            pagination at the foot of the grid already carries it. */}
        {/* Wrapping is for the team on a phone, where two named controls and the
            count do not share 358 pixels. A client, who has neither control,
            never sees it wrap. */}
        <div className="flex min-h-[3.25rem] flex-wrap items-center justify-between gap-x-3 gap-y-1 py-3">
          <p
            className="tracked shrink-0 whitespace-nowrap text-[11px] text-muted-foreground"
            data-style-count=""
          >
            {page.total} {page.total === 1 ? "style" : "styles"}
          </p>

          {/* One slot, the same slot in both views, so pressing it does not move
              the thing that was just pressed. */}
          {isTeam && (
            <div className="ml-auto flex shrink-0 items-center gap-1">
              {showTools && (
                /* The way into the service pages, and it has to say so: on its
                   own the word "Admin" read as one more filter. Given the same
                   type and the same icon-and-label shape as the switch beside
                   it, so the row looks assembled rather than accumulated, and
                   left as a ghost so it stays the quieter of the two. */
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/admin">
                    <SlidersHorizontal /> Admin panel
                  </Link>
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewingAsClient(!previewingAsClient)}
              >
                {showTools ? (
                  <>
                    <Eye /> Public view
                  </>
                ) : (
                  <>
                    <Undo2 /> Admin view
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {visible.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-28 text-center">
            <p className="tracked text-[11px] text-muted-foreground">Nothing here</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {filtered
                ? "No style matches these filters."
                : "This catalog has no styles in it yet."}
            </p>
            {filtered && (
              <Button
                variant="outline"
                size="sm"
                className="mt-1"
                onClick={() =>
                  changeFilters({ category: null, newOnly: false, query: null, page: 1 })
                }
              >
                Show every style
              </Button>
            )}
          </div>
        ) : (
          <div className="catalog-grid">
            {visible.map((product, index) => (
              <ProductCard
                key={product.sku}
                product={product}
                eager={index < 6}
                selectable={showTools}
                selected={isSelected(product, selection)}
                // Its category was ticked, so this box is shown ticked and is
                // not pressable: see toggleCategory in lib/catalog/share.ts.
                lockedByCategory={selection.categories.includes(product.category)}
                onToggleSelect={pickStyle}
                // Only the team, and only outside their preview of the client
                // view: the eye is a control over the catalog, not part of it.
                hideable={showTools}
                hidden={hiddenOf(product)}
                onToggleHidden={toggleHidden}
                color={colorOf(product)}
                onPickColor={pickColor}
                photoIndex={photoOf(product)}
                onShowPhoto={showPhoto}
                path={productHref(product.sku, colorOf(product))}
                onOpen={openStyle}
              />
            ))}
          </div>
        )}

        <PaginationBar
          page={page.page}
          pages={page.pages}
          onGo={(next) => {
            // Up first, then the page. The jump is what says the press landed,
            // and hanging it behind the new page meant that on a phone, where
            // the numbers are a screen away from the top of the grid, nothing
            // happened where the finger was until the photographs had arrived.
            //
            // A jump rather than a glide, and this is the interesting half:
            // drawing the next forty-eight cards holds the main thread for the
            // better part of a second, and a glide that has not finished by
            // then is left stranded halfway up a page whose height has just
            // changed under it. Measured on a phone-sized window: the glide
            // took two and a half seconds and went the wrong way first.
            window.scrollTo(0, 0);
            changeFilters({ page: next });
          }}
        />
      </main>

      {/* The only thing left floating over the catalogue. The team's other
          controls are on /admin, and the view switch is in the row above the
          grid, where it stays put instead of jumping into the header. */}
      {showTools && !isEmptySelection(selection) && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-3 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:justify-end sm:p-0">
          <LinkPanel
            // A different selection is a different link: remounting drops the
            // one made for the previous selection rather than resetting it.
            key={`${selection.categories.join()}|${selection.skus.join()}`}
            selection={selection}
            productCount={picked.length}
            onClear={() => changeSelection({ categories: [], skus: [] })}
          />
        </div>
      )}

      {openedProduct && (
        <ProductDialog
          key={openedProduct.sku}
          product={openedProduct}
          photoIndex={photoOf(openedProduct)}
          onShowPhoto={showPhoto}
          color={colorOf(openedProduct)}
          onPickColor={pickColor}
          path={productHref(openedProduct.sku, colorOf(openedProduct))}
          onClose={closeStyle}
        />
      )}
    </>
  );
}

/**
 * Which photograph a style opens on. A link that names a color opens on a
 * photograph of that color, which is also the one the chat preview showed.
 */
function photoOfColor(product: PublicProduct, color: string | null): number {
  if (!color) return 0;
  const at = product.images.findIndex((image) => image.color === color);
  return at < 0 ? 0 : at;
}
