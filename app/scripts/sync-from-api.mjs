/**
 * Pulls the catalog out of FashionGo's published API and pushes it to the site,
 * once, unconditionally.
 *
 *   FASHIONGO_API_KEY=... SYNC_SECRET=... node scripts/sync-from-api.mjs
 *
 * The same run as `sync-agent.mjs --full`; this entry point predates the agent
 * and stays because "run a sync right here, right now" deserves a command whose
 * name says exactly that. The pipeline itself lives in scripts/sync-core.mjs,
 * which also explains why this runs on a machine rather than in the Worker.
 */
import { fullSync, readEnv } from "./sync-core.mjs";

await fullSync(readEnv());
