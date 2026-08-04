"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { orderText } from "@/lib/catalog/order";
import type { PublicProduct } from "@/lib/catalog/public";

/**
 * Buyers work in chat, so the fastest path from "I want this" to an order is a
 * line of text on their clipboard. Showing that line before it is copied is the
 * point of the popover: a buyer pastes it into a conversation with their own
 * supplier, and they should be able to see exactly what they are about to send
 * rather than trust an invisible clipboard.
 */
export function CopyOrderButton({
  product,
  color,
  className,
  size = "default",
}: {
  product: PublicProduct;
  color: string | null;
  className?: string;
  size?: "sm" | "default" | "lg";
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [text, setText] = useState("");

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  function show(next: boolean) {
    setOpen(next);
    if (next) {
      // Built on open so the line always reflects the colour chosen a moment ago.
      setText(orderText(product, color, window.location.href));
      setCopied(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard access can be denied; the text stays on screen to be selected
      // by hand, so the buyer is never stuck.
    }
    setCopied(true);
  }

  return (
    <Popover open={open} onOpenChange={show}>
      <PopoverTrigger asChild>
        <Button type="button" size={size} className={className} data-copy-order="">
          <Copy /> Copy to order
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        sideOffset={10}
        className="w-[min(22rem,calc(100vw-2rem))] p-0"
      >
        <p className="px-4 pt-3 text-xs uppercase tracking-widest text-muted-foreground">
          This is what gets copied
        </p>
        <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap break-words px-4 pb-3 text-sm leading-relaxed">
          {text}
        </pre>
        <div className="border-t p-3">
          <Button type="button" className="w-full" onClick={copy} data-copy-confirm="">
            {copied ? (
              <>
                <Check /> Copied — paste it in chat
              </>
            ) : (
              <>
                <Copy /> Copy
              </>
            )}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
