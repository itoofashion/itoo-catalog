/**
 * Who gets the team's view of the catalog.
 *
 * The catalog is public by design, so this guards the tools rather than the
 * products: picking styles, building a client link and running a sync. There is
 * no user list. The team shares one password, which is what a three-person
 * wholesale operation actually does, and one Cloudflare secret is the whole of
 * the account management.
 *
 * Locally there is nothing to protect and no secret to configure, so an
 * unconfigured development server treats everyone as the team. A deployed one
 * does not: it refuses to sign anyone in and says so, the same way the sync
 * endpoint refuses to accept a sync (see lib/sync/auth.ts).
 */
import { verifyPassword } from "./password";
import { sessionExpiry, signSession, verifySession, SESSION_DAYS } from "./session";

export const ADMIN_SESSION_COOKIE = "itoo_team";

export type AdminConfig = {
  passwordHash: string | undefined;
  sessionSecret: string | undefined;
  isProduction: boolean;
};

export type AdminGate =
  /** Nothing configured, nothing deployed: everyone is the team. */
  | "open"
  /** A password is configured and is the way in. */
  | "password"
  /** Deployed with no password: no way in, and saying so is the honest answer. */
  | "unconfigured";

export type AdminAuthResult = { ok: true } | { ok: false; status: number; error: string };

export const NOT_CONFIGURED_MESSAGE =
  "Sign-in is not configured. Set the ADMIN_PASSWORD_HASH secret on the Worker before signing in.";

export const WRONG_PASSWORD_MESSAGE = "That password does not match.";

/**
 * Read per call rather than once at module load: on Cloudflare the secrets are
 * put on process.env when a request arrives, so a value captured at import time
 * would be the one from whenever this module happened to be evaluated.
 */
export function readAdminConfig(env: NodeJS.ProcessEnv = process.env): AdminConfig {
  return {
    passwordHash: env.ADMIN_PASSWORD_HASH,
    sessionSecret: env.ADMIN_SESSION_SECRET,
    isProduction: env.NODE_ENV === "production",
  };
}

export function adminGate(config: AdminConfig): AdminGate {
  if (config.passwordHash?.trim()) return "password";
  return config.isProduction ? "unconfigured" : "open";
}

export async function authorizeAdminPassword(
  password: string,
  config: AdminConfig,
): Promise<AdminAuthResult> {
  switch (adminGate(config)) {
    case "open":
      return { ok: true };
    case "unconfigured":
      return { ok: false, status: 503, error: NOT_CONFIGURED_MESSAGE };
    case "password":
      return (await verifyPassword(password, config.passwordHash))
        ? { ok: true }
        : { ok: false, status: 401, error: WRONG_PASSWORD_MESSAGE };
  }
}

/** Whether this request may see the team's tools. */
export async function isTeamSession(
  token: string | undefined,
  config: AdminConfig,
  now: Date,
): Promise<boolean> {
  switch (adminGate(config)) {
    case "open":
      return true;
    case "unconfigured":
      return false;
    case "password":
      return verifySession(token, sessionKey(config), now);
  }
}

export async function newSessionToken(config: AdminConfig, now: Date): Promise<string> {
  return signSession(sessionExpiry(now), sessionKey(config));
}

export function sessionCookieOptions(maxAge: number = SESSION_DAYS * 24 * 60 * 60) {
  return {
    httpOnly: true,
    // The catalog is https everywhere it is deployed, and localhost counts as a
    // secure origin, so this costs nothing and keeps the cookie off plain http.
    secure: true,
    // Lax rather than Strict: a team member following a link to a client page
    // from an email should arrive already signed in.
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

/**
 * A second secret would be a second thing to remember to set, and a demo that
 * forgets it is a demo with unsigned sessions. Falling back to the password hash
 * gives a key that is already secret and already deployed, with the side effect
 * that changing the password signs everyone out, which is what changing a shared
 * password is for.
 */
function sessionKey(config: AdminConfig): string {
  return (
    config.sessionSecret?.trim() ||
    config.passwordHash?.trim() ||
    // Only reachable with the gate open, where nothing checks the session at all.
    "itoo-development"
  );
}
