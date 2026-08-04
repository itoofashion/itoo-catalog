import { catalogStore } from "@/lib/catalog/store";
import { serveImage } from "@/lib/images/serve";
import { imageSourceIn } from "@/lib/images/source";
import { imageStore } from "@/lib/images/store";

/**
 * Product photos, served from our own domain instead of FashionGo's CDN.
 *
 * The response is immutable and cached by browsers for a year, but the handler
 * itself has to run per request: on a miss it looks the key up in the live
 * catalog, which changes whenever someone syncs.
 */
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext<"/i/[key]">) {
  const { key } = await context.params;

  return serveImage(key, {
    store: await imageStore(),
    // Read lazily: a photo we already hold is served without touching the catalog.
    resolveSource: async (wanted) => {
      const { products } = await catalogStore.read();
      return imageSourceIn(products, wanted);
    },
  });
}
