import type { Metadata } from "next";
import { isTeamViewer } from "@/lib/admin/request";
import { hiddenStyles } from "@/lib/catalog/hidden";
import { catalogStore } from "@/lib/catalog/store";
import { HiddenStylesReview } from "../catalog-review";
import { toReviewStyles } from "../review-style";
import { AdminShell } from "../shell";
import { SignInDoor } from "../sign-in-door";

// Per request, like every admin page: it reports the catalog as it stands.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Hidden styles",
  robots: { index: false, follow: false },
};

/**
 * The room where sold-out styles wait. Hiding happens in the catalog, on the
 * card, where the style is in front of the eye that hides it; this page is
 * where they are reviewed and let back in. Gated per request, same as /admin.
 */
export default async function HiddenStylesPage() {
  if (!(await isTeamViewer())) return <SignInDoor />;

  const [catalog, hidden] = await Promise.all([
    catalogStore.read(),
    hiddenStyles().then((styles) => styles.list()),
  ]);

  return (
    <AdminShell current="hidden">
      <HiddenStylesReview styles={toReviewStyles(catalog, hidden)} />
    </AdminShell>
  );
}
