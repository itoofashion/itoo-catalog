import { describe, expect, it } from "vitest";
import { CODE_ALPHABET, CODE_LENGTH, isShortCode, randomCode } from "./code";

describe("short link codes", () => {
  it("is six characters, which is what the client asked for", () => {
    expect(CODE_LENGTH).toBe(6);
    expect(randomCode()).toHaveLength(6);
  });

  it("uses only the alphabet, over many draws", () => {
    for (let draw = 0; draw < 500; draw += 1) {
      expect(randomCode()).toMatch(/^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{6}$/);
    }
  });

  it("leaves out the characters people mix up when reading a link aloud", () => {
    // The reason for the alphabet: a code gets dictated over the phone.
    for (const confusable of ["0", "O", "1", "I", "L", "U"]) {
      expect(CODE_ALPHABET).not.toContain(confusable);
    }
    // And it is one case, so "capital B or small b" never comes up.
    expect(CODE_ALPHABET).toBe(CODE_ALPHABET.toUpperCase());
  });

  it("draws a longer code when asked for one", () => {
    // How a run of collisions is answered: a character more, not an error.
    expect(randomCode(7)).toHaveLength(7);
    expect(randomCode(9)).toHaveLength(9);
  });

  it("does not repeat itself", () => {
    const drawn = new Set(Array.from({ length: 200 }, () => randomCode()));
    expect(drawn.size).toBe(200);
  });

  it("spreads over the whole alphabet rather than favouring its start", () => {
    // Sampling bytes with a plain remainder would make the first sixteen
    // letters turn up about a third more often than the rest.
    const seen = new Set<string>();
    for (let draw = 0; draw < 400; draw += 1) {
      for (const character of randomCode()) seen.add(character);
    }
    expect(seen.size).toBe(CODE_ALPHABET.length);
  });

  it("recognises its own shape and nothing else", () => {
    expect(isShortCode("K7M2QP")).toBe(true);
    expect(isShortCode("k7m2qp")).toBe(false);
    expect(isShortCode("RHJlc3Nlc35DbHV0Y2hlcw")).toBe(false);
    expect(isShortCode("../etc")).toBe(false);
    expect(isShortCode("")).toBe(false);
  });
});
