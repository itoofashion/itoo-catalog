import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { adminGate, NOT_CONFIGURED_MESSAGE, readAdminConfig } from "@/lib/admin/auth";
import { isTeamViewer } from "@/lib/admin/request";
import { SignInForm } from "./sign-in-form";

/**
 * Rendered per request, not at build time: whether a password is configured is
 * read from the Worker's secrets, and a page baked during the build would keep
 * telling everyone that sign-in is not set up long after the secret was added.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "itoo team sign-in",
  // Nothing here is for a search engine, and a login page in the results only
  // advertises that there is something to log in to.
  robots: { index: false, follow: false },
};

/**
 * The way in for the team. The catalog stays public at "/" either way. Signing
 * in is what turns it into the working view, with the checkboxes, the link panel
 * and the sync button.
 */
export default async function AdminPage() {
  const gate = adminGate(readAdminConfig());

  // Already signed in: there is nothing to do here but leave. With the gate open
  // everyone is the team, and sending them away would leave no form to look at.
  if (gate === "password" && (await isTeamViewer())) redirect("/");

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-6 py-24">
      <div className="flex flex-col gap-3 text-center">
        <span className="text-2xl font-bold tracking-[0.3em]">itoo</span>
        <h1 className="text-lg font-medium">Sign in to the itoo panel</h1>
        {gate === "unconfigured" && (
          <p className="text-sm text-muted-foreground">{NOT_CONFIGURED_MESSAGE}</p>
        )}
      </div>

      {gate === "unconfigured" ? null : <SignInForm />}

      {gate === "open" && (
        <p className="text-center text-sm text-muted-foreground">
          No password is set on this server, so any password will do.
        </p>
      )}
    </main>
  );
}
