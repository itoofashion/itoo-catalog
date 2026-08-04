"use client";

import { useEffect, useState } from "react";
import { Check, Copy, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { orderText } from "@/lib/catalog/order";
import type { PublicProduct } from "@/lib/catalog/public";

/**
 * Long enough to be found again across a grid of forty-eight cards, short
 * enough that it never outlives the paste it is confirming.
 */
const CONFIRM_MS = 2000;

type Result = "idle" | "copied" | "failed";

/**
 * Buyers work in chat, so the shortest path from "I want this" to an order is a
 * line of text on their clipboard. One press puts it there.
 *
 * There used to be a popover in between, showing the line before it was copied.
 * It was answering a fair question — what exactly am I about to send? — with a
 * second copy of text the buyer was already looking at, and charging two presses
 * for it. The card and the dialog print the same facts the line carries, so the
 * preview is the page itself: pointing at this button marks the block of facts
 * it will copy (see .copy-facts in globals.css), and a successful copy holds
 * that mark while the button reads "Copied".
 */
export function CopyOrderButton({
  product,
  color,
  className,
  tone = "detail",
}: {
  product: PublicProduct;
  color: string | null;
  className?: string;
  /**
   * A card carries one of these per style and up to forty-eight per screen, so
   * there it stays outlined and only fills in on hover; the dialog shows a
   * single style and this is the one thing to do with it.
   */
  tone?: "card" | "detail";
}) {
  const [result, setResult] = useState<Result>("idle");

  useEffect(() => {
    if (result === "idle") return;
    const timer = setTimeout(() => setResult("idle"), CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [result]);

  async function copy() {
    // Built at the press so the line always carries the colour chosen a moment
    // ago and the address the buyer is actually on.
    const text = orderText(product, color, window.location.href);
    setResult((await writeToClipboard(text)) ? "copied" : "failed");
  }

  const label =
    result === "copied" ? "Copied" : result === "failed" ? "Copy failed" : "Copy details";

  return (
    <>
      <Button
        type="button"
        size={tone === "card" ? "sm" : "lg"}
        variant={tone === "card" ? "outline" : "default"}
        onClick={copy}
        /* Forty-eight buttons that all announce themselves as "Copy details"
           tell a screen reader nothing about which style is which. The visible
           words open the name, so the two still match. */
        aria-label={`${label} — ${product.name}, ${product.sku}`}
        data-copy-order=""
        data-copied={result === "copied" ? "" : undefined}
        className={cn(
          tone === "card"
            ? "border-foreground/20 text-foreground hover:border-foreground hover:bg-foreground hover:text-background data-copied:border-foreground data-copied:bg-foreground data-copied:text-background"
            : /* The default fill lightens on hover, which reads as a step back
                 from the one thing there is to do here. */
              "hover:bg-foreground data-copied:bg-foreground",
          result === "failed" && "border-destructive text-destructive",
          className,
        )}
      >
        {result === "copied" ? (
          <Check />
        ) : result === "failed" ? (
          <TriangleAlert />
        ) : (
          <Copy />
        )}
        {label}
      </Button>
      {/* Announced rather than shown: the button's own label changes, and a
          rename under the reader's cursor is not reliably read out. */}
      <span role="status" aria-live="polite" className="sr-only">
        {result === "copied"
          ? `Copied ${product.sku}`
          : result === "failed"
            ? "Nothing was copied. Select the details on the card and copy them by hand."
            : ""}
      </span>
    </>
  );
}

async function writeToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // The clipboard API is refused outside a secure context and inside some of
    // the in-app browsers these links get opened in, which is exactly where a
    // buyer working from a chat window arrives from.
    return copyBySelection(text);
  }
}

/** The pre-clipboard-API way: select text off-screen and let the browser cut it. */
function copyBySelection(text: string): boolean {
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.cssText = "position:fixed;top:0;left:0;opacity:0";
  document.body.append(field);
  field.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    field.remove();
  }
}
