# itoo Wholesale Product Catalog

A shareable, always-current wholesale catalog for itoo, sourced from FashionGo.

Wholesale clients ask for specific categories ("send me your dresses"). Instead
of exporting a PDF that goes stale, the team picks what to send and shares a
link that opens instantly on a phone and always shows current products, images
and prices.

## Repository layout

| Path         | What it is                                                     |
| ------------ | -------------------------------------------------------------- |
| `app/`       | The catalog web app: Next.js, deployed as a Cloudflare Worker  |
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

`pnpm dev` runs against a local copy of the database. It works without one: with
no catalog table to read, the site shows the catalog as it shipped. To sync into
it, or to work on short links or hidden styles, create the tables first:

```bash
npx wrangler d1 migrations apply itoo --local
CATALOG_ORIGIN=http://localhost:3000 node scripts/sync-from-api.mjs
```

## How it works

FashionGo is the single source of truth and the catalog mirrors it. Products,
prices, colors and photos come from the FashionGo vendor account; catalog prices
are derived from the FashionGo price, and products added in the last 30 days are
marked as new arrivals automatically.

Syncing is a full replacement rather than a merge: whatever FashionGo has is
what the catalog shows, so there is never a half-updated state to reconcile. The
catalog is kept in D1, written under a new generation number and switched over
in one row, so a client reading the site during a sync sees the whole catalog
before it or the whole catalog after it, never half of each.

### Importing from FashionGo

```bash
cd app
set -a; . ~/.fashiongo.env; set +a   # FASHIONGO_API_KEY and SYNC_SECRET
node scripts/sync-from-api.mjs
```

The importer reads FashionGo's published REST API (`pubapi.fashiongo.net`,
`GET /v1.0/items`), keeps the styles that are for sale, and posts them to the
app's `/api/sync`, which maps and stores them. It then asks `/api/images/warm`
for the photos until the catalog is covered. One item carries everything the
catalog needs, so the whole import is around thirty requests.

It runs from a machine rather than on a schedule inside the Worker because
FashionGo answers an API key only from addresses it has been told about, and a
Cloudflare Worker has no fixed outbound address to give them.

The mapping lives on the server, in `app/src/lib/fashiongo/api-map.ts`, and the
importer sends FashionGo's items untouched, so there is one tested copy of it
whatever calls the endpoint. (`map.ts` beside it is the older mapping, from the
vendor admin's payloads; it is what built the shipped seed and is still tested
against it.)

Neither the API key nor the sync secret is in this repository, and neither
should be: both come from the environment.

### Sharing a catalogue

The admin view lets the team tick the styles a client asked for and copy one
link. That link carries the selection, opens without any admin controls, and
unfurls into a preview card with the product photo when pasted into a chat.

### Signing in

The catalog itself is public. The address is the product. What is behind a
password is the working view: the checkboxes, the link panel, and the admin page
with the sync details on it. The team signs in at `/admin` with one shared
password and stays signed in for 30 days; the page decides who sees the tools on
the server, from a signed cookie, so a client cannot get them by fiddling with
the browser.

## Deploying

The app deploys to Cloudflare Workers via the OpenNext adapter. In the Cloudflare
dashboard, connect the repository as a Worker and set:

| Setting | Value |
| --- | --- |
| Path / root directory | `app` |
| Build command | `npx opennextjs-cloudflare build` |
| Deploy command | `npx opennextjs-cloudflare deploy` |

Or deploy from a terminal with `pnpm deploy` inside `app/`.

The two PostHog variables in `app/.env.example` are read by `next build`, not by
the running Worker, so they are set differently from the secrets below: put them
in `app/.env.production` when the build runs from a terminal, or in the Worker's
build variables when Cloudflare builds it. A build without them produces a site
with analytics switched off rather than a broken one.

After deploying:

1. Set a `SYNC_SECRET` secret on the Worker (Settings → Variables and secrets)
   and send the same value with every sync request. The catalog is public, so
   without this the sync endpoint would let anyone replace the catalog, so a
   deployed Worker with no secret configured refuses to sync at all.
2. Set an `ADMIN_PASSWORD_HASH` secret with the team's sign-in password. Never
   the password itself: generate the value with

   ```bash
   cd app && node scripts/make-admin-password.mjs "the-password"
   ```

   and paste what it prints. A deployed Worker without this secret refuses to
   sign anyone in and says so on `/admin`, the same way the sync endpoint
   refuses to sync. Optionally set `ADMIN_SESSION_SECRET` as well: sessions are
   signed with it instead of with the password hash, so changing the password
   then does not sign everyone out.
3. Make sure the photo bucket exists (below). It already does for the live
   deployment.
4. Apply any new database migrations:

   ```bash
   cd app && npx wrangler d1 migrations apply itoo --remote
   ```

   The catalog, the short links and the hidden styles all live in the D1
   database bound as `DB` in `app/wrangler.jsonc`. Migrate before deploying: a
   Worker that asks for a table its migration has not created yet fails the
   request rather than falling back to anything.

### Domains

The catalog answers on `itoo.website`; `www.itoo.website` is attached to the
same Worker and redirects there permanently, keeping the path and query so a
shared link still opens the styles it carried. The rule lives in
`app/next.config.ts` and matches any `www.` host, so a second domain pointed at
the Worker behaves the same without another rule.

The Worker's built-in `itoo.alex7golovin.workers.dev` address redirects the same
way, and plain `http://` requests are sent to `https://`. Both rules also live
in `app/next.config.ts`, so they follow the code to any Cloudflare account
without touching zone settings in the dashboard.

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
itself has published, and it fills up as clients view them: around 6,000 photos
and 700 MB for the current catalog, against R2's 10 GB free tier.

## What the browser can see

The catalog is served from a public address, so anything the app hands to a page
is public. The stored product and the published product are deliberately
different types: the browser gets the style number, name, catalog price,
category, colors, photos and whether the style is a new arrival, and nothing
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
links, the FashionGo mapping, the sync endpoint's validation and the sign-in
(password hashing, session signing and expiry, and what an unconfigured server
does), plus the catalog interface itself. Some tests run against the real exported FashionGo
data in `app/src/data`, so a change in FashionGo's payloads is caught by a
failing test rather than by a broken page.
