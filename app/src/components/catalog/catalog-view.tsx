"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { CategoryFilters } from "./category-filters";
import { LinkPanel } from "./link-panel";
import { ProductCard } from "./product-card";
import { ProductDialog } from "./product-dialog";
import { StatusBar } from "./status-bar";

export type CatalogViewProps = {
  products: PublicProduct[];
  syncedAt: string;
  /** What the address asked for when the page opened. */
  selection: CatalogSelection;
  filters: CatalogFilters;
  /** Short links render the same page under /s/<code>; the address stays put. */
  readOnlyAddress?: boolean;
};

/**
 * Survives following a link, which a piece of component state would not: the
 * team member who assembled a link and then opened it is still the team member,
 * and needs a way back. Someone meeting the link for the first time is a client
 * and gets nothing.
 */
const ADMIN_SEEN_FLAG = "itoo.admin";

/** The flag only changes through this component, so there is nothing to watch. */
function subscribeToNothing() {
  return () => {};
}

export function CatalogView({
  products,
  syncedAt,
  selection: initialSelection,
  filters: initialFilters,
  readOnlyAddress = false,
}: CatalogViewProps) {
  const router = useRouter();
  const pathname = usePathname();

  // A link that carries a selection is a client link: it opens as the client
  // sees it, with none of the team's controls.
  const arrivedViaClientLink = !isEmptySelection(initialSelection);

  const [selection, setSelection] = useState(initialSelection);
  const [filters, setFilters] = useState(initialFilters);
  const [isAdmin, setIsAdmin] = useState(!arrivedViaClientLink);
  const [opened, setOpened] = useState<{ product: PublicProduct; photoIndex: number } | null>(
    null,
  );

  // Read rather than mirrored into state: the server has no session storage, so
  // the first render must agree with it and the value can only arrive after.
  const cameFromAdmin = useSyncExternalStore(
    subscribeToNothing,
    () => sessionStorage.getItem(ADMIN_SEEN_FLAG) === "1",
    () => false,
  );

  useEffect(() => {
    if (isAdmin) sessionStorage.setItem(ADMIN_SEEN_FLAG, "1");
  }, [isAdmin]);

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

  function previewAsClient() {
    setIsAdmin(false);
  }

  function backToAdmin() {
    setIsAdmin(true);
  }

  // What this visitor can reach: the whole catalog for the team, only what was
  // shared for a client.
  const scope = useMemo(
    () => (isAdmin ? products : selectedProducts(products, selection)),
    [isAdmin, products, selection],
  );

  // Offering a category the page cannot fill would let a client filter their own
  // selection down to nothing.
  const categories = useMemo(() => categoriesOf(scope), [scope]);
  const activeCategory =
    filters.category && categories.includes(filters.category)
      ? filters.category
      : ALL_CATEGORIES;

  const visible = useMemo(
    () => filterProducts(scope, { category: activeCategory, newOnly: filters.newOnly }),
    [scope, activeCategory, filters.newOnly],
  );

  const picked = useMemo(
    () => selectedProducts(products, selection),
    [products, selection],
  );

  return (
    <>
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1680px] items-center gap-6 px-6 py-5 lg:px-10">
          <span className="text-2xl font-bold tracking-[0.3em]">itoo</span>
          {!isAdmin && cameFromAdmin && (
            <Button variant="outline" size="sm" className="ml-auto" onClick={backToAdmin}>
              <ArrowLeft /> Back to admin
            </Button>
          )}
        </div>
      </header>

      {!isAdmin && arrivedViaClientLink && (
        <p className="bg-foreground px-4 py-3 text-center text-sm text-background">
          {visible.length} {visible.length === 1 ? "style" : "styles"} picked for you
        </p>
      )}

      <main className="mx-auto w-full max-w-[1680px] flex-1 px-6 pb-40 lg:px-10">
        <div className="flex flex-wrap items-center gap-4 py-8">
          <CategoryFilters
            categories={categories}
            active={activeCategory}
            onSelect={(category) =>
              changeFilters({ category: category === ALL_CATEGORIES ? null : category })
            }
            newOnly={filters.newOnly}
            onToggleNew={() => changeFilters({ newOnly: !filters.newOnly })}
            selectable={isAdmin}
            selectedCategories={selection.categories}
            onToggleCategory={toggleCategory}
          />
          <span className="ml-auto text-base text-muted-foreground">
            {visible.length} {visible.length === 1 ? "style" : "styles"}
          </span>
        </div>

        {visible.length === 0 ? (
          <p className="py-32 text-center text-lg text-muted-foreground">
            Nothing to show here yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((product, index) => (
              <ProductCard
                key={product.sku}
                product={product}
                eager={index < 4}
                selectable={isAdmin}
                selected={isSelected(product, selection)}
                lockedByCategory={selection.categories.includes(product.category)}
                onToggleSelect={toggleStyle}
                onOpen={(item, photoIndex) => setOpened({ product: item, photoIndex })}
              />
            ))}
          </div>
        )}
      </main>

      {isAdmin && (
        <StatusBar
          productCount={products.length}
          syncedAt={syncedAt}
          onPreview={previewAsClient}
        />
      )}

      {isAdmin && !isEmptySelection(selection) && (
        <LinkPanel
          // A different selection is a different link: remounting drops the one
          // that was made for the previous one instead of resetting it by hand.
          key={`${selection.categories.join()}|${selection.skus.join()}`}
          selection={selection}
          productCount={picked.length}
          onClear={() => changeSelection({ categories: [], skus: [] })}
        />
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
