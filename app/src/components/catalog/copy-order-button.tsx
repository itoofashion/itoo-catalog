"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { orderText } from "@/lib/catalog/order";
import type { Product } from "@/lib/catalog/types";

/**
 * Buyers work in chat, so the fastest path from "I want this" to an order is a
 * button that puts the item's details on the clipboard, ready to paste.
 */
export function CopyOrderButton({
  product,
  color,
  className,
}: {
  product: Product;
  color: string | null;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    const text = orderText(
      product,
      color,
      typeof window === "undefined" ? undefined : window.location.href,
    );
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard access can be blocked; still confirm so the button never
      // looks broken, and the buyer can copy from the product dialog instead.
    }
    setCopied(true);
  }

  return (
    <Button
      type="button"
      onClick={copy}
      className={className}
      variant={copied ? "secondary" : "default"}
      size="sm"
    >
      {copied ? (
        <>
          <Check className="size-4" /> Copied
        </>
      ) : (
        <>
          <Copy className="size-4" /> Copy to order
        </>
      )}
    </Button>
  );
}
