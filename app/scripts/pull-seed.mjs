/**
 * Pulls the live FashionGo catalog and stores it as the site's seed data. Raw API
 * payloads are saved as-is — the mapping to the catalog model is done (and
 * tested) in src/lib/fashiongo/map.ts, so there is only one copy of it.
 *
 *   FASHIONGO_USERNAME=... FASHIONGO_PASSWORD=... node scripts/pull-seed.mjs [count]
 *
 * Without a count it takes the whole active catalog (~775 styles, one detail
 * request each), which is why the detail pass is throttled rather than fired off
 * all at once.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  apiClient,
  getProductDetail,
  listAllActiveProducts,
  login,
} from "./fashiongo-client.mjs";

const OUTPUT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src/data/fashiongo-seed.json",
);

/** Polite towards a vendor admin that was never meant to be crawled. */
const CONCURRENCY = 4;

const username = process.env.FASHIONGO_USERNAME;
const password = process.env.FASHIONGO_PASSWORD;
if (!username || !password) {
  console.error("Set FASHIONGO_USERNAME and FASHIONGO_PASSWORD in the environment.");
  process.exit(1);
}

const count = process.argv[2] ? Number(process.argv[2]) : Infinity;

const token = await login(username, password);
const get = apiClient(token);
console.log("Signed in to FashionGo.");

const categoriesBody = await get("misc/categories");
const categories = (categoriesBody.data ?? []).map(({ catID, catName }) => ({
  catID,
  catName,
}));
console.log(`Fetched ${categories.length} categories.`);

const records = await listAllActiveProducts(get, (fetched, total) => {
  process.stdout.write(`\rListing products: ${fetched}/${total}`);
});
console.log(`\rListed ${records.length} active products.        `);

const wanted = records.slice(0, count);

// FashionGo ships its size and pack tables inside every product's detail, so
// they arrive ~775 times over. They are the vendor's own tables and identical
// each time, so they are merged into one copy that the mapping looks styles up in.
const sizes = new Map();
const packs = new Map();

const products = new Array(wanted.length);
let next = 0;
let done = 0;
let withoutDetail = 0;

// Workers share one cursor, so a slow detail request never leaves the others
// idle and the output keeps the vendor's own ordering.
async function worker() {
  while (next < wanted.length) {
    const index = next++;
    const record = wanted[index];
    const detail = await getProductDetail(get, record.productId).catch(() => null);
    if (!detail) withoutDetail++;

    for (const size of detail?.size ?? []) sizes.set(size.sizeId, pickSize(size));
    for (const pack of detail?.pack ?? []) packs.set(pack.packId, pickPack(pack));

    products[index] = { record: pickRecordFields(record), detail: pickDetailFields(detail) };
    done++;
    process.stdout.write(`\rFetching product details: ${done}/${wanted.length}`);
  }
}

await Promise.all(
  Array.from({ length: Math.min(CONCURRENCY, wanted.length) }, () => worker()),
);
console.log(`\rFetched ${done} product details.        `);
if (withoutDetail > 0) {
  console.log(`  ${withoutDetail} of them failed and kept list data only.`);
}

await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
await fs.writeFile(
  OUTPUT,
  serialize({
    pulledAt: new Date().toISOString(),
    categories,
    sizes: [...sizes.values()],
    packs: [...packs.values()],
    products,
  }),
);

const { size: bytes } = await fs.stat(OUTPUT);
console.log(
  `Wrote ${products.length} products, ${sizes.size} size runs and ${packs.size} packs ` +
    `to ${path.relative(process.cwd(), OUTPUT)} (${(bytes / 1024 / 1024).toFixed(1)} MB)`,
);

/**
 * One product per line. An export this size is not read by hand, but a product
 * per line keeps `git diff` able to show which styles actually changed.
 */
function serialize({ pulledAt, categories, sizes, packs, products }) {
  const entries = products.map((product) => `    ${JSON.stringify(product)}`).join(",\n");
  return [
    "{",
    `  "pulledAt": ${JSON.stringify(pulledAt)},`,
    `  "categories": ${JSON.stringify(categories)},`,
    `  "sizes": ${JSON.stringify(sizes)},`,
    `  "packs": ${JSON.stringify(packs)},`,
    `  "products": [`,
    entries,
    "  ]",
    "}",
    "",
  ].join("\n");
}

/**
 * Keep the seed to what the mapping consumes. Product descriptions are the bulk
 * of a FashionGo payload and the catalog never shows them, so they stay out.
 */
function pickRecordFields(record) {
  return {
    productId: record.productId,
    productName: record.productName,
    itemName: record.itemName,
    sellingPrice: record.sellingPrice,
    imageUrl: record.imageUrl,
    _createdOn: record._createdOn,
    _activatedOn: record._activatedOn,
    sizeId: record.sizeId,
    packId: record.packId,
    active: record.active,
  };
}

function pickDetailFields(detail) {
  if (!detail) return null;
  return {
    item: {
      productId: detail.item.productId,
      categoryId: detail.item.categoryId,
      parentCategoryId: detail.item.parentCategoryId,
      parentParentCategoryId: detail.item.parentParentCategoryId,
      sizeId: detail.item.sizeId,
      packId: detail.item.packId,
      minTQStyle: detail.item.minTQStyle,
    },
    image: (detail.image ?? []).map((image) => ({
      imageUrl: image.imageUrl,
      color: image.color,
      listOrder: image.listOrder,
      active: image.active,
    })),
  };
}

/** `sizeName` is free text and often garbage; `sizeDescription2` is the real run. */
function pickSize(size) {
  return {
    sizeId: size.sizeId,
    sizeDescription2: size.sizeDescription2,
    sizeQtyCount: size.sizeQtyCount,
  };
}

function pickPack(pack) {
  return {
    packId: pack.packId,
    packDescription: pack.packDescription,
    packQtyCount: pack.packQtyCount,
  };
}
