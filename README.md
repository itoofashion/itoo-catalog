# itoo — Wholesale Product Catalog

A shareable, always-current wholesale catalog for itoo, sourced from FashionGo.

Wholesale clients ask for specific categories ("send me your dresses"). Instead of
exporting a PDF that goes stale, the team picks what to send and shares a link that
opens instantly on a phone and always shows current products, images and prices.

## Repository layout

| Path         | What it is                                                   |
| ------------ | ------------------------------------------------------------ |
| `app/`       | The catalog web app — Next.js, deployed as a Cloudflare Worker |
| `extension/` | Chrome extension that imports products from FashionGo          |
| `reference/` | Design mockup used as the visual reference                     |
| `docs/`      | Project notes and team documentation                           |

## Getting started

```bash
cd app
pnpm install
pnpm dev          # http://localhost:3000
pnpm test         # run the test suite
pnpm preview      # run the production build on the Cloudflare runtime locally
```

## How it works

FashionGo is the single source of truth. The catalog mirrors it: products, prices,
colors and photos come from the FashionGo vendor account, and catalog prices are
derived from the FashionGo price. Products added within the last 30 days are
automatically marked as new arrivals.
