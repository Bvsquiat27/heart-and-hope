# Heart & Hope — Resources nationwide proof (v1.6.6)

Shipped on top of v1.6.5 (Mother Mary footer preserved — no personal name in UI).

## Coverage
- Centers total: **2636** (local 2633, national 3)
- States + DC keys: **51 / 51**
- Sources: Option Line (Heartbeat) + Birthright public directories (2026-09-23)

### Thin-state before → after
| State | Before | After |
|-------|--------|-------|
| DC | 1 | 1 |
| DE | 5 | 5 |
| RI | 5 | 5 |
| ND | 6 | 6 |
| HI | 8 | 8 |
| VT | 8 | 9 |
| ME | 9 | 9 |
| NV | 9 | 9 |
| UT | 9 | 9 |

Notes: Only **VT +1** from verified Option Line data (`Futures Pregnancy Care`, Lyndonville) previously dropped because the address ended with `United States`. Other thin states had no additional verified OL/Birthright listings in the dumps — counts left honest, no invented clinics. Directory / Get Help still pad thin results with nearest cross-border + national helplines.

## Abortion / PP exclusion proof
- Runtime hard filter: `js/centers-filter.js` (wired before `app.js`; used by `getCenters()` for Directory + Get Help)
- Build-time patterns expanded in `heart-data/scripts/build-real-centers.py`
- CI check: `scripts/verify-no-abortion.mjs` → 0 excludes; recovery + abortion pill reversal allowed
- Name/service scan: Planned Parenthood / abortion clinic providers → **0**; recovery support retained

## Get Help needs (product)
Checkbox group now includes: expecting, new-mom, housing, food, **diapers, formula, clothes, car-seat**, other supplies, **parenting, childcare, job**, ultrasound, ride, mentor, talk, counseling, apply.
`NEED_LABELS` / `NEED_ALIASES` map specifics → exact tags then `supplies` fallback so centers with diaper/formula text rank above generic supplies-only.

## Resources UX
- Life-affirming-only copy on Resources + Directory
- Primary CTA **Find help near me** → Directory
- Thin-state empty path never leaves a mom without national backups

## CORS / Ember Android
Current Workers/Express API already sends `Access-Control-Allow-Origin: *`, which covers Android WebView `Origin: null`. No state-locked logic. (A stricter allowlist draft that explicitly includes `"null"` remains local WIP — not deployed.)

## Footer
Unchanged from v1.6.5: **Dedicated to the Mother Mary** (no Angel/Feliciano name in UI).

## Pages
https://bvsquiat27.github.io/heart-and-hope/
