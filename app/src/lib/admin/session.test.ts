import { describe, expect, it } from "vitest";
import { SESSION_DAYS, sessionExpiry, signSession, verifySession } from "./session";

const KEY = "100000:c2FsdA==:aGFzaA==";
const NOW = new Date("2026-08-04T12:00:00.000Z");

function daysLater(days: number): Date {
  return new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);
}

describe("verifySession", () => {
  it("accepts a cookie it signed itself", async () => {
    const token = await signSession(sessionExpiry(NOW), KEY);
    await expect(verifySession(token, KEY, NOW)).resolves.toBe(true);
  });

  it("keeps the team signed in for a month of ordinary use", async () => {
    const token = await signSession(sessionExpiry(NOW), KEY);
    await expect(verifySession(token, KEY, daysLater(SESSION_DAYS - 1))).resolves.toBe(true);
  });

  it("stops accepting it once it has run out", async () => {
    const token = await signSession(sessionExpiry(NOW), KEY);
    await expect(verifySession(token, KEY, daysLater(SESSION_DAYS + 1))).resolves.toBe(
      false,
    );
  });

  it("refuses a cookie whose expiry was pushed out by hand", async () => {
    const token = await signSession(sessionExpiry(NOW), KEY);
    const [, signature] = token.split(".");
    const stretched = `${daysLater(3650).getTime()}.${signature}`;

    await expect(verifySession(stretched, KEY, NOW)).resolves.toBe(false);
  });

  it("refuses a cookie signed with a different key", async () => {
    const token = await signSession(sessionExpiry(NOW), "another-secret");
    await expect(verifySession(token, KEY, NOW)).resolves.toBe(false);
  });

  it("refuses a tampered signature", async () => {
    const token = await signSession(sessionExpiry(NOW), KEY);
    const [stamp, signature] = token.split(".");
    const flipped = signature.startsWith("A") ? `B${signature.slice(1)}` : `A${signature.slice(1)}`;

    await expect(verifySession(`${stamp}.${flipped}`, KEY, NOW)).resolves.toBe(false);
  });

  it.each([
    ["no cookie", undefined],
    ["an empty cookie", ""],
    ["a value with no signature", "1785000000000"],
    ["a value with too many parts", "1785000000000.aaa.bbb"],
    ["an expiry that is not a number", "soon.aaa"],
  ])("refuses %s", async (_case, token) => {
    await expect(verifySession(token as string | undefined, KEY, NOW)).resolves.toBe(false);
  });

  it("puts nothing but the expiry in the cookie", async () => {
    const token = await signSession(sessionExpiry(NOW), KEY);
    expect(token).not.toContain(KEY);
    expect(token.split(".")[0]).toBe(String(sessionExpiry(NOW).getTime()));
  });
});
