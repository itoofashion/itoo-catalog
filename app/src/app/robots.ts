import type { MetadataRoute } from "next";

/**
 * The catalog is meant to be sent to a client, not found by strangers. Nobody
 * asked for it to be public in search, prices are wholesale, and a link that
 * was shared with one buyer should not surface next to the brand's own retail
 * shop. Chat apps still unfurl links: they fetch the page themselves and do
 * not consult this.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
