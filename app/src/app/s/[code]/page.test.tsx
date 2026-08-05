import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogSelection } from "@/lib/catalog/share";
import { createShortLink } from "@/lib/links/shorten";
import { linkStore } from "@/lib/links/store";
import ShortLinkPage from "./page";

/**
 * The page is checked by what it hands the catalog rather than by rendering it:
 * what matters here is that a code is looked up, and that an unknown one is a
 * 404. How the catalog draws a selection is catalog-view's own test.
 */
const { isTeamViewer } = vi.hoisted(() => ({ isTeamViewer: vi.fn() }));
vi.mock("@/lib/admin/request", () => ({ isTeamViewer }));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

beforeEach(() => isTeamViewer.mockResolvedValue(false));

async function open(code: string) {
  const element = await ShortLinkPage({ params: Promise.resolve({ code }) });
  return element.props as { selection: CatalogSelection; readOnlyAddress?: boolean };
}

describe("a short link", () => {
  it("opens the selection its code was minted for", async () => {
    const selection = { categories: ["Dresses"], skus: ["8980"] };
    const code = await createShortLink(selection, await linkStore());

    expect((await open(code)).selection).toEqual(selection);
  });

  it("keeps the address as the short link while the client browses", async () => {
    const code = await createShortLink({ categories: ["Tops"], skus: [] }, await linkStore());

    expect((await open(code)).readOnlyAddress).toBe(true);
  });

  it("is a 404 when nobody ever minted that code", async () => {
    // Not an empty catalog and not the whole catalog: a wrong code is a wrong
    // link, and a client must never be shown the entire line sheet by accident.
    await expect(open("ZZZZZZ")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("is a 404 for something that is not a code at all", async () => {
    await expect(open("hello")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("still opens a long code sent before there was a database", async () => {
    expect((await open("RHJlc3Nlc35DbHV0Y2hlcyAmIFBvdWNoZXMhODk4MH5XUC0yMTYw")).selection).toEqual({
      categories: ["Dresses", "Clutches & Pouches"],
      skus: ["8980", "WP-2160"],
    });
  });
});
