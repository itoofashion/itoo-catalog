"use client";

import Image from "next/image";
import { useCallback, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Eye, EyeOff, Loader2, Plus } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatColorName, swatchFor } from "@/lib/catalog/color";
import { packSummary } from "@/lib/catalog/pack";
import { formatPrice } from "@/lib/catalog/pricing";
import type { PublicImage, PublicProduct } from "@/lib/catalog/public";
import { CopyOrderButton } from "./copy-order-button";
import { PhotoDots } from "./photo-dots";
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
  /**
   * The team's view also adds the eye that takes a style out of the catalog. A
   * client never sees it, and never has: the styles it hides are gone from their
   * page before it is sent (see lib/catalog/public.ts).
   */
  hideable: boolean;
  /**
   * Whether this style is out of the catalog right now. Held by the catalog
   * rather than read off the product, the same way `selected` is: a press has to
   * show on the card before the server has answered it. See catalog-view.
   */
  hidden: boolean;
  /**
   * Reports the press and resolves when the server has answered, which is what
   * the button waits on: hiding a style is a round trip, and a button that looks
   * finished before it is gets pressed twice.
   */
  onToggleHidden: (sku: string) => Promise<void>;
  /**
   * The chosen color, held by the catalog rather than by the card: the open
   * style shows the same swatches and the two have to agree. See catalog-view.
   */
  color: string | null;
  onPickColor: (sku: string, color: string) => void;
  /**
   * The photograph this style is showing, held by the catalog for the same
   * reason the color is: opening the card has to open the photograph it had
   * reached, and closing the open style has to leave the card on the photograph
   * it was left on. See catalog-view.
   */
  photoIndex: number;
  onShowPhoto: (sku: string, index: number) => void;
  /** This style's own address, which the copy button sends with the details. */
  path: string;
  onOpen: (product: PublicProduct, photoIndex: number) => void;
};

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
  hideable,
  hidden,
  onToggleHidden,
  color,
  onPickColor,
  photoIndex,
  onShowPhoto,
  path,
  onOpen,
}: ProductCardProps) {
  const photos = product.images;
  const pack = packSummary(product);
  // Kept still between renders, or the strip's scroll listener is hung again on
  // every one of them; forty-eight cards make that worth a line.
  const showPhoto = useCallback(
    (index: number) => onShowPhoto(product.sku, index),
    [onShowPhoto, product.sku],
  );
  const stripRef = usePhotoStrip(photos.length, photoIndex, showPhoto);

  // A swipe across the photos ends in a click event too; only a press that
  // stayed put was meant to open the style.
  const pressedAt = useRef<{ x: number; y: number } | null>(null);

  /**
   * Kept here rather than in the catalog above, because it is one card's wait:
   * the grid stays usable while a style is on its way to being hidden, and the
   * only thing that has to sit still is the button that was pressed.
   */
  const [saving, setSaving] = useState(false);
  async function toggleHidden() {
    if (saving) return;
    setSaving(true);
    try {
      await onToggleHidden(product.sku);
    } finally {
      setSaving(false);
    }
  }

  function open(event: { clientX: number; clientY: number }, index: number) {
    const from = pressedAt.current;
    pressedAt.current = null;
    if (from && Math.hypot(event.clientX - from.x, event.clientY - from.y) > DRAG_SLOP_PX) {
      return;
    }
    onOpen(product, index);
  }

  return (
    <article
      data-sku={product.sku}
      /* Marked on the element rather than only in the styling, so what the card
         is saying survives a redesign of how it says it. Only ever present in
         the team's copy of the catalog: a client's page has no such card. */
      data-hidden={hidden ? "" : undefined}
      className="group flex flex-col"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-muted">
        {photos.length > 0 ? (
          <div
            ref={stripRef}
            /* A hidden style is faded, not removed: this is the team's own view
               and the card is the only place to press to bring it back. The fade
               is on the photographs alone, so the eye that undoes it stays at
               full strength and plainly pressable. */
            className={cn("photo-strip absolute inset-0", hidden && "opacity-30")}
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
          <div
            className={cn(
              "flex h-full items-center justify-center text-sm text-muted-foreground",
              hidden && "opacity-30",
            )}
          >
            No photo
          </div>
        )}

        {/* Faded photographs on their own would read as a slow-loading card, so
            the card also says what has happened to it, in words, and says who it
            has happened for. The team is the only audience this can have. */}
        {hidden && (
          <span
            data-badge="hidden"
            className="tracked pointer-events-none absolute left-0 top-3 bg-foreground px-2.5 py-1 text-[10px] font-semibold text-background"
          >
            Hidden from clients
          </span>
        )}

        {product.isNew && (
          <span
            data-badge="new"
            /* Under the other badge when there are two, rather than beside it:
               they are both left-aligned labels and stacking keeps each one
               readable at a glance. */
            className={cn(
              "tracked pointer-events-none absolute left-0 bg-brand px-2.5 py-1 text-[10px] font-semibold text-brand-foreground",
              hidden ? "top-11" : "top-3",
            )}
          >
            New
          </span>
        )}

        {/* Both of the team's controls, in one corner and one row: the eye takes
            a style out of the catalog, the tick puts it in a client's link. Same
            box, same size, so the corner reads as a pair rather than as a
            control and an afterthought. */}
        {(hideable || selectable) && (
          <div className="absolute right-2.5 top-2.5 flex items-center gap-2">
            {hideable && (
              <Tooltip>
                <TooltipTrigger asChild>
              <button
                type="button"
                disabled={saving}
                aria-label={
                  hidden
                    ? `Show ${product.sku} to clients again`
                    : `Hide ${product.sku} from clients`
                }
                aria-pressed={hidden}
                onClick={toggleHidden}
                /* The plus's box, to the pixel: 20px reads, a thumb needs more,
                   and the pseudo-element gives it more without moving anything
                   on the card. Filled when the style is hidden, the same way
                   the plus fills when it is picked, so the corner has one
                   grammar and not two. White at rest, over any photograph:
                   these are controls for people who do not go hunting, and a
                   ghost of a button is a button not found. */
                className={cn(
                  "relative flex size-5 items-center justify-center rounded-sm border shadow-sm transition before:absolute before:-inset-1.5 before:content-['']",
                  hidden
                    ? "border-foreground bg-foreground text-white"
                    : "border-black/10 bg-white/85 text-foreground hover:bg-white",
                  saving ? "cursor-wait opacity-70" : "cursor-pointer",
                )}
              >
                {saving ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : hidden ? (
                  <EyeOff className="size-3.5" />
                ) : (
                  <Eye className="size-3.5" />
                )}
              </button>
                </TooltipTrigger>
                <TooltipContent>
                  {hidden
                    ? "Hidden from clients. Press to put it back."
                    : "Hide from clients"}
                </TooltipContent>
              </Tooltip>
            )}

            {selectable && (
              <Tooltip>
                <TooltipTrigger asChild>
              <button
                type="button"
                /* aria-disabled rather than disabled: a disabled button hears
                   no hover, and the tooltip explaining *why* it cannot be
                   pressed is the whole point of hovering it. */
                aria-disabled={lockedByCategory}
                aria-label={
                  lockedByCategory
                    ? `${product.sku} is included through its category`
                    : selected
                      ? `Remove ${product.sku} from selection`
                      : `Add ${product.sku} to selection`
                }
                aria-pressed={selected || lockedByCategory}
                onClick={() => !lockedByCategory && onToggleSelect(product.sku)}
                /* The same button as the one beside a category in the rail: a
                   plus that fills into a check, one control picked in two
                   places, wearing the card's over-photo whites here. It reads
                   at 20px and is hit with a thumb, so the target around it is
                   grown by a pseudo-element.

                   A style held by its category shows the same check, faded and
                   unpressable. A padlock was tried here and read as a puzzle: a
                   dimmed check says "already in, not yours to take out" without
                   anyone having to work out what the picture means. */
                className={cn(
                  "relative flex size-5 items-center justify-center rounded-sm border shadow-sm transition before:absolute before:-inset-1.5 before:content-['']",
                  selected || lockedByCategory
                    ? "border-foreground bg-foreground text-white"
                    : "border-black/10 bg-white/85 text-foreground hover:bg-white",
                  lockedByCategory ? "cursor-not-allowed opacity-45" : "cursor-pointer",
                )}
              >
                {selected || lockedByCategory ? (
                  <Check className="size-3.5" strokeWidth={3} />
                ) : (
                  <Plus className="size-3.5" />
                )}
              </button>
                </TooltipTrigger>
                <TooltipContent>
                  {lockedByCategory
                    ? `Included because all of ${product.category} is in the link`
                    : selected
                      ? "Remove from the client link"
                      : "Add to the client link"}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
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

            {/* However many photographs there are: a style with twenty-nine of
                them gets the same row of dots as one with three, travelling
                rather than growing. See photo-dots.tsx. */}
            <PhotoDots
              count={photos.length}
              current={photoIndex}
              onShow={showPhoto}
            />
          </>
        )}
      </div>

      {/* Everything printed here is everything the copy button sends, which is
          what lets the button go without a preview of its own. */}
      <div
        className={cn(
          "copy-source flex flex-1 flex-col pt-3",
          // Set aside with its photographs, but not as far: the style number is
          // what someone reads to work out which card they are looking at.
          hidden && "opacity-55",
        )}
      >
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
                  onClick={() => onPickColor(product.sku, option)}
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
          <CopyOrderButton
            product={product}
            color={color}
            path={path}
            tone="card"
            className="w-full"
          />
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
