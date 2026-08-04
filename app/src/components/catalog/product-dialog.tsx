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
import { packSummary } from "@/lib/catalog/pack";
import { formatPrice } from "@/lib/catalog/pricing";
import type { PublicProduct } from "@/lib/catalog/public";
import { CopyOrderButton } from "./copy-order-button";

/**
 * Rendered only while a product is open, and keyed by that product, so opening
 * another style mounts a fresh dialog rather than syncing state in an effect.
 *
 * The grid crops photos to a common shape to keep the rows tidy; this is where
 * the whole garment has to be visible, so the photo is fitted rather than
 * cropped and the letterboxing sits on a dark ground.
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
  const pack = packSummary(product);
  const step = (direction: number) =>
    setPhotoIndex((current) => (current + direction + photos.length) % photos.length);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl overflow-hidden p-0 sm:max-w-5xl">
        <div className="grid max-h-[90vh] gap-0 overflow-y-auto sm:grid-cols-[1.15fr_1fr] sm:overflow-visible">
          <div className="relative aspect-[3/4] bg-[oklch(0.24_0.008_70)] sm:aspect-auto sm:min-h-[34rem]">
            {photos[photoIndex] && (
              <Image
                src={photos[photoIndex].url}
                alt={product.name}
                fill
                sizes="(max-width: 640px) 100vw, 620px"
                className="object-contain"
                priority
              />
            )}
            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Previous photo"
                  onClick={() => step(-1)}
                  className="absolute left-4 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 shadow"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <button
                  type="button"
                  aria-label="Next photo"
                  onClick={() => step(1)}
                  className="absolute right-4 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 shadow"
                >
                  <ChevronRight className="size-5" />
                </button>
                <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-1.5 text-sm text-white">
                  {photoIndex + 1} / {photos.length}
                </span>
              </>
            )}
          </div>

          <div className="flex flex-col gap-6 p-8">
            <div>
              <DialogTitle className="pr-8 text-2xl font-semibold leading-tight">
                {product.name}
              </DialogTitle>
              <DialogDescription className="mt-2 text-base">
                {product.sku} · {product.category}
              </DialogDescription>
            </div>

            <div>
              <p className="text-3xl font-bold leading-none">
                {formatPrice(product.price)}
                <span className="ml-2 text-base font-normal text-muted-foreground">
                  / unit
                </span>
              </p>
              {pack && (
                <p className="mt-3 text-base text-muted-foreground">
                  Sizes <span className="text-foreground">{pack.sizes}</span>
                  {pack.split && <span className="text-foreground"> · {pack.split}</span>}
                  {pack.minimum && ` · minimum order ${pack.minimum}`}
                </p>
              )}
            </div>

            {product.colors.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  Pick your color
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {product.colors.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setColor(option)}
                      aria-pressed={option === color}
                      className={cn(
                        "flex items-center gap-2 rounded-full border bg-secondary/50 py-2 pl-2 pr-4 text-base transition",
                        option === color
                          ? "border-foreground/70 bg-secondary"
                          : "hover:border-foreground/30",
                      )}
                    >
                      <span
                        className="size-6 rounded-full ring-1 ring-border"
                        style={{ background: swatchFor(option) }}
                      />
                      {formatColorName(option)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-auto">
              <CopyOrderButton
                product={product}
                color={color}
                size="lg"
                className="w-full"
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
