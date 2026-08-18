import Image from "next/image";
import { adminGate, NOT_CONFIGURED_MESSAGE, readAdminConfig } from "@/lib/admin/auth";
import { SignInForm } from "./sign-in-form";

/**
 * The way into the admin area, shared by every page in it: each page is gated
 * per request and shows this door instead of itself to a visitor without a
 * session. Nothing about the catalog is put into the door's markup, so there is
 * no hidden panel to be uncovered in it.
 */
export function SignInDoor() {
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
        <h1 className="text-lg font-semibold">Sign in to the admin panel</h1>
      </div>
      {adminGate(readAdminConfig()) === "unconfigured" ? (
        <p className="text-center text-sm text-muted-foreground">
          {NOT_CONFIGURED_MESSAGE}
        </p>
      ) : (
        <SignInForm />
      )}
    </main>
  );
}
