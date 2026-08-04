import { describe, expect, it } from "vitest";
import { createMemoryStore } from "./store";
import { seedProducts } from "./seed";
import type { Product } from "./types";

const replacement: Product[] = [
  {
    sku: "NEW-1",
    name: "Only Product",
    price: 10,
    category: "Tops",
    colors: [],
    images: [],
    createdAt: "2026-08-01T00:00:00.000Z",
    sourceId: 1,
  },
];

describe("catalog store", () => {
  it("starts from the seed catalog so the site is never empty", async () => {
    const store = createMemoryStore();
    const catalog = await store.read();
    expect(catalog.products).toHaveLength(seedProducts().length);
  });

  it("replaces the whole catalog on sync, mirroring FashionGo", async () => {
    const store = createMemoryStore();
    await store.replace(replacement);
    const catalog = await store.read();
    expect(catalog.products.map((p) => p.sku)).toEqual(["NEW-1"]);
  });

  it("records when the sync happened", async () => {
    const store = createMemoryStore();
    const before = Date.now();
    const { syncedAt } = await store.replace(replacement);
    expect(new Date(syncedAt).getTime()).toBeGreaterThanOrEqual(before);
  });
});
