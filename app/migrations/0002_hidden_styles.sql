-- Styles the team has taken out of the catalog.
--
-- A style goes here when it is sold out, or pulled, or simply not something to
-- put in front of clients this week. FashionGo stays the source of truth for
-- what a style *is*, and a sync overwrites the catalog wholesale, so this table
-- deliberately holds nothing but the decision itself: put the fact inside the
-- product and the next sync would wipe it.
--
-- It has to be a table rather than a flag in memory for the reason short_links
-- is one: the catalog lives in a Worker isolate that gets recycled, and a
-- hidden style reappearing in front of a client because Cloudflare moved the
-- request to a fresh isolate is exactly the failure this feature exists to
-- prevent.
CREATE TABLE IF NOT EXISTS hidden_styles (
  -- The vendor style number, the same string the catalog and the address bar
  -- use. PRIMARY KEY on a TEXT column is a unique index in SQLite, which is
  -- what makes hiding idempotent: pressing the eye twice on a slow connection
  -- writes the row once and INSERT OR IGNORE swallows the second press rather
  -- than failing it.
  sku TEXT PRIMARY KEY,

  -- When it was hidden. Nothing reads it yet; it is here because "who took this
  -- out of the catalog, and when" is the first question anyone asks of a table
  -- like this, and adding the column later means backfilling it with a lie.
  hidden_at TEXT NOT NULL
);
