"use client";

import { useCallback, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Eye, Undo2 } from "lucide-react";
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
  toggleCategory,
  toggleStyle,
  type CatalogFilters,
  type CatalogSelection,
} from "@/lib/catalog/share";
import { paginate } from "@/lib/catalog/pagination";
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
};

export function CatalogView({
  products,
  selection: initialSelection,
  filters: initialFilters,
  isTeam,
  readOnlyAddress = false,
}: CatalogViewProps) {
  const router = useRouter();
  const pathname = usePathname();

  // A link that carries a selection is a client link: it opens as the client
  // sees it, with none of the team's controls.
  const arrivedViaClientLink = !isEmptySelection(initialSelection);

  const [selection, setSelection] = useState(initialSelection);
  const [filters, setFilters] = useState(initialFilters);
  // Opening one's own client link lands in the client's view, which is the point
  // of the link; the way back is a button, since this visitor is still the team.
  const [previewingAsClient, setPreviewingAsClient] = useState(arrivedViaClientLink);
  /**
   * A shared link is a shortcut through seven hundred items, not a wall around
   * them: the client can step out of the selection and browse everything, and
   * step back into what was picked for them.
   */
  const [browsingAll, setBrowsingAll] = useState(false);
  const [opened, setOpened] = useState<{ product: PublicProduct; photoIndex: number } | null>(
    null,
  );

  const showTools = isTeam && !previewingAsClient;

  /** The address bar is the shareable link, so it tracks what is on screen. */
  const syncAddress = useCallback(
    (nextSelection: CatalogSelection, nextFilters: CatalogFilters) => {
      if (readOnlyAddress) return;
      router.replace(`${pathname}${buildCatalogQuery(nextSelection, nextFilters)}`, {
        scroll: false,
      });
    },
    [pathname, readOnlyAddress, router],
  );

  function changeFilters(next: Partial<CatalogFilters>) {
    const merged = { ...filters, ...next };
    setFilters(merged);
    syncAddress(selection, merged);
  }

  function changeSelection(next: CatalogSelection) {
    setSelection(next);
    syncAddress(next, filters);
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
  const scope = useMemo(
    () =>
      showTools || browsingAll ? products : selectedProducts(products, selection),
    [showTools, browsingAll, products, selection],
  );

  // Offering a category the page cannot fill would let a client filter their own
  // selection down to nothing.
  const categories = useMemo(() => categoriesOf(scope), [scope]);
  const activeCategory =
    filters.category && categories.includes(filters.category)
      ? filters.category
      : ALL_CATEGORIES;

  const matching = useMemo(
    () => filterProducts(scope, { category: activeCategory, newOnly: filters.newOnly }),
    [scope, activeCategory, filters.newOnly],
  );

  const page = paginate(matching, filters.page);
  const visible = page.items;
  /** An empty page is a dead end when it was asked for, and a bug when it was not. */
  const filtered = activeCategory !== ALL_CATEGORIES || filters.newOnly;

  const picked = useMemo(
    () => selectedProducts(products, selection),
    [products, selection],
  );

  return (
    <>
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        {/* One wrapping row that reads as two on a phone: the logo and New sit
            on the first line, the categories drop onto the second and scroll
            sideways. On a laptop nothing wraps and it is a single line, which is
            where the filters have always been: every pixel above the first
            photograph is one the catalogue does not get. */}
        <div className="mx-auto flex max-w-[1680px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:flex-nowrap sm:gap-x-5 sm:px-6 lg:px-10">
          <Link href="/" className="shrink-0" aria-label="itoo, back to the catalog">
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

          <NewFilterToggle
            newOnly={filters.newOnly}
            onToggle={() => changeFilters({ newOnly: !filters.newOnly, page: 1 })}
            className="ml-auto sm:ml-0"
          />

          <div className="hidden h-5 w-px shrink-0 bg-border sm:block" />

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
            className="w-full sm:w-auto sm:flex-1"
          />
        </div>
      </header>

      {!showTools && arrivedViaClientLink && (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-foreground px-4 py-2.5 text-center text-sm text-background">
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
                {page.total} {page.total === 1 ? "item" : "items"} picked for you
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
        <div className="flex min-h-[3.25rem] items-center justify-between gap-3 py-3">
          <p className="tracked text-[11px] text-muted-foreground" data-style-count="">
            {page.total} {page.total === 1 ? "style" : "styles"}
          </p>

          {/* One slot, the same slot in both views, so pressing it does not move
              the thing that was just pressed. */}
          {isTeam && (
            <div className="flex shrink-0 items-center gap-1">
              {showTools && (
                <Link
                  href="/admin"
                  className="tracked px-2 text-[11px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Admin
                </Link>
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
                onClick={() => changeFilters({ category: null, newOnly: false, page: 1 })}
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
                onOpen={(item, photoIndex) => setOpened({ product: item, photoIndex })}
              />
            ))}
          </div>
        )}

        <PaginationBar
          page={page.page}
          pages={page.pages}
          onGo={(next) => {
            changeFilters({ page: next });
            window.scrollTo({ top: 0, behavior: "smooth" });
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

      {opened && (
        <ProductDialog
          key={opened.product.sku}
          product={opened.product}
          initialPhotoIndex={opened.photoIndex}
          onClose={() => setOpened(null)}
        />
      )}
    </>
  );
}
