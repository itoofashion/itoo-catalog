"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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
  type CatalogFilters,
  type CatalogSelection,
} from "@/lib/catalog/share";
import { paginate } from "@/lib/catalog/pagination";
import { CategoryFilters } from "./category-filters";
import { LinkPanel } from "./link-panel";
import { PaginationBar } from "./pagination-bar";
import { ProductCard } from "./product-card";
import { ProductDialog } from "./product-dialog";
import { StatusBar } from "./status-bar";

export type CatalogViewProps = {
  products: PublicProduct[];
  syncedAt: string;
  /** What the address asked for when the page opened. */
  selection: CatalogSelection;
  filters: CatalogFilters;
  /**
   * Whether this visitor signed in as the team. Decided on the server from the
   * session cookie, because a component cannot be trusted to decide it — see
   * lib/admin/auth.ts.
   */
  isTeam: boolean;
  /** Short links render the same page under /s/<code>; the address stays put. */
  readOnlyAddress?: boolean;
};

export function CatalogView({
  products,
  syncedAt,
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

  function toggleCategory(category: string) {
    const categories = selection.categories.includes(category)
      ? selection.categories.filter((name) => name !== category)
      : [...selection.categories, category];
    changeSelection({ ...selection, categories });
  }

  function toggleStyle(sku: string) {
    const skus = selection.skus.includes(sku)
      ? selection.skus.filter((value) => value !== sku)
      : [...selection.skus, sku];
    changeSelection({ ...selection, skus });
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
        <div className="mx-auto flex max-w-[1680px] items-center gap-4 px-4 py-3 sm:gap-6 sm:px-6 lg:px-10">
          <Link href="/" className="shrink-0 text-xl font-bold tracking-[0.3em]">
            itoo
          </Link>

          {/* The filters live in the header rather than under it: the row was
              empty, and every pixel above the first photograph is one the
              catalogue does not get. */}
          <div className="min-w-0 flex-1">
            <CategoryFilters
              categories={categories}
              active={activeCategory}
              onSelect={(category) =>
                changeFilters({
                  category: category === ALL_CATEGORIES ? null : category,
                  page: 1,
                })
              }
              newOnly={filters.newOnly}
              onToggleNew={() => changeFilters({ newOnly: !filters.newOnly, page: 1 })}
              selectable={showTools}
              selectedCategories={selection.categories}
              onToggleCategory={toggleCategory}
            />
          </div>

          {isTeam && previewingAsClient && (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => setPreviewingAsClient(false)}
            >
              <ArrowLeft /> Back
            </Button>
          )}
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

      {/* The team's controls float over the last row, so the page has to end
          above them; nobody else is given that much empty page to scroll past. */}
      <main
        className={cn(
          "mx-auto w-full max-w-[1680px] flex-1 px-4 sm:px-6 lg:px-10",
          showTools ? "pb-44" : "pb-16",
        )}
      >
        <p className="tracked py-4 text-right text-[11px] text-muted-foreground">
          {page.total} {page.total === 1 ? "item" : "items"}
          {page.pages > 1 && (
            <span className="ml-2">
              · page {page.page} of {page.pages}
            </span>
          )}
        </p>

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
                lockedByCategory={selection.categories.includes(product.category)}
                onToggleSelect={toggleStyle}
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

      {/* Stacked in one column so the link panel never covers the status bar,
          which is what happened when both were pinned to a corner. */}
      {showTools && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex flex-col items-stretch gap-2 p-3 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:items-end sm:p-0">
          <StatusBar
            productCount={products.length}
            syncedAt={syncedAt}
            onPreview={() => setPreviewingAsClient(true)}
          />

          {!isEmptySelection(selection) && (
                <LinkPanel
              // A different selection is a different link: remounting drops the
              // one made for the previous selection rather than resetting it.
              key={`${selection.categories.join()}|${selection.skus.join()}`}
              selection={selection}
              productCount={picked.length}
              onClear={() => changeSelection({ categories: [], skus: [] })}
            />
          )}
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
