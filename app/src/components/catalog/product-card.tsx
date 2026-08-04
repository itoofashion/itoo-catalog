"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatColorName, swatchFor } from "@/lib/catalog/color";
import { packSummary } from "@/lib/catalog/pack";
import { formatPrice } from "@/lib/catalog/pricing";
import type { PublicImage, PublicProduct } from "@/lib/catalog/public";
import { CopyOrderButton } from "./copy-order-button";
import { DRAG_SLOP_PX, usePhotoStrip } from "./photo-strip";

type ProductCardProps = {
  product: PublicProduct;
  /** Above the fold on open: its photo is what the page is judged on loading. */
  eager?: boolean;
  /** The team's view adds the pick control; a client never sees it. */
  selectable: boolean;
  selected: boolean;
  /**
   * Selected because its whole category was picked. The card cannot be unpicked
   * on its own: the link means "everything in this category".
   */
  lockedByCategory: boolean;
  onToggleSelect: (sku: string) => void;
  onOpen: (product: PublicProduct, photoIndex: number) => void;
};

/** More than this and the row of dots stops being countable at a glance. */
const MAX_DOTS = 6;

/** Colors beyond this are summarised, so the card keeps its height. */
const MAX_SWATCHES = 5;

const PHOTO_SIZES = "(max-width: 640px) 46vw, 15rem";

export function ProductCard({
  product,
  eager = false,
  selectable,
  selected,
  lockedByCategory,
  onToggleSelect,
  onOpen,
}: ProductCardProps) {
  const [color, setColor] = useState<string | null>(product.colors[0] ?? null);

  const photos = product.images;
  const pack = packSummary(product);
  const {
    ref: stripRef,
    index: photoIndex,
    goTo: showPhoto,
  } = usePhotoStrip(photos.length);

  // A swipe across the photos ends in a click event too; only a press that
  // stayed put was meant to open the style.
  const pressedAt = useRef<{ x: number; y: number } | null>(null);
  function open(event: { clientX: number; clientY: number }, index: number) {
    const from = pressedAt.current;
    pressedAt.current = null;
    if (from && Math.hypot(event.clientX - from.x, event.clientY - from.y) > DRAG_SLOP_PX) {
      return;
    }
    onOpen(product, index);
  }

  return (
    <article data-sku={product.sku} className="group flex flex-col">
      <div className="relative aspect-[3/4] overflow-hidden bg-muted">
        {photos.length > 0 ? (
          <div
            ref={stripRef}
            className="photo-strip absolute inset-0"
            onPointerDown={(event) =>
              (pressedAt.current = { x: event.clientX, y: event.clientY })
            }
          >
            {photos.map((image, index) => (
              <PhotoFrame
                key={image.url}
                image={image}
                /* One named photo per card: the rest are the same garment, and
                   a reader does not need to hear the name five times. */
                alt={index === 0 ? product.name : ""}
                label={
                  photos.length > 1
                    ? `Open ${product.name}, photo ${index + 1} of ${photos.length}`
                    : `Open ${product.name}`
                }
                priority={eager && index === 0}
                showing={index === photoIndex}
                onOpen={(event) => open(event, index)}
              />
            ))}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No photo
          </div>
        )}

        {product.isNew && (
          <span
            data-badge="new"
            className="tracked pointer-events-none absolute left-0 top-3 bg-brand px-2.5 py-1 text-[10px] font-semibold text-brand-foreground"
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
            aria-pressed={selected || lockedByCategory}
            title={
              lockedByCategory
                ? `Included because all of ${product.category} is selected`
                : undefined
            }
            onClick={() => onToggleSelect(product.sku)}
            /* The same box as the one on a category, down to the corner: one
               control, picked in two places. It reads at 20px and is hit with a
               thumb, so the target around it is grown by a pseudo-element.

               A style held by its category shows the same tick, faded and
               unpressable. A padlock was tried here and read as a puzzle: a
               dimmed tick says "already in, not yours to take out" without
               anyone having to work out what the picture means. */
            className={cn(
              "absolute right-2.5 top-2.5 flex size-5 items-center justify-center rounded-sm border text-white shadow-sm transition before:absolute before:-inset-1.5 before:content-['']",
              selected || lockedByCategory
                ? "border-foreground bg-foreground"
                : "border-white/80 bg-black/25 hover:bg-black/45",
              lockedByCategory ? "cursor-not-allowed opacity-45" : "cursor-pointer",
            )}
          >
            {(selected || lockedByCategory) && <Check className="size-3.5" strokeWidth={3} />}
          </button>
        )}

        {photos.length > 1 && (
          <>
            {/* Where there is a pointer the arrows are the way through; where
                there is a finger the strip is swiped, so they only take up room.

                Both arrows stay in the layout the whole time and only fade,
                and both keep taking the pointer even faded: unmounting the one
                that had run out of photos made it flick away under the cursor
                and dropped that last click onto the photo, which opened a
                dialog nobody asked for. */}
            <StripArrow
              side="left"
              label="Previous photo"
              available={photoIndex > 0}
              onGo={() => showPhoto(photoIndex - 1)}
            />
            <StripArrow
              side="right"
              label="Next photo"
              available={photoIndex < photos.length - 1}
              onGo={() => showPhoto(photoIndex + 1)}
            />

            {photos.length <= MAX_DOTS ? (
              <div
                data-photo-dots=""
                className="absolute bottom-1 left-1/2 flex -translate-x-1/2"
              >
                {photos.map((image, index) => (
                  <button
                    key={image.url}
                    type="button"
                    aria-label={`Photo ${index + 1}`}
                    aria-current={index === photoIndex ? "true" : undefined}
                    onClick={() => showPhoto(index)}
                    /* The dot is 6px; the target around it is a finger wide. */
                    className="flex h-6 w-4 cursor-pointer items-center justify-center"
                  >
                    {/* Half these photographs are shot against white, so the dot
                        carries its own edge rather than trusting the backdrop. */}
                    <span
                      className={cn(
                        "size-1.5 rounded-full bg-white/70 drop-shadow-[0_0_2px_rgba(0,0,0,0.65)] transition",
                        index === photoIndex && "bg-white",
                      )}
                    />
                  </button>
                ))}
              </div>
            ) : (
              <span className="pointer-events-none absolute bottom-2.5 left-1/2 -translate-x-1/2 rounded-sm bg-black/55 px-2 py-0.5 text-[11px] text-white">
                {photoIndex + 1} / {photos.length}
              </span>
            )}
          </>
        )}
      </div>

      {/* Everything printed here is everything the copy button sends, which is
          what lets the button go without a preview of its own. */}
      <div className="copy-source flex flex-1 flex-col pt-3">
        <div className="copy-facts">
          <h3 className="line-clamp-1 text-sm font-semibold" title={product.name}>
            {product.name}
          </h3>

          <p className="mt-1.5 flex items-baseline gap-2">
            <span className="text-base font-bold">{formatPrice(product.price)}</span>
            {/* Where every size carries its own count the total is already on
                the card, in the line below, and stating it twice only invites
                the reader to check one against the other. */}
            {pack?.minimum && !pack.perSize && (
              <span className="text-xs text-muted-foreground">min {pack.minimum}</span>
            )}
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            {product.sku}
            {pack?.run && <> · {pack.run}</>}
          </p>

          {product.colors.length > 0 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {product.colors.slice(0, MAX_SWATCHES).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setColor(option)}
                  aria-pressed={option === color}
                  aria-label={formatColorName(option)}
                  title={formatColorName(option)}
                  /* Only the chosen colour goes on the clipboard, which the
                     others show by stepping back while the copy button is
                     pointed at (see [data-swatch] in globals.css). */
                  data-swatch=""
                  /* The swatch reads at 16px but has to be hit with a thumb. */
                  className={cn(
                    "relative size-4 cursor-pointer rounded-full ring-1 ring-border transition before:absolute before:-inset-1.5 before:content-['']",
                    option === color && "ring-2 ring-foreground ring-offset-1",
                  )}
                  style={{ background: swatchFor(option) }}
                />
              ))}
              {product.colors.length > MAX_SWATCHES && (
                <span className="text-xs text-muted-foreground">
                  +{product.colors.length - MAX_SWATCHES}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="mt-auto pt-3">
          <CopyOrderButton product={product} color={color} tone="card" className="w-full" />
        </div>
      </div>
    </article>
  );
}

