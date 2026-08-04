/**
 * What the browser carries between visits after a successful sign-in.
 *
 * The cookie holds an expiry and a signature over it, never the password: a
 * cookie that leaks tells the finder when it stops working and nothing else, and
 * a stolen one cannot be extended without the signing key. Sessions are verified
 * from the value alone: there is no session list to keep, which suits a Worker
 * with no database.
 */
import { timingSafeEqual } from "./constant-time";

/** Long enough that the team signs in about once a month, not every morning. */
export const SESSION_DAYS = 30;

export function sessionExpiry(now: Date, days: number = SESSION_DAYS): Date {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

export async function signSession(expiresAt: Date, key: string): Promise<string> {
  const stamp = String(expiresAt.getTime());
  return `${stamp}.${await sign(stamp, key)}`;
}

export async function verifySession(
  token: string | undefined,
  key: string,
  now: Date,
): Promise<boolean> {
  const parts = (token ?? "").split(".");
  if (parts.length !== 2) return false;

  const [stamp, signature] = parts;
  const expiresAt = Number(stamp);
  if (!Number.isSafeInteger(expiresAt)) return false;

  // The signature is checked before the expiry, so a made-up cookie cannot be
  // used to find out which expiry values the key would have accepted.
  if (!timingSafeEqual(signature, await sign(stamp, key))) return false;
  return expiresAt > now.getTime();
}

async function sign(payload: string, key: string): Promise<string> {
  const encoder = new TextEncoder();
  const hmac = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", hmac, encoder.encode(payload));

  // base64url: the value goes into a cookie, and "+/=" would need escaping.
  let binary = "";
  for (const byte of new Uint8Array(signature)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
