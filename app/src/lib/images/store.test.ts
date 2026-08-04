import { describe, expect, it } from "vitest";
import { createMemoryImageStore, createR2ImageStore, imageStore } from "./store";

const photo = new TextEncoder().encode("jpeg-bytes").buffer as ArrayBuffer;

/** Enough of R2 to run the store against, with a record of what it was told. */
function fakeBucket() {
  const objects = new Map<string, { body: ArrayBuffer; contentType?: string }>();
  return {
    objects,
    async get(key: string) {
      const stored = objects.get(key);
      if (!stored) return null;
      return {
        body: new Response(stored.body).body,
        httpMetadata: { contentType: stored.contentType },
      };
    },
    async put(
      key: string,
      value: ArrayBuffer,
      options?: { httpMetadata?: { contentType?: string } },
    ) {
      objects.set(key, { body: value, contentType: options?.httpMetadata?.contentType });
    },
    async head(key: string) {
      return objects.get(key) ?? null;
    },
  };
}

describe("the R2 image store", () => {
  it("reports whether a photo is there without reading it back", async () => {
    const bucket = fakeBucket();
    const store = createR2ImageStore(bucket);

    expect(await store.has("abc")).toBe(false);
    await store.put("abc", photo, "image/jpeg");
    expect(await store.has("abc")).toBe(true);
  });

  it("returns nothing for a photo it has never been given", async () => {
    const store = createR2ImageStore(fakeBucket());
    expect(await store.get("missing")).toBeNull();
  });

  it("serves back what it stored, with the content type it was given", async () => {
    const bucket = fakeBucket();
    const store = createR2ImageStore(bucket);
    await store.put("abc", photo, "image/webp");

    const response = await store.get("abc");
    expect(response?.headers.get("content-type")).toBe("image/webp");
    expect(await response?.text()).toBe("jpeg-bytes");
    expect(bucket.objects.has("abc")).toBe(true);
  });
});

describe("the in-memory fallback", () => {
  it("serves the same photo more than once", async () => {
    const store = createMemoryImageStore();
    await store.put("abc", photo, "image/jpeg");

    expect(await (await store.get("abc"))?.text()).toBe("jpeg-bytes");
    expect(await (await store.get("abc"))?.text()).toBe("jpeg-bytes");
  });

  it("drops the oldest photos rather than growing without limit", async () => {
    // An isolate has to render the catalog with the same memory, so the cache
    // is capped: a forgotten photo costs one download, running out costs the site.
    const store = createMemoryImageStore(photo.byteLength * 2);
    await store.put("first", photo, "image/jpeg");
    await store.put("second", photo, "image/jpeg");
    await store.put("third", photo, "image/jpeg");

    expect(await store.get("first")).toBeNull();
    expect(await store.get("third")).not.toBeNull();
  });

  it("refuses a photo that would fill the cache on its own", async () => {
    const store = createMemoryImageStore(1);
    await store.put("huge", photo, "image/jpeg");
    expect(await store.get("huge")).toBeNull();
  });
});

describe("choosing a store", () => {
  it("falls back to memory when no bucket is bound", async () => {
    // There is no Cloudflare context here at all, which is exactly the case
    // this has to survive: the site works before the bucket is provisioned.
    const store = await imageStore();
    await store.put("abc", photo, "image/jpeg");
    expect(await (await store.get("abc"))?.text()).toBe("jpeg-bytes");
  });
});
