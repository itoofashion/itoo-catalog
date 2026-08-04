"use client";

import Image from "next/image";
import { useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatColorName, swatchFor } from "@/lib/catalog/color";
import { packSummary } from "@/lib/catalog/pack";
import { formatPrice } from "@/lib/catalog/pricing";
import type { PublicProduct } from "@/lib/catalog/public";
import { CopyOrderButton } from "./copy-order-button";

type ProductCardProps = {
  product: PublicProduct;
  /** Above the fold on open: its photo is what the page is judged on loading. */
  eager?: boolean;
  /** The admin view adds the pick control; a client never sees it. */
  selectable: boolean;
  selected: boolean;
  /**
   * Selected because its whole category was picked. The card cannot be
   * unpicked on its own — the link means "everything in this category".
   */
  lockedByCategory: boolean;
  onToggleSelect: (sku: string) => void;
  onOpen: (product: PublicProduct, photoIndex: number) => void;
};

export function ProductCard({
  product,
  eager = false,
  selectable,
  selected,
  lockedByCategory,
  onToggleSelect,
  onOpen,
}: ProductCardProps) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [color, setColor] = useState<string | null>(product.colors[0] ?? null);

  const photos = product.images;
  const photo = photos[photoIndex];
  const pack = packSummary(product);

  function step(direction: number) {
    setPhotoIndex((current) => (current + direction + photos.length) % photos.length);
  }

  return (
    <article
      data-sku={product.sku}
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl bg-card transition-shadow",
        "shadow-[0_1px_2px_rgba(28,26,23,.04),0_10px_30px_rgba(28,26,23,.06)]",
        selected && "ring-2 ring-brand ring-offset-2 ring-offset-background",
      )}
    >
      <div className="relative aspect-[3/3.8] overflow-hidden bg-muted">
        {photo ? (
          <Image
            src={photo.url}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="cursor-zoom-in object-cover"
            priority={eager}
            onClick={() => onOpen(product, photoIndex)}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            No photo
          </div>
        )}

        {product.isNew && (
          <span
            data-badge="new"
            className="absolute left-4 top-4 rounded-full bg-background/95 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand shadow-sm"
          >
            New
          </span>
        )}

        {selectable && (
          <button
            type="button"
            disabled={lockedByCategory}
            aria-label={
              lockedByCategory
                ? `${product.sku} is included through its category`
                : selected
                  ? `Remove ${product.sku} from selection`
                  : `Add ${product.sku} to selection`
            }
            aria-pressed={selected}
            title={
              lockedByCategory
                ? `Included because all of ${product.category} is selected`
                : undefined
            }
            onClick={() => onToggleSelect(product.sku)}
            className={cn(
              "absolute right-4 top-4 flex size-9 items-center justify-center rounded-full border-2 border-white/90 text-white shadow-sm transition",
              selected ? "bg-brand" : "bg-black/25 hover:bg-black/45",
              lockedByCategory && "cursor-default opacity-90",
            )}
          >
            {selected && <Check className="size-5" strokeWidth={3} />}
          </button>
        )}

        {photos.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              onClick={() => step(-1)}
              className="absolute left-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 opacity-0 shadow transition group-hover:opacity-100 focus-visible:opacity-100"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={() => step(1)}
              className="absolute right-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 opacity-0 shadow transition group-hover:opacity-100 focus-visible:opacity-100"
            >
              <ChevronRight className="size-5" />
            </button>
            <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
              {photos.map((image, index) => (
                <span
                  key={image.url}
                  className={cn(
                    "size-2 rounded-full bg-white/60 transition",
                    index === photoIndex && "scale-125 bg-white",
                  )}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-4 p-6">
        <div>
          <h3 className="text-lg font-semibold leading-snug">{product.name}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{product.sku}</p>
        </div>

        <div>
          <p className="text-2xl font-bold leading-none">
            {formatPrice(product.price)}
            <span className="ml-2 text-sm font-normal text-muted-foreground">/ unit</span>
          </p>
          {pack && (
            <p className="mt-2 text-sm text-muted-foreground">
              <span className="text-foreground">{pack.sizes}</span>
              {[pack.split, pack.minimum].filter(Boolean).map((part) => ` · ${part}`)}
            </p>
          )}
        </div>

        {product.colors.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {product.colors.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setColor(option)}
                aria-pressed={option === color}
                className={cn(
                  "flex items-center gap-2 rounded-full border bg-secondary/50 py-1.5 pl-1.5 pr-3.5 text-sm transition",
                  option === color
                    ? "border-foreground/70 bg-secondary"
                    : "hover:border-foreground/30",
                )}
              >
                <span
                  className="size-5 rounded-full ring-1 ring-border"
                  style={{ background: swatchFor(option) }}
                />
                {formatColorName(option)}
              </button>
            ))}
          </div>
        )}

        <div className="mt-auto">
          <CopyOrderButton product={product} color={color} className="w-full" />
        </div>
      </div>
    </article>
  );
}