/**
 * One step through the gallery. It is always rendered, always in the layout and
 * always the thing under the pointer at that spot; what changes is whether it
 * can be seen and pressed, which is a fade rather than an appearance.
 *
 * At the end of the strip it goes quiet but stays a shield. Someone clicking
 * their way to the last photo lands one more click after the last one, and if
 * the arrow had stepped aside that click would open the style in a dialog they
 * never asked for.
 */
function StripArrow({
  side,
  label,
  available,
  onGo,
}: {
  side: "left" | "right";
  label: string;
  /** False at the ends of the strip: there is no photo that way. */
  available: boolean;
  onGo: () => void;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      aria-label={label}
      disabled={!available}
      onClick={onGo}
      className={cn(
        "absolute top-1/2 hidden size-8 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 opacity-0 shadow-sm transition-opacity duration-200 motion-reduce:transition-none sm:flex",
        side === "left" ? "left-1.5" : "right-1.5",
        available
          ? "cursor-pointer group-hover:opacity-100 focus-visible:opacity-100"
          : "cursor-not-allowed text-muted-foreground group-hover:opacity-45",
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}

/**
 * One frame of the strip. It is a button, so the photograph can be opened from
 * the keyboard as well as the mouse, and it holds its own loading state: a grey
 * rectangle that never changes reads as a broken image, a breathing one reads as
 * a photograph on its way.
 */
function PhotoFrame({
  image,
  alt,
  label,
  priority,
  showing,
  onOpen,
}: {
  image: PublicImage;
  alt: string;
  label: string;
  priority: boolean;
  /** The frame currently scrolled into view. */
  showing: boolean;
  onOpen: (event: { clientX: number; clientY: number }) => void;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <button
      type="button"
      aria-label={label}
      /* A style is one stop on the way through the page, not eleven: only the
         photo on screen takes the tab, and the dots move between them. */
      tabIndex={showing ? undefined : -1}
      onClick={onOpen}
      className={cn(
        "relative block h-full cursor-zoom-in overflow-hidden",
        !loaded && "animate-pulse bg-muted",
      )}
    >
      <Image
        src={image.url}
        alt={alt}
        fill
        sizes={PHOTO_SIZES}
        priority={priority}
        className="object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        onLoad={() => setLoaded(true)}
      />
    </button>
  );
}
