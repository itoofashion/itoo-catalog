import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The admin area's rooms. Two today; the roadmap (prices, access control) adds
 * rooms rather than sections, which is why this is a list and not two links.
 */
const PAGES = [
  { key: "sync", label: "Sync & arrivals", href: "/admin" },
  { key: "hidden", label: "Hidden styles", href: "/admin/hidden" },
] as const;

export type AdminPageKey = (typeof PAGES)[number]["key"];

/**
 * The frame every admin page stands in: who and where at the top, the rooms on
 * the left, the work in the middle.
 *
 * The same skeleton as the catalog on purpose — logo top left, a rail beside
 * the content — so crossing between the two reads as moving around one shop.
 * On a phone the rail becomes a row of tabs under the header. The way back to
 * the catalog is the first item of the rail and the logo itself, both real
 * links.
 *
 * Every page names itself through `current` rather than reading the address:
 * the pages are gated per request (see the pages themselves), and this frame
 * renders only inside a page that has already been allowed to.
 */
export function AdminShell({
  current,
  children,
}: {
  current: AdminPageKey;
  children: ReactNode;
}) {
  return (
    <>
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-10">
          <div className="flex items-center gap-3">
            <Link href="/" aria-label="itoo, back to the catalog">
              {/* Full-size file drawn small: the optimizer is off on Workers
                  (see next.config.ts), the browser scales it sharply itself. */}
              <Image
                src="/logo.png"
                alt="itoo"
                width={1050}
                height={483}
                priority
                className="h-6 w-auto sm:h-7"
              />
            </Link>
            <span aria-hidden className="h-5 w-px bg-border" />
            <h1 className="tracked text-[11px] font-semibold text-muted-foreground">
              Admin panel
            </h1>
          </div>

          {/* A plain form, not a fetch: signing out has to work even when the
              page's JavaScript never loaded. */}
          <form action="/admin/sign-out" method="post">
            <Button type="submit" variant="ghost" size="sm">
              <LogOut /> Sign out
            </Button>
          </form>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-5 sm:px-6 lg:flex-row lg:gap-10 lg:px-10 lg:py-8">
        <nav
          aria-label="Admin pages"
          className="flex flex-wrap items-center gap-1.5 lg:w-52 lg:shrink-0 lg:flex-col lg:items-stretch lg:self-start"
        >
          <Button variant="outline" size="sm" asChild className="lg:justify-start">
            <Link href="/">
              <ArrowLeft /> Catalog
            </Link>
          </Button>

          <span aria-hidden className="mx-1 h-5 w-px bg-border lg:mx-0 lg:my-2 lg:h-px lg:w-full" />

          {PAGES.map((page) => {
            const active = page.key === current;
            return (
              <Link
                key={page.key}
                href={page.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "tracked rounded-sm border px-3 py-1.5 text-[11px] font-semibold transition",
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                )}
              >
                {page.label}
              </Link>
            );
          })}
        </nav>

        <main className="flex w-full min-w-0 max-w-xl flex-1 flex-col gap-10">
          {children}
        </main>
      </div>
    </>
  );
}
