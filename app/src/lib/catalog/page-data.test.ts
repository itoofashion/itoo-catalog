import { beforeEach, describe, expect, it, vi } from "vitest";
import { hiddenStyles } from "./hidden";
import { catalogMetadata, publishedCatalog } from "./page-data";
import { catalogStore } from "./store";
import type { Product } from "./types";

/**
 * The one gate every route goes through, which is why hiding is done here.
 *
 * The catalog page, a short link and a style's own address all take their
 * products from publishedCatalog, so a style dropped here is a style dropped
 * everywhere at once. Doing it in each route instead would mean the next route
 * anybody adds quietly opts out of hiding.
 */
const { isTeamViewer } = vi.hoisted(() => ({ isTeamViewer: vi.fn() }));
vi.mock("@/lib/admin/request", () => ({ isTeamViewer }));

vi.mock("next/headers", () => ({
  headers: async () => new Map([["host", "itoo.example"]]),
}));

function stored(sku: string, name: string, category = "Tops"): Product {
  return {
    sku,
    name,
    price: 19.75,
    category,
    colors: ["Beige"],
    images: [
      {
        url: "/i/0123456789abcdef0123456789abcdef",
        sourceUrl: "https://fg-image.fashiongo.net/Vendors/x/ProductImage/large/1_a.jpg",
        color: "Beige",
      },
    ],
    sizes: ["S", "M", "L"],
    packBreakdown: [2, 2, 2],
    minimumUnits: 6,
    createdAt: "2026-07-28T15:02:43.153Z",
    sourceId: 1,
  };
}

beforeEach(async () => {
  isTeamViewer.mockReset().mockResolvedValue(false);
  await catalogStore.replace([
    stored("Y-542", "Romantic Lace Top"),
    stored("WP-2160", "Wide Leg Pant"),
    stored("D-100", "Slip Dress", "Dresses"),
  ]);
  const styles = await hiddenStyles();
  for (const sku of await styles.list()) await styles.show(sku);
});

async function hide(sku: string) {
  await (await hiddenStyles()).hide(sku, "2026-08-04T10:00:00.000Z");
}

describe("the catalog a client is handed", () => {
  it("holds everything while nothing is hidden", async () => {
    const { products } = await publishedCatalog();
    expect(products.map((product) => product.sku)).toEqual(["Y-542", "WP-2160", "D-100"]);
  });

  it("drops a hidden style", async () => {
    await hide("WP-2160");

    const { products } = await publishedCatalog();
    expect(products.map((product) => product.sku)).toEqual(["Y-542", "D-100"]);
  });

  it("carries no trace of a hidden style, not even its number", async () => {
    await hide("WP-2160");

    // The assertion that matters. A card the grid declines to draw has still
    // been sent to the browser and is readable by anyone who looks.
    const serialized = JSON.stringify(await publishedCatalog());
    expect(serialized).not.toContain("WP-2160");
    expect(serialized).not.toContain("Wide Leg Pant");
  });

  it("takes the style back once the team puts it back", async () => {
    await hide("WP-2160");
    await (await hiddenStyles()).show("WP-2160");

    const { products } = await publishedCatalog();
    expect(products.map((product) => product.sku)).toContain("WP-2160");
  });

  it("still says when the catalog was last synced", async () => {
    await hide("WP-2160");
    expect((await publishedCatalog()).syncedAt).toBeTruthy();
  });
});

describe("the catalog the team is handed", () => {
  beforeEach(() => isTeamViewer.mockResolvedValue(true));

  it("holds the hidden style, marked", async () => {
    await hide("WP-2160");

    const { products } = await publishedCatalog();
    expect(products.map((product) => product.sku)).toEqual(["Y-542", "WP-2160", "D-100"]);
    expect(products.find((product) => product.sku === "WP-2160")?.isHidden).toBe(true);
  });

  it("marks nothing else", async () => {
    await hide("WP-2160");

    const { products } = await publishedCatalog();
    expect(products.filter((product) => product.isHidden)).toHaveLength(1);
  });
});

describe("what a client's link unfurls into", () => {
  it("counts only the styles the link will actually show", async () => {
    await hide("WP-2160");

    const meta = await catalogMetadata({ categories: ["Tops"], skus: [] });
    // Two Tops in the catalog, one of them hidden. Promising two and showing
    // one is the kind of thing a wholesale client notices.
    expect(meta.description).toContain("1 style in Tops");
  });

  it("names no hidden style in the preview card", async () => {
    await hide("WP-2160");

    const meta = await catalogMetadata({ categories: [], skus: ["WP-2160"] });
    expect(JSON.stringify(meta)).not.toContain("Wide Leg Pant");
  });

  it("counts the whole catalog when nothing is hidden", async () => {
    const meta = await catalogMetadata({ categories: ["Tops"], skus: [] });
    expect(meta.description).toContain("2 styles in Tops");
  });
});
