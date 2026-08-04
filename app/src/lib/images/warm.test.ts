import { describe, expect, it, vi } from "vitest";
import { createMemoryImageStore } from "./store";
import { imageKey } from "./source";
import { warmImages } from "./warm";

const CDN = "https://fg-image.fashiongo.net/Vendors/x/ProductImage/large";
const sources = Array.from({ length: 5 }, (_, index) => `${CDN}/${index}.jpg`);

function photo(bytes = 32) {
  return new Response(new ArrayBuffer(bytes), {
    headers: { "content-type": "image/jpeg" },
  });
}

describe("warmImages", () => {
  it("downloads the photos and reports being done", async () => {
    const fetchSource = vi.fn(async () => photo());
    const result = await warmImages({
      store: createMemoryImageStore(),
      sources,
      batch: 10,
      fetchSource,
    });

    expect(result).toMatchObject({ downloaded: 5, skipped: 0, failed: 0, done: true });
    expect(fetchSource).toHaveBeenCalledTimes(5);
  });

  it("stops at the batch size and hands back a cursor", async () => {
    const fetchSource = vi.fn(async () => photo());
    const store = createMemoryImageStore();

    const first = await warmImages({ store, sources, batch: 2, fetchSource });
    expect(first).toMatchObject({ downloaded: 2, cursor: 2, done: false });

    const second = await warmImages({
      store,
      sources,
      batch: 2,
      cursor: first.cursor,
      fetchSource,
    });
    expect(second).toMatchObject({ downloaded: 2, cursor: 4, done: false });
    expect(fetchSource).toHaveBeenCalledTimes(4);
  });

  it("finishes the catalog across successive calls", async () => {
    const store = createMemoryImageStore();
    const fetchSource = vi.fn(async () => photo());

    let cursor = 0;
    let guard = 0;
    let done = false;
    while (!done && guard++ < 10) {
      const result = await warmImages({ store, sources, batch: 2, cursor, fetchSource });
      cursor = result.cursor;
      done = result.done;
    }

    expect(done).toBe(true);
    expect(fetchSource).toHaveBeenCalledTimes(5);
  });

  it("downloads nothing on a second pass over an unchanged catalog", async () => {
    const store = createMemoryImageStore();
    await warmImages({ store, sources, batch: 10, fetchSource: async () => photo() });

    const fetchSource = vi.fn(async () => photo());
    const again = await warmImages({ store, sources, batch: 10, fetchSource });

    expect(again).toMatchObject({ downloaded: 0, skipped: 5, done: true });
    expect(fetchSource).not.toHaveBeenCalled();
  });

  it("only spends its batch on photos that are missing", async () => {
    const store = createMemoryImageStore();
    // Three of the five are already here.
    for (const source of sources.slice(0, 3)) {
      await store.put(imageKey(source), new ArrayBuffer(8), "image/jpeg");
    }

    const fetchSource = vi.fn(async () => photo());
    const result = await warmImages({ store, sources, batch: 2, fetchSource });

    expect(result).toMatchObject({ downloaded: 2, skipped: 3, done: true });
  });

  it("leaves a photo that will not download for a later run", async () => {
    const store = createMemoryImageStore();
    const fetchSource = vi.fn(async (url: string) =>
      url.endsWith("2.jpg") ? new Response("nope", { status: 500 }) : photo(),
    );

    const result = await warmImages({ store, sources, batch: 10, fetchSource });

    expect(result).toMatchObject({ downloaded: 4, failed: 1, done: true });
    expect(await store.has(imageKey(sources[2]))).toBe(false);
  });

  it("survives a download that throws", async () => {
    const store = createMemoryImageStore();
    const fetchSource = vi.fn(async (url: string) => {
      if (url.endsWith("1.jpg")) throw new Error("network");
      return photo();
    });

    const result = await warmImages({ store, sources, batch: 10, fetchSource });
    expect(result).toMatchObject({ downloaded: 4, failed: 1, done: true });
  });

  it("refuses a response too large to be a product photo", async () => {
    const store = createMemoryImageStore();
    const huge = async () =>
      new Response(new ArrayBuffer(11 * 1024 * 1024), {
        headers: { "content-type": "image/jpeg" },
      });

    const result = await warmImages({ store, sources: [sources[0]], batch: 5, fetchSource: huge });
    expect(result).toMatchObject({ downloaded: 0, failed: 1 });
  });

  it("is done immediately for an empty catalog", async () => {
    const result = await warmImages({
      store: createMemoryImageStore(),
      sources: [],
      batch: 10,
    });
    expect(result).toMatchObject({ done: true, total: 0, cursor: 0 });
  });

  it("treats a cursor past the end as finished", async () => {
    const fetchSource = vi.fn(async () => photo());
    const result = await warmImages({
      store: createMemoryImageStore(),
      sources,
      batch: 10,
      cursor: 99,
      fetchSource,
    });

    expect(result).toMatchObject({ done: true, downloaded: 0 });
    expect(fetchSource).not.toHaveBeenCalled();
  });
});
