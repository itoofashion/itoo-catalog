import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogView } from "@/components/catalog/catalog-view";
import { isTeamViewer } from "@/lib/admin/request";
import { catalogMetadata, publishedCatalog } from "@/lib/catalog/page-data";
import { NO_FILTERS } from "@/lib/catalog/share";
import { resolveShortLink } from "@/lib/links/shorten";
import { linkStore } from "@/lib/links/store";

// A short link resolves against whatever the catalog holds right now, which is
// the point of sending a link instead of a PDF. The code itself is looked up in
// the database on every visit for the same reason: it is six characters and
// means nothing without one (see lib/links/shorten.ts).
export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ code: string }> };

async function linkFor(params: PageProps["params"]) {
  return resolveShortLink((await params).code, await linkStore());
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const link = await linkFor(params);
  if (!link) return { title: "itoo" };
  return catalogMetadata(link.selection, link.newOnly);
}

export default async function ShortLinkPage({ params }: PageProps) {
  const link = await linkFor(params);
  // A code nobody minted is a broken link. Falling through to an unfiltered
  // catalog would show a client the entire line sheet instead.
  if (!link) notFound();

  const { products } = await publishedCatalog();

  return (
    <CatalogView
      products={products}
      selection={link.selection}
      // A link minted under the new-arrivals lens opens with the lens on: that
      // is what the panel promised when the number beside Get link shrank.
      filters={link.newOnly ? { ...NO_FILTERS, newOnly: true } : NO_FILTERS}
      isTeam={await isTeamViewer()}
      // The address is the short link; rewriting it with a query string as the
      // client browses would undo the reason it was shortened.
      readOnlyAddress
    />
  );
}
