# Disable legacy PF Worker 1.6.0

**Target:** `https://heart-ember-api.piquant-filament-122.workers.dev`  
**Why:** Still serves `version: 1.6.0` with CORS `*`, `/health` `accounts` leak, and **no** beacon `ownerSecret` AuthZ (historical C1/C2: unauth PUT/DELETE/notes). Undermines current `heartandhope.workers.dev` 1.7.x.

As of 2026-09-30 ~00:30 ET, `GET /health` still returns `{"ok":true,"lights":0,"accounts":6,"version":"1.6.0"}` with `access-control-allow-origin: *`.

The Paisiosphilotimo wrangler OAuth used for current deploy does **not** own the Piquant Filament account. Disable from that account’s Cloudflare dashboard (or a CLI session logged into PF).

## Cloudflare dashboard (preferred)

1. Sign in to Cloudflare as the **Piquant Filament** account owner (the account that created `*.piquant-filament-122.workers.dev`).
2. Go to **Workers & Pages**.
3. Open the Worker named **`heart-ember-api`** (or whatever script is bound to `heart-ember-api.piquant-filament-122.workers.dev`).
4. Preferred hard disable:
   - **Settings → Domains & Routes** — remove the `*.workers.dev` route / disable the workers.dev subdomain if listed.
   - Or **Deployments** → roll back is **not** enough; use **Delete** on the Worker only after confirming no production clients still point here.
5. Safer interim (if delete is scary): **Settings → Triggers** / routes — delete all routes, then under **Settings → Variables** leave KV bound but replace `worker.js` with a stub that only returns `410 Gone` for every path (deploy stub from PF account).
6. Confirm: `curl -sS -D- https://heart-ember-api.piquant-filament-122.workers.dev/health` → connection error, **404**, or **410** (not `1.6.0` with `accounts`).

## Cloudflare CLI (PF account session)

```bash
# Must be authenticated as the Piquant Filament account (not Paisiosphilotimo).
npx wrangler whoami
# Expect the PF account name/id — if you see Paisiosphilotimo / 9dfa3f68…, STOP.

# List workers, confirm name:
npx wrangler deployments list --name heart-ember-api

# Option A — delete worker (irreversible for that script name on that account):
npx wrangler delete heart-ember-api

# Option B — deploy a 410 stub (keep name, kill API surface):
# (create stub-worker.js that returns 410 for all requests, point wrangler.toml main at it)
npx wrangler deploy
```

## App / client follow-through

- Ensure Android / SPA / README `restBaseUrl` points only at `https://hearth-ember-api.hearthandhope.workers.dev`.
- Search repos and old APKs for `piquant-filament-122` and remove.

## Do not

- Do not redeploy 1.7.x **onto** PF unless you intentionally migrate that hostname; current secure host is already `heartandhope.workers.dev`.
- Do not copy `HOPE_ADMIN_SECRET` or production KV ids into chat logs.
