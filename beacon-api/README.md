# Hearth Ember API (v1.7.2)

Public HTTPS REST backend for the Postpartum **Ember** live map + Hope board + private accounts.

## Live URL

`https://hearth-ember-api.hearthandhope.workers.dev`

Host: **Cloudflare Workers + KV** on account `9dfa3f…` (Paisiosphilotimo). Legacy PF `*.piquant-filament-122.workers.dev` (1.6.0) should be disabled — see ops note in `/workspace/fix-lane-api-20260923.md`.

## Security (1.7.2)

- **Owner secrets (C1/C2):** `POST /beacons` returns `ownerSecret` once; hash stored as `ownerHash`. `PUT`/`DELETE` `/beacons/:id` and `GET .../notes` require `X-Hearth-Beacon` or `Authorization: Beacon …`. Public note posts stay open + content filter.
- **Content filter (H2):** NFKC + strip ZWSP/Cf; `fuck\w*` / spaced letters (`f.u.c.k`); `@handle` matched with `(^|[^\w])@…` (not inside `\b`).
- **Beacon PUT preserve (M3):** omitting `state` / `coarseZip` keeps existing values.
- **Timing-safe compares (M4):** admin secret + password hashes use `timingSafeEqualStr` (beacon owner already did).
- **Password min length (M1):** **8–72** for new signups (was 6). Existing 6–7 char accounts still login. Client UI still says “at least 6” until next client ship — short new signups get `400 { error: "password" }`.
- **KV index races (H3):** beacon/Hope index add/drop use verify-and-retry merge (KV has no CAS). Durable Object serialization remains the proper follow-up.
- **Quiet health:** `GET /health` → `{ ok, lights, version }` — **no `accounts`**.
- **CORS allowlist:** `https://bvsquiat27.github.io`, localhost origins, and `"null"` (Android WebView). Reflect only if allowlisted. `Vary: Origin`.
- **Rate limits:** beacons 5/10m, notes 20/10m, hope 10/10m, signup 5/h, login 20/15m per IP (hashed). `429 { error: "rate" }`.
- **Body cap:** reject > 64 KB → `413`.
- **Hope admin delete:** set `HOPE_ADMIN_SECRET`. Without it, DELETE returns `503 { error: "admin unset" }`.

## Endpoints

- `GET /health` → `{ ok, lights, version }`
- `GET|POST /beacons` · `PUT|DELETE /beacons/:id` · `GET|POST /beacons/:id/notes`
- `GET|POST /hope` · `DELETE /hope/:id` · `DELETE /hope` / `POST /admin/hope/clear` (requires `HOPE_ADMIN_SECRET` via `X-Hearth-Admin` or `Authorization: Admin …`)
- `POST /auth/signup|login|logout` · `GET /auth/me` · `GET|PUT /me/sync`

## Local

```bash
npm install
node server.js          # PORT=8765
RATE_TEST=1 node server.js   # lower rate ceilings for proof
./scripts/prove-1.7.0.sh
```

Express mirrors Worker security with file Maps under `data/`.

## Deploy

```bash
# Account 9dfa3f… (hearthandhope / Paisiosphilotimo) — wrangler.toml account_id
npx wrangler deploy
# Secret (once): npx wrangler secret put HOPE_ADMIN_SECRET
```

## Proof

`scripts/prove-1.7.0.sh` starts Express with `RATE_TEST=1` and asserts owner secrets, 401s, health shape, CORS, 413, and rate 429.
Live curl proofs for 1.7.2: `/workspace/fix-lane-api-20260923.md`.
