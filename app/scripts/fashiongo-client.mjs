/**
 * Minimal FashionGo vendor-admin API client for development scripts.
 *
 * FashionGo has no public export API, so we speak the same protocol the vendor
 * admin SPA speaks: fetch an RSA public key, encrypt the password with a random
 * AES key, wrap that AES key with RSA, and exchange the pair for a bearer token.
 *
 * Credentials come from the environment, never from source:
 *   FASHIONGO_USERNAME=... FASHIONGO_PASSWORD=... node scripts/pull-seed.mjs
 */
import crypto from "node:crypto";

const VENDOR_API = "https://vendoradmin.fashiongo.net/api/";
const AUTH_API = "https://id.fashiongo.net/api/auth/";
const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** FashionGo rejects page sizes outside its own set; 20 is the smallest that works. */
export const PAGE_SIZE = 20;

function randomHex(length) {
  return crypto.randomBytes(Math.ceil(length / 2)).toString("hex").slice(0, length);
}

/**
 * Buffer.from(hex, "hex") silently drops a trailing nibble on odd-length input,
 * which matters here: the RSA exponent arrives as "10001".
 */
function hexToBuffer(hex) {
  return Buffer.from(hex.length % 2 ? `0${hex}` : hex, "hex");
}

function base64Url(buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Reproduces the SPA's password envelope. The AES key is a 32-character hex
 * string used as raw ASCII bytes, with its first half doubling as the IV.
 */
function encryptPassword(password, { modulus, exponent, keyId }) {
  const secret = randomHex(32);
  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    Buffer.from(secret, "latin1"),
    Buffer.from(secret.slice(0, 16), "latin1"),
  );
  const encrypted = cipher.update(password, "utf8", "base64") + cipher.final("base64");

  const publicKey = crypto.createPublicKey({
    key: {
      kty: "RSA",
      n: base64Url(hexToBuffer(modulus)),
      e: base64Url(hexToBuffer(exponent)),
    },
    format: "jwk",
  });
  const wrapped = crypto.publicEncrypt(
    { key: publicKey, padding: crypto.constants.RSA_PKCS1_PADDING },
    Buffer.from(secret, "utf8"),
  );

  return {
    secureKey: keyId,
    // The SPA hex-encodes the RSA output and then base64s that string.
    passphrase: Buffer.from(wrapped.toString("hex"), "latin1").toString("base64"),
    encrypted,
  };
}

/** The key issued by /crypto/key is tied to the session cookie set alongside it. */
function collectCookies(response) {
  const cookies = response.headers.getSetCookie?.() ?? [];
  return cookies
    .map((cookie) => cookie.split(";")[0])
    .filter(Boolean)
    .join("; ");
}

export async function login(username, password) {
  const keyResponse = await fetch(`${VENDOR_API}crypto/key?default=false`, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
      "Referer-Application-Type": "VendorAdmin",
    },
  });
  const keyBody = await keyResponse.json();
  const key = keyBody.data ?? keyBody;
  if (!key?.modulus) throw new Error("FashionGo did not return an RSA key");

  const response = await fetch(`${AUTH_API}login`, {
    method: "POST",
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
      "Content-Type": "application/json",
      "Referer-Application-Type": "VendorAdmin",
      Origin: "https://vendoradmin.fashiongo.net",
      Referer: "https://vendoradmin.fashiongo.net/",
      Cookie: collectCookies(keyResponse),
    },
    body: JSON.stringify({
      userName: username,
      isApp: true,
      fgDecryptRequest: encryptPassword(password, key),
    }),
  });
  const body = await response.json();
  const token = body?.data?.content?.tokenID;
  if (!token) {
    throw new Error(`Login failed: ${body?.header?.resultMessage ?? response.status}`);
  }
  return token;
}

export function apiClient(token) {
  return async function get(path) {
    const response = await fetch(VENDOR_API + path, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
        "Content-Type": "application/json",
        // The vendor admin identifies itself with "2" on data endpoints.
        "Referer-Application-Type": "2",
        Authorization: `Bearer ${token}`,
        Origin: "https://vendoradmin.fashiongo.net",
        Referer: "https://vendoradmin.fashiongo.net/",
      },
    });
    if (!response.ok) {
      throw new Error(`GET ${path} failed with ${response.status}`);
    }
    return response.json();
  };
}

/** One page of active products. `saleType` and `pageType` are required by the API. */
export async function listActiveProducts(get, pageNumber = 1) {
  const body = await get(
    `items?pn=${pageNumber}&ps=${PAGE_SIZE}&saleType=W&pageType=1`,
  );
  const active = body?.data?.active;
  return {
    records: active?.records ?? [],
    total: active?.total?.totalCount ?? 0,
  };
}

/**
 * Every active product, walked page by page. The API reports the total up front,
 * but it is trusted only as a stop condition alongside an empty page — a vendor
 * adding a style mid-walk must not turn into an endless loop.
 */
export async function listAllActiveProducts(get, onPage = () => {}) {
  const records = [];
  let total = Infinity;

  for (let pageNumber = 1; records.length < total; pageNumber++) {
    const page = await listActiveProducts(get, pageNumber);
    total = page.total;
    if (page.records.length === 0) break;
    records.push(...page.records);
    onPage(records.length, total);
  }

  return records;
}

/** Full product record — this is where per-color photos live. */
export async function getProductDetail(get, productId) {
  const body = await get(`item/${productId}`);
  return body?.data ?? null;
}
