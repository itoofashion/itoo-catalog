import type { CatalogSelection } from "@/lib/catalog/share";

/**
 * One selection, written one way.
 *
 * Pressing "Get link" twice on the same selection has to give back the same
 * code, or the table grows a row per press and the same catalog goes out under
 * a dozen different addresses. The database enforces that with a unique index,
 * and this is what it indexes: the selection reduced to a string that does not
 * move when the order of the ticks does.
 *
 * Sorted, because ticking Dresses then Tops is the same selection as ticking
 * Tops then Dresses. De-duplicated, because a selection that somehow carries a
 * style twice is still that selection. Kept verbatim rather than hashed: the
 * strings are short, an exact key cannot collide the way a digest can, and a
 * row stays readable when a link has to be chased down in the D1 console.
 *
 * The separators are control characters on purpose. A category is called
 * "Jeans & Denim" and a style number can hold nearly anything, so any separator
 * a person might type could fuse two different selections into one fingerprint,
 * which would quietly serve one client the catalog built for another.
 */
const GROUP_SEPARATOR = "\u001e";
const ITEM_SEPARATOR = "\u001f";

export function fingerprintSelection(selection: CatalogSelection): string {
  return [normalize(selection.categories), normalize(selection.skus)].join(GROUP_SEPARATOR);
}

function normalize(values: string[]): string {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
    .sort()
    .join(ITEM_SEPARATOR);
}
