import type { ReactNode } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import { adminGate, NOT_CONFIGURED_MESSAGE, readAdminConfig } from "@/lib/admin/auth";
import { isTeamViewer } from "@/lib/admin/request";
import { catalogStore } from "@/lib/catalog/store";
import { syncState } from "@/lib/sync/state";
import { CatalogStatus } from "./catalog-status";
import { SignInForm } from "./sign-in-form";

/**
 * Rendered per request, not at build time: it reports the catalog as it stands
 * at this moment, and whether a password is configured is read from the Worker's
 * secrets, which a page baked during the build would have missed.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin panel",
  // Nothing here is for a search engine, and a sign-in page in the results only
  // advertises that there is something to sign in to.
  robots: { index: false, follow: false },
};

/**
 * The team's own page: the way in, and once in, the state of the catalog. The
 * catalog itself stays public at "/" and gives none of this away.
 *
 * Which of the two a visitor gets is decided here, on the server, from the
 * session cookie. Nothing about the catalog is put into the page for someone
 * without one, so there is no hidden panel to be uncovered in the markup.
 */
export default async function AdminPage() {
  // On a server with no password configured, which is only ever a development
  // one, everybody is the team and nobody sees the form: see lib/admin/auth.ts.
  if (await isTeamViewer()) {
    const [catalog, sync] = await Promise.all([
      catalogStore.read(),
      syncState().then((state) => state.read()),
    ]);
    return (
      <Frame>
        <CatalogStatus
          productCount={catalog.products.length}
          syncedAt={catalog.syncedAt}
          lastRun={sync.lastRun}
          syncRequestedAt={sync.requestedAt}
        />
      </Frame>
    );
  }

  return (
    <Frame heading="Sign in to the admin panel">
      {adminGate(readAdminConfig()) === "unconfigured" ? (
        <p className="text-center text-sm text-muted-foreground">
          {NOT_CONFIGURED_MESSAGE}
        </p>
      ) : (
        <SignInForm />
      )}
    </Frame>
  );
}

/**
 * The same mark the catalog opens with, so this reads as the same shop. The
 * heading differs by state on purpose: at the door it says what the door is
 * for, and inside it is the name of the room.
 */
function Frame({
  children,
  heading = "Admin panel",
}: {
  children: ReactNode;
  heading?: string;
}) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-6 py-24">
      <div className="flex flex-col gap-3 text-center">
        {/* Asked for at its full 1050px and drawn at the 32px line: the image
            optimizer is off on Workers (see next.config.ts), so the browser
            gets the file as shipped and scales it down itself, which keeps it
            sharp on a retina screen. */}
        <Image
          src="/logo.png"
          alt="itoo"
          width={1050}
          height={483}
          priority
          className="mx-auto h-8 w-auto"
        />
        {/* Semibold, like every other heading here: 500 is not one of the three
            weights Raleway is loaded in (see layout.tsx), so a medium heading
            was the browser faking a weight the page never had. */}
        <h1 className="text-lg font-semibold">{heading}</h1>
      </div>
      {children}
    </main>
  );
}
