import { beforeAll, describe, expect, it } from "vitest";
import {
  adminGate,
  authorizeAdminPassword,
  isTeamSession,
  newSessionToken,
  readAdminConfig,
  sessionCookieOptions,
  type AdminConfig,
} from "./auth";
import { derivePasswordHash } from "./password";

const PASSWORD = "amber-linen-drift-92";
const NOW = new Date("2026-08-04T12:00:00.000Z");

let passwordHash: string;

function config(overrides: Partial<AdminConfig> = {}): AdminConfig {
  return {
    passwordHash: undefined,
    sessionSecret: undefined,
    isProduction: true,
    ...overrides,
  };
}

function daysLater(days: number): Date {
  return new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);
}

beforeAll(async () => {
  passwordHash = await derivePasswordHash(PASSWORD);
}, 30_000);

describe("adminGate", () => {
  it("asks for the password once one is configured", () => {
    expect(adminGate(config({ passwordHash }))).toBe("password");
  });

  it("lets a local development server work with nothing configured", () => {
    expect(adminGate(config({ isProduction: false }))).toBe("open");
  });

  it("refuses to be an open door once deployed", () => {
    expect(adminGate(config())).toBe("unconfigured");
  });

  it("treats a blank secret as no secret at all", () => {
    expect(adminGate(config({ passwordHash: "   " }))).toBe("unconfigured");
  });

  it("still asks for the password in development once one is set", () => {
    expect(adminGate(config({ passwordHash, isProduction: false }))).toBe("password");
  });
});

describe("authorizeAdminPassword", () => {
  it("accepts the configured password", async () => {
    await expect(authorizeAdminPassword(PASSWORD, config({ passwordHash }))).resolves.toEqual(
      { ok: true },
    );
  });

  it("rejects a wrong password", async () => {
    const result = await authorizeAdminPassword("guess", config({ passwordHash }));
    expect(result).toMatchObject({ ok: false, status: 401 });
  });

  it("says so, rather than letting anyone in, when deployed with no password", async () => {
    const result = await authorizeAdminPassword("anything", config());
    expect(result).toMatchObject({ ok: false, status: 503 });
    expect(result).toHaveProperty("error", expect.stringContaining("ADMIN_PASSWORD_HASH"));
  });

  it("lets an unconfigured development server in", async () => {
    await expect(
      authorizeAdminPassword("anything", config({ isProduction: false })),
    ).resolves.toEqual({ ok: true });
  });
});

describe("isTeamSession", () => {
  it("recognises the cookie handed out at sign-in", async () => {
    const settings = config({ passwordHash });
    const token = await newSessionToken(settings, NOW);

    await expect(isTeamSession(token, settings, NOW)).resolves.toBe(true);
  });

  it("turns a visitor with no cookie into a client", async () => {
    await expect(isTeamSession(undefined, config({ passwordHash }), NOW)).resolves.toBe(
      false,
    );
  });

  it("expires the cookie rather than trusting it forever", async () => {
    const settings = config({ passwordHash });
    const token = await newSessionToken(settings, NOW);

    await expect(isTeamSession(token, settings, daysLater(31))).resolves.toBe(false);
  });

  it("signs everyone out when the password is changed", async () => {
    const token = await newSessionToken(config({ passwordHash }), NOW);
    const newHash = await derivePasswordHash("copper-willow-market-58");

    await expect(isTeamSession(token, config({ passwordHash: newHash }), NOW)).resolves.toBe(
      false,
    );
  });

  it("signs with ADMIN_SESSION_SECRET when there is one, so the two do not depend", async () => {
    const settings = config({ passwordHash, sessionSecret: "a-separate-secret" });
    const token = await newSessionToken(settings, NOW);

    await expect(isTeamSession(token, settings, NOW)).resolves.toBe(true);
    await expect(isTeamSession(token, config({ passwordHash }), NOW)).resolves.toBe(false);
  });

  it("treats everyone as the team on an unconfigured development server", async () => {
    await expect(
      isTeamSession(undefined, config({ isProduction: false }), NOW),
    ).resolves.toBe(true);
  });

  it("trusts nobody when deployed with no password, cookie or not", async () => {
    const token = await newSessionToken(config({ passwordHash }), NOW);
    await expect(isTeamSession(token, config(), NOW)).resolves.toBe(false);
  });
});

describe("the session cookie", () => {
  it("is one the page's JavaScript cannot read and a client cannot forge", () => {
    expect(sessionCookieOptions()).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });
  });

  it("lasts a month", () => {
    expect(sessionCookieOptions().maxAge).toBe(30 * 24 * 60 * 60);
  });
});

describe("readAdminConfig", () => {
  it("takes the secrets from the environment the Worker was given", () => {
    expect(
      readAdminConfig({
        ADMIN_PASSWORD_HASH: passwordHash,
        ADMIN_SESSION_SECRET: "s",
        NODE_ENV: "production",
      } as NodeJS.ProcessEnv),
    ).toEqual({
      passwordHash,
      sessionSecret: "s",
      isProduction: true,
    });
  });
});
