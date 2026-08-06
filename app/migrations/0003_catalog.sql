-- The catalog itself.
--
-- It used to live in the Worker isolate's memory, falling back to the shipped
-- seed. That was fine while syncing was a demo: a sync lasted until Cloudflare
-- recycled the isolate, and two isolates could disagree about what the shop
-- sells. With a real importer pushing FashionGo's catalog several times a day,
-- neither is acceptable.
--
-- A sync replaces the catalog whole, and a client must never be served half of
-- one. That is what the generation number is for. A sync writes its products
-- under a new generation, which nothing reads yet, and only then moves the
-- pointer in catalog_state. Moving it is a single-row write, so the swap is
-- atomic without a transaction spanning the thirty-odd inserts before it, and a
-- sync that dies halfway leaves rows nobody looks at rather than a broken shop.

CREATE TABLE IF NOT EXISTS catalog_products (
  -- Which sync wrote this row. Rows of every generation but the current one are
  -- dead weight, cleaned up right after the swap.
  generation INTEGER NOT NULL,

  -- The style's place in the catalog. FashionGo's own ordering is what the
  -- shop shows, and SQL has no memory of insertion order, so it is written down.
  position INTEGER NOT NULL,

  -- The style number, the same string the address bar uses. Not read by the
  -- catalog, which parses whole products, but a catalog you cannot query by
  -- style number from the D1 console is one you cannot answer questions about.
  sku TEXT NOT NULL,

  -- One product as JSON, in the shape lib/catalog/types.ts describes. Stored
  -- whole rather than spread over columns because nothing here is queried by
  -- field: every reader wants the entire catalog, sizes, photos and all, and a
  -- normalized version would be four tables joined back together on every read
  -- for no gain. It is ~800 rows, rewritten wholesale.
  product TEXT NOT NULL,

  PRIMARY KEY (generation, position)
);

-- One style number per generation. The mapping already collapses styles the
-- vendor listed twice (see dedupeBySku), and this is that promise written where
-- the database can keep it: a sync that would produce two rows for one style
-- fails instead of quietly giving the shop two cards for the same thing.
CREATE UNIQUE INDEX IF NOT EXISTS catalog_products_sku
  ON catalog_products (generation, sku);

-- Which generation is the catalog, and when it was pulled. Exactly one row: the
-- CHECK is what says so, so the pointer cannot be forked by an accidental
-- insert into a table whose entire job is to have a single answer.
CREATE TABLE IF NOT EXISTS catalog_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  generation INTEGER NOT NULL,
  -- ISO 8601, the moment the sync landed. The admin panel shows it.
  synced_at TEXT NOT NULL
);
