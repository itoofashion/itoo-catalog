import type { Metadata } from "next";
import { cookies } from "next/headers";
import { isTeamViewer } from "@/lib/admin/request";
import { hiddenStyles } from "@/lib/catalog/hidden";
import { catalogStore } from "@/lib/catalog/store";
import { syncState } from "@/lib/sync/state";
import { RecentArrivals } from "./catalog-review";
import { CatalogStatus } from "./catalog-status";
import {
  ARRIVALS_COOKIE,
  daysAgo,
  DEFAULT_WINDOW_DAYS,
  latestArrivalDay,
  toReviewStyles,
  validDay,
} from "./review-style";
import { AdminShell } from "./shell";
import { SignInDoor } from "./sign-in-door";

/**
 * Rendered per request, not at build time: it reports the catalog as it stands
 * at this moment, and whether a password is configured is read from the Worker's
 * secrets, which a page baked during the build would have missed.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin panel",
  // Nothing here is for a search engine, and a sign-in page in the results only
  // advertises that there is something to sign in to.
  robots: { index: false, follow: false },
};

/**
 * The first room of the admin area: where the catalog comes from and what
 * arrived when. One page on purpose — a sync's whole point is new arrivals, so
 * pressing the button and reading its result happen in the same place.
 *
 * Gated here, per request, not in a layout: layouts are cached across client
 * navigations in this Next version, and a door that can be remembered open is
 * not a door.
 */
export default async function AdminSyncPage() {
  if (!(await isTeamViewer())) return <SignInDoor />;

  const [catalog, sync, hidden, jar] = await Promise.all([
    catalogStore.read(),
    syncState().then((state) => state.read()),
    hiddenStyles().then((styles) => styles.list()),
    cookies(),
  ]);

  const styles = toReviewStyles(catalog, hidden);
  // The day the list was left open on, so a reload keeps answering the same
  // question. With no day chosen, the day the newest style arrived: "what came
  // in last time" is the question this list is for, and that day always has an
  // answer. A month back is only for a catalog with no arrivals at all.
  const since =
    validDay(jar.get(ARRIVALS_COOKIE)?.value) ??
    latestArrivalDay(styles) ??
    daysAgo(DEFAULT_WINDOW_DAYS);

  return (
    <AdminShell current="sync">
      <CatalogStatus
        productCount={catalog.products.length}
        syncedAt={catalog.syncedAt}
        lastRun={sync.lastRun}
        syncRequestedAt={sync.requestedAt}
      />
      <RecentArrivals styles={styles} initialSince={since} />
    </AdminShell>
  );
}
