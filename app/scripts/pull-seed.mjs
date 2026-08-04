/**
 * Pulls a slice of the live FashionGo catalog and stores it as the pilot's seed
 * data. Raw API payloads are saved as-is — the mapping to the catalog model is
 * done (and tested) in src/lib/fashiongo/map.ts, so there is only one copy of it.
 *
 *   FASHIONGO_USERNAME=... FASHIONGO_PASSWORD=... node scripts/pull-seed.mjs [count]
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  apiClient,
  getProductDetail,
  listActiveProducts,
  login,
} from "./fashiongo-client.mjs";

const OUTPUT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src/data/fashiongo-seed.json",
);

const username = process.env.FASHIONGO_USERNAME;
const password = process.env.FASHIONGO_PASSWORD;
if (!username || !password) {
  console.error("Set FASHIONGO_USERNAME and FASHIONGO_PASSWORD in the environment.");
  process.exit(1);
}

const count = Number(process.argv[2] ?? 10);

const token = await login(username, password);
const get = apiClient(token);
console.log("Signed in to FashionGo.");

const categoriesBody = await get("misc/categories");
const categories = (categoriesBody.data ?? []).map(({ catID, catName }) => ({
  catID,
  catName,
}));
console.log(`Fetched ${categories.length} categories.`);

const { records, total } = await listActiveProducts(get, 1);
console.log(`${total} active products in FashionGo; taking the first ${count}.`);

const products = [];
for (const record of records.slice(0, count)) {
  const detail = await getProductDetail(get, record.productId);
  products.push({
    record: pickRecordFields(record),
    detail: pickDetailFields(detail),
  });
  console.log(`  ${record.productName} — ${detail?.image?.length ?? 0} photos`);
}

await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
await fs.writeFile(
  OUTPUT,
  `${JSON.stringify({ pulledAt: new Date().toISOString(), categories, products }, null, 2)}\n`,
);
console.log(`Wrote ${products.length} products to ${path.relative(process.cwd(), OUTPUT)}`);

/** Keep the seed file readable: store only the fields the mapping consumes. */
function pickRecordFields(record) {
  return {
    productId: record.productId,
    productName: record.productName,
    itemName: record.itemName,
    sellingPrice: record.sellingPrice,
    imageUrl: record.imageUrl,
    _createdOn: record._createdOn,
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
    },
    image: (detail.image ?? []).map((image) => ({
      imageUrl: image.imageUrl,
      color: image.color,
      listOrder: image.listOrder,
      active: image.active,
    })),
  };
}
