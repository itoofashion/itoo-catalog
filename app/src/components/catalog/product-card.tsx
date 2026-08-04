"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Lock } from "lucide-react";
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
            aria-pressed={selected}
            title={
              lockedByCategory
                ? `Included because all of ${product.category} is selected`
                : undefined
            }
            onClick={() => onToggleSelect(product.sku)}
            className={cn(
              "absolute right-2.5 top-2.5 flex size-7 cursor-pointer items-center justify-center rounded-full border text-white shadow-sm transition",
              selected
                ? "border-foreground bg-foreground"
                : "border-white/80 bg-black/25 hover:bg-black/45",
              lockedByCategory && "cursor-default",
            )}
          >
            {lockedByCategory ? (
              <Lock className="size-3" strokeWidth={2.5} />
            ) : (
              selected && <Check className="size-4" strokeWidth={3} />
            )}
          </button>
        )}

        {photos.length > 1 && (
          <>
            {/* Where there is a pointer the arrows are the way through; where
                there is a finger the strip is swiped, so they only take up room. */}
            {photoIndex > 0 && (
              <button
                type="button"
                aria-label="Previous photo"
                onClick={() => showPhoto(photoIndex - 1)}
                className="absolute left-1.5 top-1/2 hidden size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-background/90 shadow-sm transition sm:flex sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
              >
                <ChevronLeft className="size-4" />
              </button>
            )}
            {photoIndex < photos.length - 1 && (
              <button
                type="button"
                aria-label="Next photo"
                onClick={() => showPhoto(photoIndex + 1)}
                className="absolute right-1.5 top-1/2 hidden size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-background/90 shadow-sm transition sm:flex sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
              >
                <ChevronRight className="size-4" />
              </button>
            )}

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
            {pack?.minimum && (
              <span className="text-xs text-muted-foreground">min {pack.minimum}</span>
            )}
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            {product.sku}
            {pack?.sizes && <> · {pack.sizes}</>}
            {pack?.split && <> · {pack.split}</>}
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
