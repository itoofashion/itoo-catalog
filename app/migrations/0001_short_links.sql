-- What a short link points at.
--
-- The code used to be the selection itself, base64url'd, which made a link
-- nobody wanted to send: /s/RHJlc3Nlc35DbHV0Y2hlcyAmIFBvdWNoZXMhODk4MH5XUC0yMTYw.
-- With a database the code can be six characters that mean nothing on their
-- own, and this table is where they get their meaning back.
--
-- Uniqueness is the database's job, not the caller's: a code is only safe to
-- keep this short because an INSERT of one that already exists fails and the
-- shortener draws another. Checking first and inserting after would leave a
-- window where two isolates hand the same code to two different clients.
CREATE TABLE IF NOT EXISTS short_links (
  -- Six characters from a spoken-out-loud alphabet. PRIMARY KEY on a TEXT
  -- column is a unique index in SQLite, which is exactly the guarantee wanted.
  code TEXT PRIMARY KEY,

  -- The same selection, written the same way every time, so pressing "Get link"
  -- twice on one selection returns the code minted the first time instead of
  -- growing the table by a row per press.
  fingerprint TEXT NOT NULL,

  -- The selection as JSON: {"categories":[...],"skus":[...]}. Stored rather than
  -- derived from the fingerprint so the shape of the fingerprint stays free to
  -- change without stranding every link already sent.
  selection TEXT NOT NULL,

  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS short_links_fingerprint ON short_links (fingerprint);
