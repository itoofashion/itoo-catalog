import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogView } from "@/components/catalog/catalog-view";
import { isTeamViewer } from "@/lib/admin/request";
import { catalogMetadata, publishedCatalog } from "@/lib/catalog/page-data";
import { NO_FILTERS } from "@/lib/catalog/share";
import { decodeSelection } from "@/lib/links/code";

// A short link resolves against whatever the catalog holds right now, which is
// the point of sending a link instead of a PDF.
export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const selection = decodeSelection((await params).code);
  if (!selection) return { title: "itoo" };
  return catalogMetadata(selection);
}

export default async function ShortLinkPage({ params }: PageProps) {
  const selection = decodeSelection((await params).code);
  if (!selection) notFound();

  const { products } = await publishedCatalog();

  return (
    <CatalogView
      products={products}
      selection={selection}
      filters={NO_FILTERS}
      isTeam={await isTeamViewer()}
      // The address is the short link; rewriting it with a query string as the
      // client browses would undo the reason it was shortened.
      readOnlyAddress
    />
  );
}
