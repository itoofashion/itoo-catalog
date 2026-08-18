import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, EyeOff, LogOut, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The admin area's rooms. Two today; the roadmap (prices, access control) adds
 * rooms rather than sections, which is why this is a list and not two links.
 */
// Spelled out, not "Sync": the rail is read by managers, and a full word costs
// nothing. The button inside the room still says "Sync now" — an action wears
// the short word, a place wears the whole one.
const PAGES = [
  { key: "sync", label: "Synchronization", href: "/admin", icon: RefreshCw },
  { key: "hidden", label: "Hidden styles", href: "/admin/hidden", icon: EyeOff },
] as const;

export type AdminPageKey = (typeof PAGES)[number]["key"];

/**
 * The frame every admin page stands in: a sidebar that owns all the moving
 * around — the way back to the catalog, the rooms, and the way out at the
 * bottom — set off from the work by its own border. On a phone the same
 * things sit in a bar across the top instead.
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
    <div className="flex flex-1 flex-col sm:flex-row">
      <aside className="flex shrink-0 flex-col border-b sm:w-56 sm:border-b-0 sm:border-r">
        <div className="flex items-center justify-between px-4 pb-2 pt-4 sm:block sm:px-5 sm:pt-6">
          <Link href="/" aria-label="itoo, back to the catalog" className="inline-block">
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
          <h1 className="tracked text-[10px] text-muted-foreground sm:pt-2">
            Admin panel
          </h1>
        </div>

        <nav
          aria-label="Admin pages"
          className="flex items-center gap-1 overflow-x-auto px-3 pb-3 sm:flex-col sm:items-stretch sm:px-3 sm:pb-0 sm:pt-4"
        >
          <NavRow href="/" active={false}>
            <ArrowLeft className="size-4" /> Catalog
          </NavRow>

          <span
            aria-hidden
            className="mx-1 w-px self-stretch bg-border sm:mx-2 sm:my-2 sm:h-px sm:w-auto sm:self-auto"
          />

          {PAGES.map((page) => (
            <NavRow key={page.key} href={page.href} active={page.key === current}>
              <page.icon className="size-4" /> {page.label}
            </NavRow>
          ))}

          {/* The way out rides at the end of the bar on a phone; on a laptop
              it sits at the bottom of the rail, in its own form below. */}
          <SignOut className="sm:hidden" />
        </nav>

        <SignOut className="mt-auto hidden px-3 pb-5 sm:block" />
      </aside>

      <main className="flex w-full min-w-0 max-w-2xl flex-1 flex-col gap-6 px-4 py-6 sm:px-8 lg:py-8">
        {children}
      </main>
    </div>
  );
}

function NavRow({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-sm px-3 py-2 text-[13px] transition",
        active
          ? "bg-foreground font-semibold text-background"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

/** A plain form, not a fetch: signing out has to work even when the page's
    JavaScript never loaded. */
function SignOut({ className }: { className?: string }) {
  return (
    <form action="/admin/sign-out" method="post" className={className}>
      <button
        type="submit"
        className="flex w-full shrink-0 cursor-pointer items-center gap-2.5 whitespace-nowrap rounded-sm px-3 py-2 text-[13px] text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        <LogOut className="size-4" /> Sign out
      </button>
    </form>
  );
}
