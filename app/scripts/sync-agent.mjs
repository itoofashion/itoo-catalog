/**
 * The sync agent: the scheduled half of the "Sync now" button.
 *
 *   node scripts/sync-agent.mjs --poll   ask the catalog whether a sync was
 *                                        requested; run one if so, exit
 *                                        silently if not. Meant for cron,
 *                                        every minute.
 *   node scripts/sync-agent.mjs --full   run a sync unconditionally. Meant for
 *                                        the standing schedule.
 *
 * Env: FASHIONGO_API_KEY, SYNC_SECRET, CATALOG_ORIGIN. See scripts/README.md
 * for the cron lines this is written for, and src/lib/fashiongo/sync-request.ts
 * for why this runs on a machine of its own: FashionGo answers a whitelisted
 * address, and the Worker has no fixed one, so the button can only leave a note
 * and this agent is what reads it.
 *
 * --poll stays quiet when there is nothing to do on purpose: cron mails
 * whatever a job prints, and a minutely "nothing happened" is how mail gets
 * ignored.
 */
import { fullSync, readEnv, syncIsRequested } from "./sync-core.mjs";

const mode = process.argv[2];

if (mode !== "--poll" && mode !== "--full") {
  console.error("Usage: node scripts/sync-agent.mjs --poll | --full");
  process.exit(2);
}

const config = readEnv();

if (mode === "--poll" && !(await syncIsRequested(config))) {
  process.exit(0);
}

if (mode === "--poll") {
  console.log("A sync was requested from the admin panel. Running it.");
}
await fullSync(config);
