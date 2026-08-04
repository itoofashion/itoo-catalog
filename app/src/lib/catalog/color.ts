/**
 * Vendors type color names by hand, so the same shade arrives as "PINK",
 * "celeste" or "BEIGE W SILVER". The catalog tidies them for display and shows a
 * swatch next to each one.
 */

const SWATCHES: Record<string, string> = {
  black: "#23211f",
  white: "#f6f4f0",
  ivory: "#efe9dd",
  cream: "#f2ead9",
  beige: "#ded0bb",
  taupe: "#b9a894",
  mocha: "#8a6f5c",
  coffee: "#5b4436",
  brown: "#6b4b32",
  camel: "#c09863",
  tan: "#c8a37a",
  rust: "#b1603c",
  orange: "#d2793a",
  yellow: "#e3c26a",
  gold: "#b08d57",
  olive: "#7d7b52",
  sage: "#a9b49a",
  green: "#6f8f6a",
  mint: "#a9cbb7",
  teal: "#4f8a8b",
  celeste: "#a9c7d8",
  blue: "#4a6c96",
  navy: "#2b3a55",
  denim: "#5a7391",
  purple: "#7a5f8f",
  lavender: "#b7a9cb",
  pink: "#e3b3bf",
  blush: "#e3c2bb",
  red: "#a83c3c",
  burgundy: "#6d2d3a",
  wine: "#6d2d3a",
  grey: "#9a9691",
  gray: "#9a9691",
  charcoal: "#4a4744",
  silver: "#c4c2bd",
  multi: "#b08d57",
};

const NEUTRAL_SWATCH = "#c9c2b6";

/** "BEIGE W SILVER" → "Beige W Silver"; leaves deliberate casing like "V-Neck". */
export function formatColorName(color: string): string {
  return color
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Picks the swatch for a color name. Compound names such as "Blue Jeans" or
 * "Beige W Silver" are matched on their first recognised word, which is the one
 * that carries the shade.
 */
export function swatchFor(color: string): string {
  const words = color.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  for (const word of words) {
    const swatch = SWATCHES[word];
    if (swatch) return swatch;
  }
  return NEUTRAL_SWATCH;
}
