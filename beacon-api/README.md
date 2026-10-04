# Heart Ember API (v1.7.8)

Public HTTPS REST backend for the Postpartum **Ember** live map + Hope board + private accounts.

## Center flags (1.7.6)

- `POST /flags` anonymous JSON: `centerId` (required), `name`, `city`, `state`, `reason` (default `abortion_provider`), `source` (`directory`|`get_help`), `note` (≤280).
- → `201 { ok:true, id, queued:true }`; 4xx `{ ok:false, error }` (`centerId`|`source`|`blocked`|`too large`|`rate`).
- Durable KV review queue — **does not** auto-remove listings. `GET /flags` admin only.


## Live URL

`https://hearth-ember-api.hearthandhope.workers.dev`

Host: **Cloudflare Workers + KV** on account `9dfa3f…` (Paisiosphilotimo).

**Do not use** the legacy hostname `heart-ember-api.piquant-filament-122.workers.dev` (still 1.6.0 on a different Cloudflare account). Disable steps: [`DISABLE-LEGACY-PF-1.6.0.md`](./DISABLE-LEGACY-PF-1.6.0.md).

## Security (1.7.4)

- **Owner secrets (C1/C2):** `POST /beacons` returns `ownerSecret` once; hash stored as `ownerHash`. `PUT`/`DELETE` `/beacons/:id` and `GET .../notes` require `X-Hearth-Beacon` or `Authorization: Beacon …`. Public note posts stay open + content filter.
- **Content filter (H2):** NFKC + strip ZWSP/Cf; `fuck\w*` / spaced letters (`f.u.c.k`); `@handle` matched with `(^|[^\w])@…` (not inside `\b`).
- **Beacon PUT preserve (M3):** omitting `state` / `coarseZip` keeps existing values.
- **Timing-safe compares (M4):** admin secret + password hashes use `timingSafeEqualStr` (beacon owner already did).
- **Password min length:** **10–72** for new signups and password resets. Existing shorter accounts can still sign in. The account screen states the same rule. A shorter new password returns `400 { error: "password" }`.
- **KV index races (H3):** beacon/Hope index add/drop use verify-and-retry merge (KV has no CAS). Durable Object serialization remains the proper follow-up.
- **Quiet health:** `GET /health` → `{ ok, lights, version }` — **no `accounts`**.
- **CORS allowlist:** `https://bvsquiat27.github.io`, localhost origins, and `"null"` (Android WebView). Reflect only if allowlisted. `Vary: Origin`.
- **Rate limits:** beacons 5/10m, notes 20/10m, hope 10/10m, signup 5/h, login 20/15m, forgot 5/h, reset 10/15m per IP (hashed). `429 { error: "rate" }`.
- **Password reset:** `POST /auth/forgot` with `{ email }` and `POST /auth/reset` with `{ token, password }`. The reset secret is stored only as a hash and is **not** returned in the JSON. Forgot returns the same `{ ok: true }` for an unknown email and for an email that was actually mailed, so the response does not say whether the address is registered. If no mail sender is configured, every valid email gets `503 { error: "unavailable" }` and nothing is emailed. The account screen says a message was sent only when the response is `{ ok: true }`.
- **Body cap:** reject > 64 KB → `413`.
- **Hope admin delete:** set `HOPE_ADMIN_SECRET`. Without it, DELETE returns `503 { error: "admin unset" }`.

## Endpoints

- `GET /health` → `{ ok, lights, version }`
- `GET|POST /beacons` · `PUT|DELETE /beacons/:id` · `GET|POST /beacons/:id/notes`
- `GET|POST /hope` · `DELETE /hope/:id` · `DELETE /hope` / `POST /admin/hope/clear` (requires `HOPE_ADMIN_SECRET` via `X-Hearth-Admin` or `Authorization: Admin …`)
- `POST /auth/signup|login|logout|forgot|reset` · `GET /auth/me` · `GET|PUT /me/sync`

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
# Account 9dfa3f… (heartandhope / Paisiosphilotimo) — wrangler.toml account_id
npx wrangler deploy
# Secret (once): npx wrangler secret put HOPE_ADMIN_SECRET
```

Password reset does nothing until a sender is configured on the Worker. Set **one** of these. Do not commit the values.

- Resend: `MAIL_FROM` and `RESEND_API_KEY`
- SendGrid: `MAIL_FROM` and `SENDGRID_API_KEY`
- Mailgun: `MAIL_FROM`, `MAILGUN_API_KEY`, and `MAILGUN_DOMAIN`
- Cloudflare Email: a `send_email` binding named `EMAIL`, plus `MAIL_FROM` on a verified domain

`MAIL_FROM` is the From address that provider expects (plain address, or `Heart and Hope <you@your-domain>`).

Optional: `APP_PUBLIC_URL` (defaults to `https://bvsquiat27.github.io/heart-and-hope`) is the link origin inside the reset message.

`MAIL_SINK_URL` is only for a local proof server. It is not a production sender and is not set in `wrangler.toml`.

Without those, `POST /auth/forgot` returns `503 { "error": "unavailable" }` and the app tells the user nothing was sent.

```bash
npx wrangler secret put MAIL_FROM
npx wrangler secret put RESEND_API_KEY
```

## Proof

`scripts/prove-1.7.0.sh` starts Express with `RATE_TEST=1` and asserts owner secrets, 401s, health shape, CORS, 413, and rate 429.
Live follow-up proofs (1.7.4): `/workspace/fix-lane-api-20260923.md`.
