import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogSelection } from "@/lib/catalog/share";
import { CODE_ALPHABET } from "./code";
import { encodeLegacyCode } from "./legacy";
import { createShortLink, resolveShortLink } from "./shorten";
import { createMemoryLinkStore, type LinkStore } from "./store";

/**
 * Codes are random, which is the point, so the tests that are about collisions
 * say which codes come up. Everything else leaves the queue empty and gets the
 * real generator, so those tests see genuine six-character codes.
 */
const { draws } = vi.hoisted(() => ({ draws: [] as string[] }));

vi.mock("./code", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./code")>();
  return {
    ...actual,
    randomCode: (length?: number) => draws.shift() ?? actual.randomCode(length),
  };
});

beforeEach(() => {
  draws.length = 0;
});

const dresses: CatalogSelection = { categories: ["Dresses"], skus: [] };
const tops: CatalogSelection = { categories: ["Tops"], skus: ["Y-542"] };

/** A code of one repeated character, as long as asked for: readable in a test. */
function repeated(character: string, length: number): string {
  return character.repeat(length);
}

describe("minting a short link", () => {
  it("is six characters from the spoken alphabet", async () => {
    const code = await createShortLink(dresses, createMemoryLinkStore());

    expect(code).toHaveLength(6);
    for (const character of code) expect(CODE_ALPHABET).toContain(character);
  });

  it("points the code at the selection it was made for", async () => {
    const store = createMemoryLinkStore();
    const code = await createShortLink(tops, store);

    expect(await resolveShortLink(code, store)).toEqual(tops);
  });

  it("gives the same selection the same code, however many times it is asked", async () => {
    // Otherwise every press of the button is a row, and the same catalog goes
    // out to one client under half a dozen addresses.
    const store = createMemoryLinkStore();

    const first = await createShortLink(dresses, store);
    const second = await createShortLink(dresses, store);
    const third = await createShortLink({ categories: ["Dresses"], skus: [] }, store);

    expect(second).toBe(first);
    expect(third).toBe(first);
  });

  it("does not care in what order the selection was ticked", async () => {
    const store = createMemoryLinkStore();
    const first = await createShortLink({ categories: ["Tops", "Dresses"], skus: [] }, store);
    const second = await createShortLink({ categories: ["Dresses", "Tops"], skus: [] }, store);

    expect(second).toBe(first);
  });

  it("gives different selections different codes", async () => {
    const store = createMemoryLinkStore();

    expect(await createShortLink(dresses, store)).not.toBe(await createShortLink(tops, store));
  });

  it("draws again when the code it drew is taken", async () => {
    const store = createMemoryLinkStore();
    await store.insert({
      code: "AAAAAA",
      fingerprint: "someone-else",
      selection: tops,
      createdAt: "2026-08-04T09:00:00.000Z",
    });

    draws.push("AAAAAA", "BBBBBB");
    expect(await createShortLink(dresses, store)).toBe("BBBBBB");
    expect(await resolveShortLink("AAAAAA", store)).toEqual(tops);
  });

  it("grows a character rather than failing when a length runs out of luck", async () => {
    const store = createMemoryLinkStore();
    const taken = ["A", "B", "C", "D", "E"];
    for (const character of taken) {
      await store.insert({
        code: repeated(character, 6),
        fingerprint: `taken-${character}`,
        selection: tops,
        createdAt: "2026-08-04T09:00:00.000Z",
      });
      draws.push(repeated(character, 6));
    }

    // The sixth draw is asked for seven characters, and that is the one that
    // gets written. Reaching this needs a table with millions of rows in it.
    const code = await createShortLink(dresses, store);
    expect(code).toHaveLength(7);
    expect(await resolveShortLink(code, store)).toEqual(dresses);
  });

  it("takes the code another isolate minted for the same selection", async () => {
    // The race the unique index exists for: two people press the button on the
    // same selection at once. They must end up sending the same link.
    const store = racingStore("W4XN9B");

    expect(await createShortLink(dresses, store)).toBe("W4XN9B");
  });

  it("refuses to mint a link for nothing at all", async () => {
    await expect(
      createShortLink({ categories: [], skus: [] }, createMemoryLinkStore()),
    ).rejects.toThrow();
  });

  it("records when the link was made", async () => {
    const written: string[] = [];
    const store = createMemoryLinkStore();
    const recording: LinkStore = {
      ...store,
      insert: async (link) => {
        written.push(link.createdAt);
        return store.insert(link);
      },
    };

    await createShortLink(dresses, recording, new Date("2026-08-04T10:11:12.000Z"));
    expect(written).toEqual(["2026-08-04T10:11:12.000Z"]);
  });
});

describe("opening a short link", () => {
  it("is nothing for a code nobody minted, which is a 404", async () => {
    expect(await resolveShortLink("ZZZZZZ", createMemoryLinkStore())).toBeNull();
    expect(await resolveShortLink("", createMemoryLinkStore())).toBeNull();
    expect(await resolveShortLink("../etc/passwd", createMemoryLinkStore())).toBeNull();
  });

  it("still opens the long codes sent before there was a database", async () => {
    // These are already in people's chats. The database has never heard of
    // them, and they decode on their own.
    const legacy = encodeLegacyCode({ categories: ["Dresses"], skus: ["8980"] });

    expect(await resolveShortLink(legacy, createMemoryLinkStore())).toEqual({
      categories: ["Dresses"],
      skus: ["8980"],
    });
  });

  it("opens the very link the client complained about", async () => {
    expect(
      await resolveShortLink(
        "RHJlc3Nlc35DbHV0Y2hlcyAmIFBvdWNoZXMhODk4MH5XUC0yMTYw",
        createMemoryLinkStore(),
      ),
    ).toEqual({ categories: ["Dresses", "Clutches & Pouches"], skus: ["8980", "WP-2160"] });
  });

  it("forgives a code typed in lower case after being read out", async () => {
    const store = createMemoryLinkStore();
    draws.push("K7M2QP");
    await createShortLink(dresses, store);

    expect(await resolveShortLink("k7m2qp", store)).toEqual(dresses);
  });

  it("forgives stray whitespace around a pasted code", async () => {
    const store = createMemoryLinkStore();
    const code = await createShortLink(dresses, store);

    expect(await resolveShortLink(`  ${code} `, store)).toEqual(dresses);
  });

  it("keeps opening the old links when the database is unreachable", async () => {
    // Which is also what happens in the window between a deploy and the
    // migration being applied.
    const broken: LinkStore = {
      findSelection: async () => {
        throw new Error("D1_ERROR: no such table: short_links");
      },
      findCode: async () => null,
      insert: async () => "stored",
    };
    const legacy = encodeLegacyCode(dresses);

    expect(await resolveShortLink(legacy, broken)).toEqual(dresses);
    expect(await resolveShortLink("K7M2QP", broken)).toBeNull();
  });

  it("prefers the database to the old decoder", async () => {
    // A stored code wins even if the characters happen to decode as base64.
    const store = createMemoryLinkStore();
    draws.push("K7M2QP");
    await createShortLink(tops, store);

    expect(await resolveShortLink("K7M2QP", store)).toEqual(tops);
  });
});

/**
 * A store that behaves as though another isolate wrote the same selection a
 * moment ago: the first lookup finds nothing, the write is refused, and the
 * code that comes back is theirs.
 */
function racingStore(theirCode: string): LinkStore {
  let raced = false;
  return {
    async findSelection() {
      return null;
    },
    async findCode() {
      return raced ? theirCode : null;
    },
    async insert() {
      raced = true;
      return "selection-stored";
    },
  };
}
