/**
 * Mirror of app/src/lib/sync/messages.ts. The catalog page and this extension
 * only agree if these two files agree, so change them together.
 */
export const SYNC_MESSAGE_SOURCE = "itoo-catalog";
export const EXTENSION_READY_ATTRIBUTE = "data-itoo-extension";

/** How many products the pilot imports. The full build lifts this limit. */
export const PILOT_PRODUCT_LIMIT = 10;

/** Proves a sync came from us; mirrors app/src/lib/sync/auth.ts. */
export const SYNC_SECRET_HEADER = "x-itoo-sync-secret";
