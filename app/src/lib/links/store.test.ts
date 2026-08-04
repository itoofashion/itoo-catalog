import { describe, expect, it } from "vitest";
import { CODE_LENGTH, createMemoryLinkStore, generateCode, linkStore, type LinkStore } from "./store";

const selection = { categories: ["Tops"], skus: ["Y-542"] };

describe("generateCode", () => {
  it("is short enough to send in a chat message", () => {
    expect(generateCode()).toHaveLength(CODE_LENGTH);
  });

  it("avoids characters that are misread when spoken or typed", () => {
    const codes = Array.from({ length: 200 }, () => generateCode()).join("");
    expect(codes).not.toMatch(/[aeiou01lio]/);
  });

  it("varies", () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateCode()));
    expect(codes.size).toBeGreaterThan(40);
  });
});

describe("link store", () => {
  it("hands back a selection under its code", async () => {
    const store = createMemoryLinkStore();
    const code = await store.create(selection);
    await expect(store.resolve(code)).resolves.toEqual(selection);
  });

  it("returns nothing for a code it never issued", async () => {
    const store = createMemoryLinkStore();
    await expect(store.resolve("zzzzzz")).resolves.toBeNull();
  });

  it("reuses the code for a selection it already has", async () => {
    const store = createMemoryLinkStore();
    const first = await store.create(selection);
    const second = await store.create({ categories: ["Tops"], skus: ["Y-542"] });
    expect(second).toBe(first);
  });

  it("does not care what order the selection was built in", async () => {
    const store = createMemoryLinkStore();
    const first = await store.create({ categories: ["Tops", "Pants"], skus: [] });
    const second = await store.create({ categories: ["Pants", "Tops"], skus: [] });
    expect(second).toBe(first);
  });

  it("issues different codes for different selections", async () => {
    const store = createMemoryLinkStore();
    const first = await store.create(selection);
    const second = await store.create({ categories: [], skus: ["21034"] });
    expect(second).not.toBe(first);
  });

  it("forgives the casing and stray spaces of a pasted code", async () => {
    const store = createMemoryLinkStore();
    const code = await store.create(selection);
    await expect(store.resolve(` ${code.toUpperCase()} `)).resolves.toEqual(selection);
  });
});

describe("the shared link store", () => {
  it("is the same store for every copy of this module", async () => {
    const code = await linkStore.create({ categories: ["Shared"], skus: [] });

    const asAnotherBundleSeesIt = (
      globalThis as typeof globalThis & Record<symbol, LinkStore | undefined>
    )[Symbol.for("itoo.links.store")];

    expect(asAnotherBundleSeesIt, "link store is not shared globally").toBeDefined();
    await expect(asAnotherBundleSeesIt!.resolve(code)).resolves.toEqual({
      categories: ["Shared"],
      skus: [],
    });
  });
});
