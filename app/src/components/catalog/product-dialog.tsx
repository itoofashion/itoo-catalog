"use client";

import Image from "next/image";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatColorName, swatchFor } from "@/lib/catalog/color";
import { formatPrice } from "@/lib/catalog/pricing";
import type { PublicProduct } from "@/lib/catalog/public";
import { CopyOrderButton } from "./copy-order-button";

/**
 * Rendered only while a product is open, and keyed by that product, so opening
 * another style mounts a fresh dialog rather than syncing state in an effect.
 */
export function ProductDialog({
  product,
  initialPhotoIndex,
  onClose,
}: {
  product: PublicProduct;
  initialPhotoIndex: number;
  onClose: () => void;
}) {
  const [photoIndex, setPhotoIndex] = useState(initialPhotoIndex);
  const [color, setColor] = useState<string | null>(product.colors[0] ?? null);

  const photos = product.images;
  const step = (direction: number) =>
    setPhotoIndex((current) => (current + direction + photos.length) % photos.length);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl overflow-hidden p-0 sm:max-w-3xl">
        <div className="grid gap-0 sm:grid-cols-[1.2fr_1fr]">
          <div className="relative aspect-[3/3.8] bg-muted sm:aspect-auto sm:min-h-[28rem]">
            {photos[photoIndex] && (
              <Image
                src={photos[photoIndex].url}
                alt={product.name}
                fill
                sizes="(max-width: 640px) 100vw, 480px"
                className="object-cover"
                priority
              />
            )}
            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Previous photo"
                  onClick={() => step(-1)}
                  className="absolute left-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 shadow"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Next photo"
                  onClick={() => step(1)}
                  className="absolute right-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 shadow"
                >
                  <ChevronRight className="size-4" />
                </button>
                <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-xs text-white">
                  {photoIndex + 1} / {photos.length}
                </span>
              </>
            )}
          </div>

          <div className="flex flex-col p-6">
            <DialogTitle className="pr-6 text-xl font-semibold">
              {product.name}
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm">
              {product.sku} · {product.category}
            </DialogDescription>

            <p className="mt-4 text-2xl font-bold">
              {formatPrice(product.price)}
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                / unit
              </span>
            </p>

            {product.colors.length > 0 && (
              <>
                <p className="mt-6 text-[11px] uppercase tracking-widest text-muted-foreground">
                  Pick your color
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {product.colors.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setColor(option)}
                      aria-pressed={option === color}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border bg-secondary/60 py-1 pl-1 pr-2.5 text-xs transition",
                        option === color
                          ? "ring-2 ring-foreground"
                          : "hover:border-foreground/30",
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
              </>
            )}

            <div className="mt-auto pt-6">
              <CopyOrderButton product={product} color={color} className="w-full" />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
