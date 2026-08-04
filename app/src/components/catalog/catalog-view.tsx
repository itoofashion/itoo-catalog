"use client";

import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { categoriesOf, filterProducts } from "@/lib/catalog/filter";
import type { PublicProduct } from "@/lib/catalog/public";
import { ALL_CATEGORIES, buildShareQuery, type CatalogSelection } from "@/lib/catalog/share";
import { ProductCard } from "./product-card";
import { ProductDialog } from "./product-dialog";
import { AdminBar } from "./admin-bar";
import { ShareTray } from "./share-tray";

export type CatalogViewProps = {
  products: PublicProduct[];
  syncedAt: string;
  /** What the link that opened this page asked for. */
  selection: CatalogSelection;
};

export function CatalogView({ products, syncedAt, selection }: CatalogViewProps) {
  // A link that carries items or a category is a client link: it opens in the
  // client view, showing exactly what was shared and none of the controls.
  const arrivedViaClientLink = selection.skus.length > 0 || selection.category !== null;

  const [isAdmin, setIsAdmin] = useState(!arrivedViaClientLink);
  const [category, setCategory] = useState(selection.category ?? ALL_CATEGORIES);
  const [newOnly, setNewOnly] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set(selection.skus));
  const [opened, setOpened] = useState<{ product: PublicProduct; photoIndex: number } | null>(
    null,
  );

  // What this visitor can reach at all. In the admin view that is the whole
  // catalog — picking items must not make them disappear from the grid you are
  // picking from. A client following a shared link can only reach what was
  // shared with them.
  const scope = useMemo(
    () => (isAdmin ? products : filterProducts(products, { skus: [...picked], category: null })),
    [products, isAdmin, picked],
  );

  // Categories come from what is reachable, so a client is never offered a
  // filter that would empty the page.
  const categories = useMemo(() => categoriesOf(scope), [scope]);

  // A category chosen before the view changed may not exist in the new scope;
  // falling back to All is better than showing an empty page.
  const activeCategory = categories.includes(category) ? category : ALL_CATEGORIES;

  const visible = useMemo(
    () => filterProducts(scope, { skus: [], category: activeCategory, newOnly }),
    [scope, activeCategory, newOnly],
  );

  function togglePicked(sku: string) {
    setPicked((current) => {
      const next = new Set(current);
      if (!next.delete(sku)) next.add(sku);
      return next;
    });
  }

  const shareQuery = buildShareQuery({ skus: [...picked], category: activeCategory });

  return (
    <>
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-5 px-6 py-3.5">
          <span className="text-lg font-bold tracking-[0.35em]">itoo</span>
          <span className="hidden border-l pl-4 text-xs text-muted-foreground sm:block">
            Wholesale · New arrivals weekly
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant={isAdmin ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setIsAdmin((value) => !value)}
            >
              {isAdmin ? "Admin view" : "Client view"}
            </Button>
          </div>
        </div>
      </header>

      {isAdmin && <AdminBar syncedAt={syncedAt} productCount={products.length} />}

      {!isAdmin && arrivedViaClientLink && (
        <div className="bg-foreground px-4 py-2 text-center text-xs text-background">
          Shared selection — {visible.length} item{visible.length === 1 ? "" : "s"} picked for you
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 pb-24">
        <div className="flex flex-wrap items-center gap-2 py-5">
          {categories.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setCategory(name)}
              aria-pressed={name === activeCategory}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm transition",
                name === activeCategory
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground",
              )}
            >
              {name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setNewOnly((value) => !value)}
            aria-pressed={newOnly}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm transition",
              newOnly
                ? "border-brand bg-brand text-brand-foreground"
                : "bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground",
            )}
          >
            <Sparkles className="size-3.5" /> New arrivals
          </button>
          <span className="ml-auto text-xs text-muted-foreground">
            {visible.length} style{visible.length === 1 ? "" : "s"}
          </span>
        </div>

        {visible.length === 0 ? (
          <p className="py-24 text-center text-sm text-muted-foreground">
            Nothing to show here yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
            {visible.map((product) => (
              <ProductCard
                key={product.sku}
                product={product}
                selectable={isAdmin}
                selected={picked.has(product.sku)}
                onToggleSelect={togglePicked}
                onOpen={(item, photoIndex) => setOpened({ product: item, photoIndex })}
              />
            ))}
          </div>
        )}
      </main>

      {isAdmin && picked.size > 0 && (
        <ShareTray
          count={picked.size}
          shareQuery={shareQuery}
          onPreview={() => setIsAdmin(false)}
          onClear={() => setPicked(new Set())}
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
