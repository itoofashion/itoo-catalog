import { describe, expect, it } from "vitest";
import { authorizeSync, SYNC_SECRET_HEADER } from "./auth";

function request(secret?: string) {
  return new Request("https://example.test/api/sync", {
    method: "POST",
    headers: secret ? { [SYNC_SECRET_HEADER]: secret } : {},
  });
}

describe("authorizeSync", () => {
  it("accepts the importer when it presents the configured secret", () => {
    expect(
      authorizeSync(request("s3cret"), { secret: "s3cret", isProduction: true }),
    ).toEqual({ ok: true });
  });

  it("rejects a request with no secret", () => {
    const result = authorizeSync(request(), { secret: "s3cret", isProduction: true });
    expect(result).toEqual({
      ok: false,
      status: 401,
      error: "Wrong or missing sync secret.",
    });
  });

  it("rejects a wrong secret", () => {
    const result = authorizeSync(request("guess"), { secret: "s3cret", isProduction: true });
    expect(result.ok).toBe(false);
  });

  it("rejects a secret that is merely a prefix of the real one", () => {
    const result = authorizeSync(request("s3c"), { secret: "s3cret", isProduction: true });
    expect(result.ok).toBe(false);
  });

  it("refuses to sync at all when deployed without a secret configured", () => {
    const result = authorizeSync(request("anything"), {
      secret: undefined,
      isProduction: true,
    });
    expect(result).toMatchObject({ ok: false, status: 503 });
  });

  it("allows a local development server that has nothing configured", () => {
    expect(authorizeSync(request(), { secret: undefined, isProduction: false })).toEqual({
      ok: true,
    });
  });

  it("still enforces a secret in development once one is set", () => {
    expect(authorizeSync(request(), { secret: "s3cret", isProduction: false }).ok).toBe(
      false,
    );
  });

  it("ignores whitespace around the secret on both sides", () => {
    expect(
      authorizeSync(request(" s3cret "), { secret: "s3cret ", isProduction: true }),
    ).toEqual({ ok: true });
  });
});
