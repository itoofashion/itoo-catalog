"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_SESSION_COOKIE,
  authorizeAdminPassword,
  newSessionToken,
  readAdminConfig,
  sessionCookieOptions,
} from "@/lib/admin/auth";

export type SignInState = { error: string | null };

/**
 * A wrong password comes back as a message on the form; a right one leaves as a
 * cookie and a reload of this page, which then shows the panel instead of the
 * form. Signing in used to land on the catalog, which skipped past the one page
 * that says whether the data is current. Nothing about the password survives
 * the request.
 *
 * There is no attempt throttling: a Worker has no shared state to count in, and
 * the whole of what is behind the password is the ability to tick styles. The
 * password being long is what makes guessing pointless.
 */
export async function signIn(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const password = String(formData.get("password") ?? "");
  const config = readAdminConfig();

  const result = await authorizeAdminPassword(password, config);
  if (!result.ok) return { error: result.error };

  const jar = await cookies();
  jar.set(
    ADMIN_SESSION_COOKIE,
    await newSessionToken(config, new Date()),
    sessionCookieOptions(),
  );

  // Outside any try/catch on purpose: redirect works by throwing.
  redirect("/admin");
}
