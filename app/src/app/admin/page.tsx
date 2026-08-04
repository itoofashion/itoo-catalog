import type { ReactNode } from "react";
import type { Metadata } from "next";
import { adminGate, NOT_CONFIGURED_MESSAGE, readAdminConfig } from "@/lib/admin/auth";
import { isTeamViewer } from "@/lib/admin/request";
import { catalogStore } from "@/lib/catalog/store";
import { CatalogStatus } from "./catalog-status";
import { SignInForm } from "./sign-in-form";

/**
 * Rendered per request, not at build time: it reports the catalog as it stands
 * at this moment, and whether a password is configured is read from the Worker's
 * secrets, which a page baked during the build would have missed.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "itoo admin",
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
    const catalog = await catalogStore.read();
    return (
      <Frame heading="Catalog status">
        <CatalogStatus
          productCount={catalog.products.length}
          syncedAt={catalog.syncedAt}
        />
      </Frame>
    );
  }

  return (
    <Frame heading="Sign in to the itoo panel">
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

/** The same lettering the catalog opens with, so this reads as the same shop. */
function Frame({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-6 py-24">
      <div className="flex flex-col gap-3 text-center">
        <span className="text-2xl font-bold tracking-[0.3em]">itoo</span>
        <h1 className="text-lg font-medium">{heading}</h1>
      </div>
      {children}
    </main>
  );
}
