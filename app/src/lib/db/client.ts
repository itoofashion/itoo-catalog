import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * The D1 database, when there is one.
 *
 * Only the part of D1Database anything here uses, typed structurally. That
 * keeps this file free of @cloudflare/workers-types and, more usefully, keeps
 * every caller honest about the binding being optional: `next dev` and the test
 * run have no Cloudflare underneath them and get null, exactly as the R2 image
 * store does (see lib/images/store.ts).
 */
export type Database = {
  prepare(query: string): PreparedStatement;
};

export type PreparedStatement = {
  bind(...values: unknown[]): PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  /**
   * Every row of the answer. D1 spells the payload `results`; it is optional
   * here because the callers have to cope with an empty answer anyway, and a
   * missing array and an empty one mean the same thing to them.
   */
  all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
  run(): Promise<{ meta?: { changes?: number } }>;
};

/**
 * The async form of getCloudflareContext is the one that works everywhere a
 * route can run; the sync form throws unless the worker has already put the
 * context on the global scope. Off Cloudflare it throws outright, and a null
 * database is the answer there.
 */
export async function database(): Promise<Database | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const binding = (env as unknown as Record<string, unknown>).DB;
    return isDatabase(binding) ? binding : null;
  } catch {
    return null;
  }
}

function isDatabase(value: unknown): value is Database {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Partial<Database>).prepare === "function"
  );
}
