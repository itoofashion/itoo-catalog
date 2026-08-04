"use client";

import Image from "next/image";
import { useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { isNewArrival } from "@/lib/catalog/arrivals";
import { formatColorName, swatchFor } from "@/lib/catalog/color";
import { formatPrice } from "@/lib/catalog/pricing";
import type { Product } from "@/lib/catalog/types";
import { CopyOrderButton } from "./copy-order-button";

type ProductCardProps = {
  product: Product;
  now: Date;
  /** Admin view adds the pick-for-client control; client view never shows it. */
  selectable: boolean;
  selected: boolean;
  onToggleSelect: (sku: string) => void;
  onOpen: (product: Product, photoIndex: number) => void;
};

export function ProductCard({
  product,
  now,
  selectable,
  selected,
  onToggleSelect,
  onOpen,
}: ProductCardProps) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [color, setColor] = useState<string | null>(product.colors[0] ?? null);

  const photos = product.images;
  const photo = photos[photoIndex];
  const isNew = isNewArrival(product.createdAt, now);

  function step(direction: number) {
    setPhotoIndex((current) => (current + direction + photos.length) % photos.length);
  }

  return (
    <article
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border bg-card transition-shadow",
        "shadow-[0_1px_2px_rgba(28,26,23,.04),0_8px_24px_rgba(28,26,23,.05)]",
        selected && "ring-2 ring-brand",
      )}
    >
      <div className="relative aspect-[3/3.8] overflow-hidden bg-muted">
        {photo ? (
          <Image
            src={photo.url}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 260px"
            className="cursor-zoom-in object-cover"
            onClick={() => onOpen(product, photoIndex)}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No photo
          </div>
        )}

        {isNew && (
          <Badge className="absolute left-3 top-3 bg-background/90 text-brand shadow-sm">
            New
          </Badge>
        )}

        {selectable && (
          <button
            type="button"
            aria-label={selected ? `Remove ${product.sku} from selection` : `Add ${product.sku} to selection`}
            aria-pressed={selected}
            onClick={() => onToggleSelect(product.sku)}
            className={cn(
              "absolute right-3 top-3 flex size-7 items-center justify-center rounded-full border-2 border-white/90 text-white transition",
              selected ? "bg-brand" : "bg-black/20 hover:bg-black/40",
            )}
          >
            {selected && <Check className="size-4" strokeWidth={3} />}
          </button>
        )}

        {photos.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              onClick={() => step(-1)}
              className="absolute left-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 opacity-0 shadow transition group-hover:opacity-100 focus-visible:opacity-100"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={() => step(1)}
              className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 opacity-0 shadow transition group-hover:opacity-100 focus-visible:opacity-100"
            >
              <ChevronRight className="size-4" />
            </button>
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
              {photos.map((image, index) => (
                <span
                  key={image.url}
                  className={cn(
                    "size-1.5 rounded-full bg-white/60 transition",
                    index === photoIndex && "scale-125 bg-white",
                  )}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-sm font-semibold leading-snug">{product.name}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{product.sku}</p>

        <p className="mt-2 text-base font-bold">
          {formatPrice(product.price)}
          <span className="ml-1 text-xs font-normal text-muted-foreground">/ unit</span>
        </p>

        {product.colors.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {product.colors.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setColor(option)}
                aria-pressed={option === color}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border bg-secondary/60 py-1 pl-1 pr-2.5 text-[11px] transition",
                  option === color ? "ring-2 ring-foreground" : "hover:border-foreground/30",
                )}
              >
                <span
                  className="size-3.5 rounded-full ring-1 ring-border"
                  style={{ background: swatchFor(option) }}
                />
                {formatColorName(option)}
              </button>
            ))}
          </div>
        )}

        <div className="mt-auto pt-3">
          <CopyOrderButton product={product} color={color} />
        </div>
      </div>
    </article>
  );
}
