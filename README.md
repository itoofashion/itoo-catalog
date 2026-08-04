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

After deploying, add the live address to `extension/manifest.json` so the
extension can sync into it.

## Testing

```bash
cd app && pnpm test
```

The suite covers the pricing and new-arrival rules, category filtering, share
links, the FashionGo mapping and the sync endpoint's validation, plus the
catalog interface itself. Some tests run against the real exported FashionGo
data in `app/src/data`, so a change in FashionGo's payloads is caught by a
failing test rather than by a broken page.
