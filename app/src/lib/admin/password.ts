/**
 * The team password, kept as a PBKDF2-HMAC-SHA256 hash rather than as itself.
 *
 * The hash lives in a Cloudflare secret, and a secret is readable by everyone
 * who can open the Worker's settings, which for a small team is everyone. A
 * password that is also used elsewhere should not be sitting there in the clear,
 * and a hash cannot be typed into a login form.
 *
 * The stored string is `iterations:salt:hash`, salt and hash in base64. Carrying
 * the iteration count means it can be raised later without invalidating the
 * format: a hash generated today keeps verifying, and a hash generated with a
 * higher count verifies too. Generate one with scripts/make-admin-password.mjs.
 */
import { timingSafeEqual } from "./constant-time";

/**
 * Also the count the generator uses. PBKDF2 is deliberately slow, and it runs on
 * the Worker's request budget. That budget is only touched when someone signs
 * in, which happens once a month per person, so the floor is set by what is
 * safe rather than by what is fast.
 */
export const MINIMUM_ITERATIONS = 100_000;

const SALT_BYTES = 16;
const HASH_BYTES = 32;

export type PasswordHash = {
  iterations: number;
  salt: Uint8Array;
  /** Base64, as stored: what a fresh derivation is compared against. */
  hash: string;
  /** How many bytes that base64 holds, which is how many to derive. */
  hashBytes: number;
};

/** Returns null for anything that is not a hash this file could have produced. */
export function parsePasswordHash(encoded: string | undefined): PasswordHash | null {
  const parts = encoded?.trim().split(":") ?? [];
  if (parts.length !== 3) return null;

  const [rawIterations, rawSalt, rawHash] = parts;
  const iterations = Number(rawIterations);
  if (!Number.isSafeInteger(iterations) || iterations < MINIMUM_ITERATIONS) return null;

  const salt = decodeBase64(rawSalt);
  const hash = decodeBase64(rawHash);
  if (!salt || !hash || salt.length === 0 || hash.length === 0) return null;

  return { iterations, salt, hash: rawHash.trim(), hashBytes: hash.length };
}

/**
 * Answers only "is this the password", never "how far did it get". A wrong
 * password and a malformed hash are the same "no" to the caller.
 */
export async function verifyPassword(
  password: string,
  encoded: string | undefined,
): Promise<boolean> {
  const parsed = parsePasswordHash(encoded);
  if (!parsed) return false;

  const derived = await deriveBase64(
    password,
    parsed.salt,
    parsed.iterations,
    parsed.hashBytes,
  );
  return timingSafeEqual(derived, parsed.hash);
}

/**
 * Produces a fresh `iterations:salt:hash` string. The generator script derives
 * the same thing with node:crypto; this is what the tests hash with, so the two
 * agreeing is checked rather than assumed.
 */
export async function derivePasswordHash(
  password: string,
  iterations: number = MINIMUM_ITERATIONS,
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await deriveBase64(password, salt, iterations, HASH_BYTES);
  return `${iterations}:${encodeBase64(salt)}:${hash}`;
}

async function deriveBase64(
  password: string,
  salt: Uint8Array,
  iterations: number,
  bytes: number,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    key,
    bytes * 8,
  );
  return encodeBase64(new Uint8Array(bits));
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64(value: string): Uint8Array | null {
  const trimmed = value.trim();
  // atob is lenient about some malformed input, and a hash that decodes to
  // something other than what was written is worse than one that is rejected.
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(trimmed) || trimmed.length % 4 !== 0) return null;
  try {
    const binary = atob(trimmed);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}
