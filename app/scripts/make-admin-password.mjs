/**
 * Turns a team password into the string that goes into the ADMIN_PASSWORD_HASH
 * secret, so the password itself never has to be stored anywhere.
 *
 *   node scripts/make-admin-password.mjs "amber-linen-drift-92"
 *
 * Then, from app/:
 *
 *   npx wrangler secret put ADMIN_PASSWORD_HASH
 *
 * The format is `iterations:salt:hash`, PBKDF2-HMAC-SHA256 with the salt and the
 * hash in base64. It is read back by src/lib/admin/password.ts, which is where
 * the format is defined — a test signs in with a hash this script printed, so
 * the two cannot drift apart unnoticed.
 */
import { pbkdf2, randomBytes } from "node:crypto";
import { promisify } from "node:util";

/**
 * Matches the floor the verifier enforces. Raising it here is safe on its own:
 * the count travels inside the hash, so old hashes keep working.
 */
const ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/make-admin-password.mjs "the-password"');
  process.exit(1);
}

const salt = randomBytes(SALT_BYTES);
const hash = await promisify(pbkdf2)(password, salt, ITERATIONS, HASH_BYTES, "sha256");

console.log(`${ITERATIONS}:${salt.toString("base64")}:${hash.toString("base64")}`);
