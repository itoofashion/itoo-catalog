import { execFileSync } from "node:child_process";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  derivePasswordHash,
  MINIMUM_ITERATIONS,
  parsePasswordHash,
  verifyPassword,
} from "./password";

const PASSWORD = "amber-linen-drift-92";

let hash: string;

beforeAll(async () => {
  hash = await derivePasswordHash(PASSWORD);
}, 30_000);

describe("parsePasswordHash", () => {
  it("reads back what it wrote", () => {
    const parsed = parsePasswordHash(hash);
    expect(parsed).toMatchObject({ iterations: MINIMUM_ITERATIONS, hashBytes: 32 });
    expect(parsed?.salt).toHaveLength(16);
  });

  it("rejects a hash with too few iterations to be worth anything", () => {
    const [, salt, digest] = hash.split(":");
    expect(parsePasswordHash(`1000:${salt}:${digest}`)).toBeNull();
  });

  it("rejects an iteration count that is not a number", () => {
    const [, salt, digest] = hash.split(":");
    expect(parsePasswordHash(`many:${salt}:${digest}`)).toBeNull();
  });

  it.each([
    ["nothing at all", undefined],
    ["an empty secret", ""],
    ["a bare password", PASSWORD],
    ["a missing field", "100000:c2FsdA=="],
    ["an extra field", `${hash}:extra`],
  ])("rejects %s", (_case, value) => {
    expect(parsePasswordHash(value as string | undefined)).toBeNull();
  });

  it("rejects a salt that is not base64", () => {
    const [iterations, , digest] = hash.split(":");
    expect(parsePasswordHash(`${iterations}:not base64!:${digest}`)).toBeNull();
  });
});

describe("verifyPassword", () => {
  it("accepts the password the hash was made from", async () => {
    await expect(verifyPassword(PASSWORD, hash)).resolves.toBe(true);
  });

  it("tolerates the whitespace a copied secret arrives with", async () => {
    await expect(verifyPassword(PASSWORD, ` ${hash}\n`)).resolves.toBe(true);
  });

  it("rejects a wrong password", async () => {
    await expect(verifyPassword("amber-linen-drift-93", hash)).resolves.toBe(false);
  });

  it("rejects a password that is merely a prefix of the real one", async () => {
    await expect(verifyPassword("amber-linen", hash)).resolves.toBe(false);
  });

  it("rejects an empty password", async () => {
    await expect(verifyPassword("", hash)).resolves.toBe(false);
  });

  it("rejects the right password against a hash it cannot read", async () => {
    await expect(verifyPassword(PASSWORD, "not-a-hash")).resolves.toBe(false);
  });

  it("gives two hashes of the same password different salts", async () => {
    const again = await derivePasswordHash(PASSWORD);
    expect(again).not.toEqual(hash);
    await expect(verifyPassword(PASSWORD, again)).resolves.toBe(true);
  });
});

/**
 * The generator hashes with node:crypto and the Worker verifies with WebCrypto.
 * They agree on the format by hand, so this checks it rather than trusting it —
 * a password nobody can sign in with would otherwise only show up in production.
 */
it("signs in with a hash produced by scripts/make-admin-password.mjs", async () => {
  const script = path.join(process.cwd(), "scripts/make-admin-password.mjs");
  const printed = execFileSync(process.execPath, [script, PASSWORD], {
    encoding: "utf8",
  }).trim();

  await expect(verifyPassword(PASSWORD, printed)).resolves.toBe(true);
  await expect(verifyPassword("something-else", printed)).resolves.toBe(false);
}, 30_000);
