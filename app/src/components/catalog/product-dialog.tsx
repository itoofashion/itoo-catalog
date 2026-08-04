"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
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
import { usePhotoStrip } from "./photo-strip";

/**
 * Rendered only while a product is open, and keyed by that product, so opening
 * another style mounts a fresh dialog rather than syncing state in an effect.
 *
 * The gallery is the same scroll-snap strip the cards use, so a photo is swiped
 * here exactly as it is out on the grid, with a rail of thumbnails beside it in
 * the shape buyers already know from marketplaces. The frame is bounded and the
 * photo is fitted whole inside it: the photographs arrive in two different
 * proportions, and letting each one set the height of the dialog was what left
 * half a screen of nothing beside the shorter ones.
 *
 * The column beside the photo is a line sheet. Price, size run, minimum and
 * colors are the four things a wholesale buyer checks before they order, and
 * setting them as ruled rows that stretch is what turns the leftover height
 * into a spec sheet instead of a hole above a button.
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
  const [color, setColor] = useState<string | null>(product.colors[0] ?? null);

  const photos = product.images;
  const {
    ref: stripRef,
    index: photoIndex,
    goTo: showPhoto,
  } = usePhotoStrip(photos.length, initialPhotoIndex);
  const rail = useRef<HTMLDivElement>(null);

  // A rail taller than the frame hides the thumbnail of the photo on screen,
  // which is the one it exists to point at.
  useEffect(() => {
    const current = rail.current?.children[photoIndex];
    current?.scrollIntoView?.({ block: "nearest" });
  }, [photoIndex]);

  const sizes = product.sizes.filter(Boolean);
  const perSize =
    product.packBreakdown && product.packBreakdown.length === sizes.length
      ? product.packBreakdown
      : null;
  const orderValue = product.minimumUnits
    ? formatPrice(Math.round(product.price * product.minimumUnits * 100) / 100)
    : null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto p-0 sm:max-w-5xl">
        <div className="grid gap-0 sm:grid-cols-[1.25fr_1fr]">
          {/* The photographs arrive at 4:5 and at 2:3; a frame close to the taller
              of the two fits either without cropping and without a visible edge. */}
          <div className="flex aspect-[3/4] gap-2 p-2 sm:aspect-auto sm:h-[min(76vh,38rem)] sm:p-3">
            {photos.length > 1 && (
              <div
                ref={rail}
                className="hidden w-16 shrink-0 flex-col gap-2 overflow-y-auto [scrollbar-width:thin] sm:flex"
              >
                {photos.map((image, index) => (
                  <button
                    key={image.url}
                    type="button"
                    onClick={() => showPhoto(index)}
                    aria-label={`Photo ${index + 1} of ${photos.length}`}
                    aria-current={index === photoIndex ? "true" : undefined}
                    className={cn(
                      "relative aspect-[3/4] shrink-0 cursor-pointer overflow-hidden border transition",
                      index === photoIndex
                        ? "border-foreground"
                        : "border-transparent opacity-60 hover:opacity-100",
                    )}
                  >
                    <Image src={image.url} alt="" fill sizes="4rem" className="object-cover" />
                  </button>
                ))}
              </div>
            )}

            <div className="relative min-w-0 flex-1">
              <div ref={stripRef} className="photo-strip absolute inset-0">
                {photos.map((image, index) => (
                  <div key={image.url} className="relative h-full">
                    <Image
                      src={image.url}
                      alt={index === 0 ? product.name : ""}
                      fill
                      sizes="(max-width: 640px) 100vw, 560px"
                      priority={index === initialPhotoIndex}
                      className="object-contain"
                    />
                  </div>
                ))}
              </div>

              {photos.length > 1 && (
                <>
                  {photoIndex > 0 && (
                    <button
                      type="button"
                      aria-label="Previous photo"
                      onClick={() => showPhoto(photoIndex - 1)}
                      className="absolute left-2 top-1/2 hidden size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-background/90 shadow sm:flex"
                    >
                      <ChevronLeft className="size-4" />
                    </button>
                  )}
                  {photoIndex < photos.length - 1 && (
                    <button
                      type="button"
                      aria-label="Next photo"
                      onClick={() => showPhoto(photoIndex + 1)}
                      className="absolute right-2 top-1/2 hidden size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-background/90 shadow sm:flex"
                    >
                      <ChevronRight className="size-4" />
                    </button>
                  )}
                  <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-sm bg-black/55 px-2.5 py-0.5 text-xs text-white sm:hidden">
                    {photoIndex + 1} / {photos.length}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* The spec sheet is also the preview for the copy button below it:
              every fact printed here is a line of what lands on the clipboard. */}
          <div className="copy-source flex flex-col border-t p-6 sm:border-t-0 sm:border-l sm:p-7">
            <div className="copy-facts flex flex-col sm:flex-1">
              <div>
                {product.isNew && (
                  <span className="tracked mb-3 inline-block bg-brand px-2.5 py-1 text-[10px] font-semibold text-brand-foreground">
                    New
                  </span>
                )}
                <DialogTitle className="pr-8 text-xl font-semibold leading-snug">
                  {product.name}
                </DialogTitle>
                <DialogDescription className="mt-1.5 text-sm">
                  {product.sku} · {product.category}
                </DialogDescription>
              </div>

              <p className="mt-5 flex items-baseline gap-2">
                <span className="text-[2rem] font-bold leading-none">
                  {formatPrice(product.price)}
                </span>
                <span className="text-sm text-muted-foreground">per unit</span>
              </p>

              <dl className="spec-sheet mt-6 sm:flex-1">
                {sizes.length > 0 && (
                  <div className="flex flex-col justify-center gap-2 border-t py-3">
                    <dt className="tracked text-[10px] text-muted-foreground">
                      {perSize ? "Size run" : "Sizes"}
                    </dt>
                    <dd className="flex flex-wrap gap-1.5">
                      {sizes.map((size, index) => (
                        <span
                          key={size}
                          className="min-w-11 border border-border px-2 py-1 text-center"
                        >
                          <span className="tracked block text-[10px] text-muted-foreground">
                            {size}
                          </span>
                          {perSize && (
                            <span className="block text-sm font-semibold">{perSize[index]}</span>
                          )}
                        </span>
                      ))}
                    </dd>
                  </div>
                )}

                {product.minimumUnits ? (
                  <div className="flex items-center justify-between gap-4 border-t py-3">
                    <dt className="tracked text-[10px] text-muted-foreground">Minimum order</dt>
                    <dd className="text-sm font-semibold">{product.minimumUnits} pcs</dd>
                  </div>
                ) : null}

                {/* The sum a buyer would otherwise reach for a calculator to get. */}
                {orderValue && (
                  <div className="flex items-center justify-between gap-4 border-t py-3">
                    <dt className="tracked text-[10px] text-muted-foreground">
                      That comes to
                    </dt>
                    <dd className="text-sm font-semibold">{orderValue}</dd>
                  </div>
                )}

                {product.colors.length > 0 && (
                  <div className="flex flex-col justify-center gap-2.5 border-t py-3">
                    <dt className="tracked text-[10px] text-muted-foreground">
                      {product.colors.length > 1
                        ? `Colors · ${product.colors.length}`
                        : "Color"}
                    </dt>
                    <dd className="flex flex-wrap gap-1.5">
                      {product.colors.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setColor(option)}
                          aria-pressed={option === color}
                          className={cn(
                            "flex cursor-pointer items-center gap-1.5 rounded-sm border py-1 pl-1 pr-2.5 text-xs transition",
                            option === color
                              ? "border-foreground"
                              : "border-border hover:border-foreground/40",
                          )}
                        >
                          <span
                            className="size-4 rounded-full ring-1 ring-border"
                            style={{ background: swatchFor(option) }}
                          />
                          {formatColorName(option)}
                        </button>
                      ))}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="border-t pt-5">
              <CopyOrderButton product={product} color={color} className="w-full" />
              <p className="mt-2.5 text-xs text-muted-foreground">
                Copies everything above as plain text (name, style number, color,
                size run, minimum and price), ready to paste into a chat.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
