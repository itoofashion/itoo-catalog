-- The note the "Sync now" button leaves, and the record of the sync that
-- answered it.
--
-- The Worker cannot reach FashionGo itself: their API answers a whitelisted
-- address, and a Worker has no fixed one. So syncs are run by a puller on a
-- machine FashionGo knows (scripts/sync-agent.mjs), and the button in the admin
-- panel only asks for one. This table is where the asking happens: the button
-- writes requested_at, the puller polls for it every minute, and a successful
-- push to /api/sync writes the run down and clears the request it answered.
--
-- One row, like catalog_state and for the same reason: the whole table's job is
-- to have a single answer, and the CHECK is what keeps an accidental insert
-- from forking it.
CREATE TABLE IF NOT EXISTS sync_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),

  -- ISO 8601, when the team last pressed the button and no sync has landed
  -- since. NULL means nothing is pending. Pressing again only moves the
  -- timestamp: two requests do not mean two syncs, they mean one sooner.
  requested_at TEXT,

  -- The last completed run: when its push landed, and how many styles the
  -- catalog held afterwards. The admin panel prints both. NULL until the first
  -- sync lands.
  finished_at TEXT,
  style_count INTEGER
);
