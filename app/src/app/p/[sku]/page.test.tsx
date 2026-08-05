import { beforeEach, describe, expect, it, vi } from "vitest";
import { hiddenStyles } from "@/lib/catalog/hidden";
import type { PublicProduct } from "@/lib/catalog/public";
import { catalogStore } from "@/lib/catalog/store";
import type { Product } from "@/lib/catalog/types";
import ProductPage, { generateMetadata } from "./page";

/**
 * A style has an address of its own, which is the address that gets pasted into
 * a chat. Hiding a style has to close that address as well, or the whole thing
 * amounts to leaving the door open and taking the sign off it.
 */
const { isTeamViewer } = vi.hoisted(() => ({ isTeamViewer: vi.fn() }));
vi.mock("@/lib/admin/request", () => ({ isTeamViewer }));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

/** Enough of a request for the preview card to be built from. */
vi.mock("next/headers", () => ({
  headers: async () => new Map([["host", "itoo.example"]]),
}));

function stored(sku: string, name: string): Product {
  return {
    sku,
    name,
    price: 19.75,
    category: "Tops",
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
  ]);
  const styles = await hiddenStyles();
  for (const sku of await styles.list()) await styles.show(sku);
});

async function open(slug: string) {
  const element = await ProductPage({
    params: Promise.resolve({ sku: slug }),
    searchParams: Promise.resolve({}),
  });
  return element.props as { products: PublicProduct[]; openSku?: string | null };
}

describe("a style at its own address", () => {
  it("opens for a client while it is in the catalog", async () => {
    expect((await open("y-542")).openSku).toBe("Y-542");
  });

  it("is a 404 for a client once the team hides it", async () => {
    (await hiddenStyles()).hide("Y-542", "2026-08-04T10:00:00.000Z");

    await expect(open("y-542")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("opens again for a client once the team puts it back", async () => {
    const styles = await hiddenStyles();
    await styles.hide("Y-542", "2026-08-04T10:00:00.000Z");
    await styles.show("Y-542");

    expect((await open("y-542")).openSku).toBe("Y-542");
  });

  it("still opens for the team, so there is somewhere to press to undo it", async () => {
    isTeamViewer.mockResolvedValue(true);
    await (await hiddenStyles()).hide("Y-542", "2026-08-04T10:00:00.000Z");

    const page = await open("y-542");
    expect(page.openSku).toBe("Y-542");
    expect(page.products.find((product) => product.sku === "Y-542")?.isHidden).toBe(true);
  });

  it("takes the hidden style out of the catalog behind it as well", async () => {
    await (await hiddenStyles()).hide("Y-542", "2026-08-04T10:00:00.000Z");

    // Opening a style that is still on sale must not hand the client the hidden
    // one in the grid behind the photograph.
    const page = await open("wp-2160");
    expect(page.products.map((product) => product.sku)).toEqual(["WP-2160"]);
    expect(JSON.stringify(page.products)).not.toContain("Y-542");
  });

  it("unfurls into nothing in a chat, rather than into its name and photo", async () => {
    await (await hiddenStyles()).hide("Y-542", "2026-08-04T10:00:00.000Z");

    // A link already sent is still in somebody's chat, and the preview card is
    // fetched fresh every time it is shown.
    const meta = await generateMetadata({
      params: Promise.resolve({ sku: "y-542" }),
      searchParams: Promise.resolve({}),
    });
    expect(meta).toEqual({});
    expect(JSON.stringify(meta)).not.toContain("Romantic Lace Top");
  });

  it("still unfurls for a style that is on sale", async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ sku: "y-542" }),
      searchParams: Promise.resolve({}),
    });
    expect(meta.title).toContain("Romantic Lace Top");
  });
});
