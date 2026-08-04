# itoo Catalog Sync — Chrome extension

Imports itoo's products from the FashionGo vendor admin into the catalog.

FashionGo offers no way to export the catalog with its photos, so instead of
asking anyone to copy data by hand, this extension reads the products through
the FashionGo session you are already signed in to and sends them to the
catalog.

## Installing it

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose this `extension` folder.

The extension appears in the toolbar as *itoo Catalog Sync*.

## Using it

1. Sign in at [vendoradmin.fashiongo.net](https://vendoradmin.fashiongo.net/).
2. Open the catalog and switch to **Admin view**.
3. Click **Sync from FashionGo**.

The catalog is replaced with what FashionGo currently has — it is a mirror, so
nothing needs to be tidied up afterwards.

You can also run the import from the extension's own popup, which is useful when
the catalog page is not open. The popup asks for the catalog address and the
sync secret, and remembers both.

## The sync secret

The catalog is on a public address, so it only accepts an import that proves it
came from us. Whoever deployed the catalog sets a `SYNC_SECRET` on the Worker;
put the same value into the extension popup once, and syncing works from then
on. A local development catalog needs no secret.

## If something goes wrong

| What you see | What it means |
| --- | --- |
| *Chrome extension not detected* | The extension is not installed, or the catalog is running on an address the extension does not cover — see below. |
| *Not signed in to FashionGo* | Sign in at vendoradmin.fashiongo.net, then sync again. |
| *The FashionGo session expired* | FashionGo signed you out. Sign in again and re-run the sync. |
| *The catalog rejected the sync secret* | The secret in the popup does not match the one set on the catalog. |
| *Sync is not configured* | The catalog has no `SYNC_SECRET` set yet — see the deployment notes in the main README. |

## Pointing it at a different catalog address

`manifest.json` lists the addresses the extension is allowed to work with, under
`host_permissions` and `content_scripts`. It currently covers local development
(`http://localhost:3000`) and Cloudflare Workers addresses (`*.workers.dev`).
Add your own domain to both lists, then reload the extension.

## How long it takes

The extension imports every active style, and FashionGo needs a separate request
per style to give up its photos — around eight hundred requests in total. Expect
a couple of minutes; the catalog shows the progress while it runs, and the
catalog is only replaced once everything has arrived.
