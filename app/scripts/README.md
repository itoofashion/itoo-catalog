# Scripts

Operational scripts for the catalog. None of them run inside the Worker: the
FashionGo API answers only whitelisted IP addresses, so syncs are run by a
machine FashionGo has been told about (the "sync server") and pushed to the
catalog over `/api/sync`.

## Syncing

| Script | What it does |
| --- | --- |
| `sync-agent.mjs --poll` | Asks the catalog whether "Sync now" was pressed; runs a full sync if so, exits silently if not. |
| `sync-agent.mjs --full` | Runs a full sync unconditionally. |
| `sync-from-api.mjs` | Same as `--full`; the hand-run entry point. |

A full sync reads every item out of FashionGo, pushes the active ones to
`/api/sync` (full replacement, FashionGo is the source of truth), then warms
the photo store so no client pays for the first download.

### Environment

All three need the same variables. Never commit them; on the sync server keep
them in a root-only env file the crontab sources.

| Variable | Meaning |
| --- | --- |
| `FASHIONGO_API_KEY` | FashionGo REST API key. The sync server's IP must be on FashionGo's whitelist for it. |
| `SYNC_SECRET` | Shared secret for `/api/sync`; the same value is set as a secret on the Worker. |
| `CATALOG_ORIGIN` | Where the catalog runs, e.g. `https://itoo.website` (the default). |

### Schedule — to be installed on the sync server

**Not installed anywhere yet.** These lines go into the crontab of the sync
server (the machine whose IP FashionGo has whitelisted for the API key):

```cron
# Every minute: run a sync if "Sync now" was pressed in the admin panel.
* * * * *  . $HOME/itoo-sync.env && node /path/to/app/scripts/sync-agent.mjs --poll >> $HOME/itoo-sync.log 2>&1

# Midnight in Los Angeles, FashionGo's own timezone: the standing nightly sync.
CRON_TZ=America/Los_Angeles
0 0 * * *  . $HOME/itoo-sync.env && node /path/to/app/scripts/sync-agent.mjs --full >> $HOME/itoo-sync.log 2>&1
```

`itoo-sync.env` holds the three exports above. The poll prints nothing when
there is nothing to do, so the log only grows when a sync actually runs.

## Other scripts

| Script | What it does |
| --- | --- |
| `make-admin-password.mjs` | Hashes a team password for the `ADMIN_PASSWORD_HASH` Worker secret. |
| `pull-seed.mjs` | One-off: pulled the shipped seed out of the vendor admin. Kept for history; the API sync replaced it. |
| `fashiongo-client.mjs` | The old vendor-admin client behind `pull-seed.mjs`. Disabled without an explicit flag; see docs. |
