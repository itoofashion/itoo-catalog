/**
 * Guards the sync endpoint.
 *
 * The catalog is served from a public address, so without this anyone who found
 * the URL could replace the whole catalog with their own products. The importer
 * proves it is ours by sending a shared secret, set as a Cloudflare secret on
 * the Worker.
 *
 * Locally there is no secret to configure and nothing to protect, so an
 * unconfigured development server accepts the sync. A deployed one does not:
 * refusing is safer than quietly serving an open endpoint.
 */
export const SYNC_SECRET_HEADER = "x-itoo-sync-secret";

export type SyncAuthResult = { ok: true } | { ok: false; status: number; error: string };

export function authorizeSync(
  request: Request,
  options: { secret: string | undefined; isProduction: boolean },
): SyncAuthResult {
  const configured = options.secret?.trim();

  if (!configured) {
    if (options.isProduction) {
      return {
        ok: false,
        status: 503,
        error:
          "Sync is not configured. Set the SYNC_SECRET secret on the Worker before syncing.",
      };
    }
    return { ok: true };
  }

  const presented = request.headers.get(SYNC_SECRET_HEADER)?.trim();
  if (!presented || !timingSafeEqual(presented, configured)) {
    return { ok: false, status: 401, error: "Wrong or missing sync secret." };
  }
  return { ok: true };
}

/** Compares without leaking, through timing, how much of the secret matched. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) {
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return difference === 0;
}
