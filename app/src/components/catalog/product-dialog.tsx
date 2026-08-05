"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { usePhotoStrip } from "./photo-strip";

/**
 * Rendered only while a product is open, and keyed by that product, so opening
 * another style mounts a fresh dialog rather than syncing state in an effect.
 *
 * The gallery is the same scroll-snap strip the cards use, so a photo is swiped
 * here exactly as it is out on the grid, with a rail of thumbnails in the shape
 * buyers already know from marketplaces: beside the photograph where there is
 * width for it, under the photograph on a phone where there is not. The rail is
 * this dialog's indicator, and the reason there are no dots here as well: it
 * says the same thing about where the gallery has got to, and says it with the
 * photographs themselves, which is also what makes it obvious that there is
 * anything to swipe through. The frame is bounded and the photo is fitted whole
 * inside it: the photographs arrive in two different proportions, and letting
 * each one set the height of the dialog was what left half a screen of nothing
 * beside the shorter ones.
 *
 * The column beside the photo is a line sheet. Price, size run, minimum and
 * colors are the four things a wholesale buyer checks before they order, and
 * setting them as ruled rows that stretch is what turns the leftover height
 * into a spec sheet instead of a hole above a button.
 */
export function ProductDialog({
  product,
  photoIndex,
  onShowPhoto,
  color,
  onPickColor,
  path,
  onClose,
}: {
  product: PublicProduct;
  /**
   * The photograph on screen, shared with the card behind the dialog: the style
   * opens on the photo the card had reached, and the card is left on the photo
   * this was closed on. See catalog-view.
   */
  photoIndex: number;
  onShowPhoto: (sku: string, index: number) => void;
  /**
   * The chosen color, shared with the card behind the dialog: whatever is picked
   * here is what the grid shows on the way out. See catalog-view.
   */
  color: string | null;
  onPickColor: (sku: string, color: string) => void;
  /** This style's own address, which the copy button sends with the details. */
  path: string;
  onClose: () => void;
}) {
  const photos = product.images;
  // Kept still between renders: the strip hangs its scroll listener on it.
  const showPhoto = useCallback(
    (index: number) => onShowPhoto(product.sku, index),
    [onShowPhoto, product.sku],
  );
  const stripRef = usePhotoStrip(photos.length, photoIndex, showPhoto);
  const rail = useRef<HTMLDivElement>(null);
  // The photograph the style opened on, which is the one worth fetching first.
  // Held from the first render, because the reader is free to move after that
  // and a priority that follows them is a priority for everything.
  const [openedOn] = useState(photoIndex);

  // A rail longer than the frame hides the thumbnail of the photo on screen,
  // which is the one it exists to point at. Down the rail on a laptop, along it
  // on a phone, and "nearest" is what makes one line of this do both.
  useEffect(() => {
    const current = rail.current?.children[photoIndex];
    current?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [photoIndex]);

  const pack = packSummary(product);
  const sizes = pack?.sizes ?? [];
  const orderValue = product.minimumUnits
    ? formatPrice(Math.round(product.price * product.minimumUnits * 100) / 100)
    : null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto p-0 sm:max-w-5xl">
        <div className="grid gap-0 sm:grid-cols-[1.25fr_1fr]">
          {/* The photographs arrive at 4:5 and at 2:3; a frame close to the taller
              of the two fits either without cropping and without a visible edge.

              The rail comes first here and is put last on a phone by reversing
              the column: it belongs under the photograph on a narrow screen,
              where a strip along the bottom is the shape a thumb expects, and
              beside it on a laptop. Reversing rather than reordering keeps the
              rail first for the keyboard, which is the order it reads in. */}
          {/* min-w-0 because a grid column is sized by its contents unless it is
              told otherwise, and a style with eighteen photographs has a rail
              wider than the phone it is being read on. */}
          <div className="flex min-w-0 flex-col-reverse gap-2 p-2 sm:h-[min(76vh,38rem)] sm:flex-row sm:p-3">
            {/* The rail keeps the size it was given and gaps its thumbnails
                from the inside: 4px between them, and a hairline round each,
                because half of these are shot against white and without an edge
                of their own they run into one another and into the page. The
                thumbnails take their other dimension from that one, so the gap
                is spent on the scroll inside the rail, not on the frame. */}
            {photos.length > 1 && (
              <div
                ref={rail}
                className="flex h-16 w-full shrink-0 gap-1 overflow-x-auto [scrollbar-width:thin] sm:h-auto sm:w-16 sm:flex-col sm:overflow-x-hidden sm:overflow-y-auto"
              >
                {photos.map((image, index) => (
                  <button
                    key={image.url}
                    type="button"
                    onClick={() => showPhoto(index)}
                    aria-label={`Photo ${index + 1} of ${photos.length}`}
                    aria-current={index === photoIndex ? "true" : undefined}
                    className={cn(
                      "relative aspect-[3/4] h-full shrink-0 cursor-pointer overflow-hidden border transition sm:h-auto sm:w-full",
                      index === photoIndex
                        ? "border-foreground"
                        : "border-border opacity-60 hover:opacity-100",
                    )}
                  >
                    <Image src={image.url} alt="" fill sizes="4rem" className="object-cover" />
                  </button>
                ))}
              </div>
            )}

            <div className="relative aspect-[3/4] min-w-0 sm:aspect-auto sm:flex-1">
              <div ref={stripRef} className="photo-strip absolute inset-0">
                {photos.map((image, index) => (
                  <div key={image.url} className="relative h-full">
                    <Image
                      src={image.url}
                      alt={index === 0 ? product.name : ""}
                      fill
                      sizes="(max-width: 640px) 100vw, 560px"
                      priority={index === openedOn}
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
                      {pack?.perSize ? "Size run" : "Sizes"}
                    </dt>
                    {/* The same pairing the card prints as "S ×2 · M ×2 · L ×2",
                        with room here to stack the count under its size. */}
                    <dd className="flex flex-wrap gap-1.5">
                      {sizes.map((size) => (
                        <span
                          key={size.label}
                          className="min-w-11 border border-border px-2 py-1 text-center"
                        >
                          <span className="tracked block text-[10px] text-muted-foreground">
                            {size.label}
                          </span>
                          {size.units !== null && (
                            <span className="block text-sm font-semibold">{size.units}</span>
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
                          onClick={() => onPickColor(product.sku, option)}
                          aria-pressed={option === color}
                          data-swatch=""
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
              <CopyOrderButton
                product={product}
                color={color}
                path={path}
                className="w-full"
              />
              <p className="mt-2.5 text-xs text-muted-foreground">
                Copies everything above as plain text (name, style number, color,
                size run, minimum and price) with a link to this style, ready to
                paste into a chat.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
