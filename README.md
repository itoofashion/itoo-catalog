# itoo — Wholesale Product Catalog

A shareable, always-current wholesale catalog for itoo, sourced from FashionGo.

Wholesale clients ask for specific categories ("send me your dresses"). Instead
of exporting a PDF that goes stale, the team picks what to send and shares a
link that opens instantly on a phone and always shows current products, images
and prices.

## Repository layout

| Path         | What it is                                                     |
| ------------ | -------------------------------------------------------------- |
| `app/`       | The catalog web app — Next.js, deployed as a Cloudflare Worker  |
| `extension/` | Chrome extension that imports products from FashionGo           |
| `reference/` | Design mockup used as the visual reference                      |
| `docs/`      | Project notes                                                   |

## Getting started

```bash
cd app
pnpm install
pnpm dev          # http://localhost:3000
pnpm test         # run the test suite
pnpm preview      # run the production build on the Cloudflare runtime locally
```

To load the Chrome extension, follow [`extension/README.md`](extension/README.md).

## How it works

FashionGo is the single source of truth and the catalog mirrors it. Products,
prices, colors and photos come from the FashionGo vendor account; catalog prices
are derived from the FashionGo price, and products added in the last 30 days are
marked as new arrivals automatically.

Syncing is a full replacement rather than a merge — whatever FashionGo has is
what the catalog shows, so there is never a half-updated state to reconcile.

FashionGo publishes no API for exporting a catalog with its images, so the
import runs in the browser: the Chrome extension reads the products through the
vendor admin session the operator is already signed in to, and hands them to the
app, which maps and stores them.

### Sharing a catalogue

The admin view lets the team tick the styles a client asked for and copy one
link. That link carries the selection, opens without any admin controls, and
unfurls into a preview card with the product photo when pasted into a chat.

## Deploying

The app deploys to Cloudflare Workers via the OpenNext adapter. In the Cloudflare
dashboard, connect the repository as a Worker and set:

| Setting | Value |
| --- | --- |
| Path / root directory | `app` |
| Build command | `npx opennextjs-cloudflare build` |
| Deploy command | `npx opennextjs-cloudflare deploy` |

Or deploy from a terminal with `pnpm deploy` inside `app/`.

After deploying:

1. Add the live address to `extension/manifest.json` so the extension can reach
   it.
2. Set a `SYNC_SECRET` secret on the Worker (Settings → Variables and secrets)
   and enter the same value in the extension popup. The catalog is public, so
   without this the sync endpoint would let anyone replace the catalog — a
   deployed Worker with no secret configured refuses to sync at all.
3. Make sure the photo bucket exists (below) — it already does for the live
   deployment.

### Domains

The catalog answers on `itoo.website`; `www.itoo.website` is attached to the
same Worker and redirects there permanently, keeping the path and query so a
shared link still opens the styles it carried. The rule lives in
`app/next.config.ts` and matches any `www.` host, so a second domain pointed at
the Worker behaves the same without another rule.

### The photo bucket

Product photos are served from the catalog's own domain and kept in an R2 bucket
called `itoo-images`, so the site does not depend on FashionGo's CDN and does not
publish FashionGo's product ids in photo addresses. It is bound in
`app/wrangler.jsonc` as `IMAGES`.

Setting it up on another account takes one command and one edit:

```bash
cd app
npx wrangler r2 bucket create itoo-images
```

A Worker bound to a bucket that does not exist fails to deploy, so on a fresh
account comment the `r2_buckets` line out until the bucket is there. Without the
binding the Worker keeps photos in memory instead: nothing breaks, each new
instance just downloads a photo once from FashionGo and serves it from then on.

Nothing else needs configuring. The bucket only ever holds photos the catalog
itself has published, and it fills up as clients view them — around 6,000 photos
and 700 MB for the current catalog, against R2's 10 GB free tier.

## What the browser can see

The catalog is served from a public address, so anything the app hands to a page
is public. The stored product and the published product are deliberately
different types: the browser gets the style number, name, catalog price,
category, colors, photos and whether the style is a new arrival — and nothing
else. FashionGo's internal product ids, the dates behind the "New" badge and the
source prices stay on the server. `app/src/lib/catalog/public.ts` is that
boundary, and its tests fail if a new internal field starts being published.

Photos are part of that boundary. FashionGo names its image files after its
internal product id, so a page linking to their CDN would publish those ids in
every photo address. Photos are served from `/i/<key>` instead, where the key is
a hash of the FashionGo address: it says nothing about the product, and the
address it was made from is only ever resolved through the catalog, so the route
cannot be talked into downloading anything else.

## Testing

```bash
cd app && pnpm test
```

The suite covers the pricing and new-arrival rules, category filtering, share
links, the FashionGo mapping and the sync endpoint's validation, plus the
catalog interface itself. Some tests run against the real exported FashionGo
data in `app/src/data`, so a change in FashionGo's payloads is caught by a
failing test rather than by a broken page.
