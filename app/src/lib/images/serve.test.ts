import { describe, expect, it, vi } from "vitest";
import { serveImage } from "./serve";
import { imageKey } from "./source";
import { createMemoryImageStore } from "./store";

const source =
  "https://fg-image.fashiongo.net/Vendors/6qj6odi0wz/ProductImage/large/9EDE/26144615_a.jpg";
const key = imageKey(source);

function upstream(body = "photo", contentType = "image/jpeg") {
  return vi.fn(async () =>
    new Response(body, { headers: { "content-type": contentType } }),
  );
}

/** The catalog, as far as this route is concerned: keys we made, and nothing else. */
const fromCatalog = async (wanted: string) => (wanted === key ? source : null);

describe("serving a product photo", () => {
  it("downloads it once and serves it from storage afterwards", async () => {
    const store = createMemoryImageStore();
    const fetchSource = upstream();

    const first = await serveImage(key, { store, resolveSource: fromCatalog, fetchSource });
    expect(first.status).toBe(200);
    expect(await first.text()).toBe("photo");
    expect(fetchSource).toHaveBeenCalledTimes(1);
    expect(fetchSource).toHaveBeenCalledWith(source);

    const second = await serveImage(key, { store, resolveSource: fromCatalog, fetchSource });
    expect(await second.text()).toBe("photo");
    // The point of the whole exercise: FashionGo is asked once, not per view.
    expect(fetchSource).toHaveBeenCalledTimes(1);
  });

  it("lets browsers keep it forever, because a key never changes content", async () => {
    const response = await serveImage(key, {
      store: createMemoryImageStore(),
      resolveSource: fromCatalog,
      fetchSource: upstream(),
    });
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=31536000, immutable",
    );
  });

  it("keeps the content type the CDN sent", async () => {
    const response = await serveImage(key, {
      store: createMemoryImageStore(),
      resolveSource: fromCatalog,
      fetchSource: upstream("photo", "image/webp; charset=binary"),
    });
    expect(response.headers.get("content-type")).toBe("image/webp");
  });

  it("serves an image type even when the CDN claims something else", async () => {
    const response = await serveImage(key, {
      store: createMemoryImageStore(),
      resolveSource: fromCatalog,
      fetchSource: upstream("<script>", "text/html"),
    });
    expect(response.headers.get("content-type")).toBe("image/jpeg");
  });

  it("does not ask the catalog at all when the photo is already stored", async () => {
    const store = createMemoryImageStore();
    await store.put(key, new TextEncoder().encode("stored").buffer as ArrayBuffer, "image/png");
    const resolveSource = vi.fn(fromCatalog);
    const fetchSource = upstream();

    const response = await serveImage(key, { store, resolveSource, fetchSource });
    expect(await response.text()).toBe("stored");
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(resolveSource).not.toHaveBeenCalled();
    expect(fetchSource).not.toHaveBeenCalled();
  });
});

describe("what /i refuses to do", () => {
  it("downloads nothing for a key the catalog does not know", async () => {
    const fetchSource = upstream();
    const response = await serveImage("0".repeat(32), {
      store: createMemoryImageStore(),
      resolveSource: fromCatalog,
      fetchSource,
    });
    expect(response.status).toBe(404);
    expect(fetchSource).not.toHaveBeenCalled();
  });

  it("downloads nothing for something that is not a key", async () => {
    const fetchSource = upstream();
    for (const bad of ["../secrets", "https://evil.example/x.jpg", ""]) {
      const response = await serveImage(bad, {
        store: createMemoryImageStore(),
        resolveSource: fromCatalog,
        fetchSource,
      });
      expect(response.status, bad).toBe(404);
    }
    expect(fetchSource).not.toHaveBeenCalled();
  });

  it("downloads nothing from outside FashionGo, whatever the catalog says", async () => {
    // Belt and braces with the mapping and the sync validation: even if an
    // address from somewhere else made it into the store, /i will not fetch it.
    const fetchSource = upstream();
    const response = await serveImage(key, {
      store: createMemoryImageStore(),
      resolveSource: async () => "https://evil.example/x.jpg",
      fetchSource,
    });
    expect(response.status).toBe(404);
    expect(fetchSource).not.toHaveBeenCalled();
  });

  it("does not cache a failed download, so an outage is not permanent", async () => {
    const store = createMemoryImageStore();
    const failing = vi.fn(async () => new Response("nope", { status: 500 }));
    const first = await serveImage(key, {
      store,
      resolveSource: fromCatalog,
      fetchSource: failing,
    });
    expect(first.status).toBe(502);
    expect(first.headers.get("cache-control")).toBe("no-store");

    const recovered = await serveImage(key, {
      store,
      resolveSource: fromCatalog,
      fetchSource: upstream(),
    });
    expect(recovered.status).toBe(200);
  });

  it("survives the CDN being unreachable", async () => {
    const response = await serveImage(key, {
      store: createMemoryImageStore(),
      resolveSource: fromCatalog,
      fetchSource: async () => {
        throw new Error("connection refused");
      },
    });
    expect(response.status).toBe(502);
  });

  it("refuses a download that is too big to be a product photo", async () => {
    const response = await serveImage(key, {
      store: createMemoryImageStore(),
      resolveSource: fromCatalog,
      fetchSource: async () =>
        new Response(new Uint8Array(11 * 1024 * 1024), {
          headers: { "content-type": "image/jpeg" },
        }),
    });
    expect(response.status).toBe(502);
  });
});
