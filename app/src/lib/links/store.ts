import type { CatalogSelection } from "@/lib/catalog/share";

/**
 * Short links.
 *
 * A full selection spelled out in the query string is long and ugly in a chat
 * message, and a wholesale client judges the sender by it. So a selection can be
 * traded for a six-character code and sent as itoo.example/s/k3f9qa instead.
 *
 * Six characters over an alphabet of 32 is a billion combinations, against a few
 * thousand links a year — collisions are not a practical concern, and the store
 * retries anyway. The codes are unguessable enough that a stranger will not
 * stumble onto a client's selection, which is all the privacy this needs.
 *
 * Like the catalog itself, the pilot keeps these in memory; Milestone 2 puts
 * them in D1 behind this same interface.
 */
export interface LinkStore {
  create(selection: CatalogSelection): Promise<string>;
  resolve(code: string): Promise<CatalogSelection | null>;
}

/** No vowels, no look-alikes: a code should survive being read aloud. */
const ALPHABET = "23456789bcdfghjkmnpqrstvwxz";
export const CODE_LENGTH = 6;

export function generateCode(random: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += ALPHABET[Math.floor(random() * ALPHABET.length)];
  }
  return code;
}

export function createMemoryLinkStore(): LinkStore {
  const links = new Map<string, CatalogSelection>();

  return {
    async create(selection) {
      // The same selection should not pile up new codes every time the button
      // is pressed — a link that is already out there keeps working.
      const existing = [...links.entries()].find(
        ([, stored]) => sameSelection(stored, selection),
      );
      if (existing) return existing[0];

      let code = generateCode();
      while (links.has(code)) code = generateCode();

      links.set(code, selection);
      return code;
    },

    async resolve(code) {
      return links.get(code.toLowerCase().trim()) ?? null;
    },
  };
}

function sameSelection(a: CatalogSelection, b: CatalogSelection): boolean {
  return (
    [...a.categories].sort().join() === [...b.categories].sort().join() &&
    [...a.skus].sort().join() === [...b.skus].sort().join()
  );
}

/**
 * Shared through the global registry for the same reason the catalog is: the
 * page and the route that creates links are bundled separately, and a link
 * created by one has to resolve in the other.
 */
const STORE_KEY = Symbol.for("itoo.links.store");

type GlobalWithStore = typeof globalThis & { [STORE_KEY]?: LinkStore };

function shared(): LinkStore {
  const container = globalThis as GlobalWithStore;
  container[STORE_KEY] ??= createMemoryLinkStore();
  return container[STORE_KEY];
}

export const linkStore: LinkStore = {
  create: (selection) => shared().create(selection),
  resolve: (code) => shared().resolve(code),
};
