# Hearth & Hope — Nationwide Get Help proof (2026-09-30)

**Branch:** `ux/resources-get-help`  
**Overall:** **PASS**  
**Generated:** 2026-09-30 (America/New_York)

## What was verified

1. Typed ZIP/city ranks **closest** life-affirming centers (app.js `rankCenters`, `geo: null` so typed beats GPS).
2. Directory need **chips** present; offer pills use honest `services` / exact need tags — **no invented diapers**.
3. PO Box ZIPs **30301 / 85001** resolve with **city + state** (SCF neighbor enrichment).
4. Bare city **Dallas** → **TX** (not NC).
5. Puerto Rico / no-local≤100mi → **nationals-first** (Miami ~1000mi must not be labeled Best/local).

## Commands (all must exit 0)

```bash
cd /workspace/hearth-and-hope-repo
node scripts/proof-get-help-nationwide.mjs
node scripts/proof-zips-nationwide.mjs
node scripts/proof-zip-10458.mjs
node scripts/proof-directory-geo-needs.mjs
```

## Required ZIPs — distances / top results

### 10458 — Bronx NY → **PASS**

- **Resolved:** Bronx, NY 10458 (`zip`; Bronx, NY; 40.8625, -73.8864)

1. **2.5 mi** — Good Counsel (Bronx, NY 10456)
2. **3 mi** — CompassCare Pregnancy Services (Bronx, NY 10451)
3. **5.8 mi** — Bridge Women's Support Center (College Point, NY 11356)
4. **10.2 mi** — Lumina (Mamaroneck, NY 10543)
5. **10.4 mi** — Pregnancy Help, Inc. (New York, NY 10011)

### 30301 — Atlanta GA (PO Box) → **PASS**

- **Resolved:** Atlanta, GA 30301 (`zip`; Atlanta, GA; matchedZip=30303; 33.8444, -84.474)

1. **5.4 mi** — Atlanta Care Center (Atlanta, GA 30309)
2. **8 mi** — Pregnancy Aid Clinic (Atlanta, GA 30312)
3. **11 mi** — Birthright of Atlanta (Chamblee, GA 30341)
4. **11.7 mi** — Pregnancy Resources of Doraville (Doraville, GA 30340)
5. **16.5 mi** — Lifeline Children's Services (Atlanta, GA 30076)

### 85001 — Phoenix AZ (PO Box) → **PASS**

- **Resolved:** Phoenix, AZ 85001 (`zip`; Phoenix, AZ; matchedZip=85003; 33.704, -112.3518)

1. **17.2 mi** — New Life Pregnancy Center - Phoenix (Phoenix, AZ 85051)
2. **19.3 mi** — Phoenix Women's Clinic (Phoenix, AZ 85020)
3. **20.5 mi** — Choices Pregnancy Center (Phoenix, AZ 85012)
4. **20.6 mi** — Phoenix Women's Clinic (Phoenix, AZ 85009)
5. **22.9 mi** — First Way Pregnancy Center (Phoenix, AZ 85016)

### 90210 — Beverly Hills CA → **PASS**

- **Resolved:** Beverly Hills, CA 90210 (`zip`; Beverly Hills, CA; 34.1025, -118.415)

1. **8.1 mi** — International Life Services (Los Angeles, CA 90057)
2. **8.2 mi** — Los Angeles Pregnancy Services (Los Angeles, CA 90057)
3. **8.5 mi** — CaliChoice (Glendale, CA 91201)
4. **11 mi** — Pregnancy Counseling Center (Mission Hills, CA 91345)
5. **12 mi** — Open Arms Pregnancy Clinic (Northridge, CA 91324)

### 75201 — Dallas TX → **PASS**

- **Resolved:** Dallas, TX 75201 (`zip`; Dallas, TX; 32.7883, -96.7995)

1. **0.6 mi** — In My Shoes (Dallas, TX 75222)
2. **2.2 mi** — Viola's House (Dallas, TX 75215)
3. **3.9 mi** — Thrive Women's Clinic (Dallas, TX 75212)
4. **4.4 mi** — Real Options Mobile Unit Dallas Dream Center (Dallas, TX 75216)
5. **5.6 mi** — Thrive Women's Clinic (Dallas, TX 75206)

### 59101 — Billings MT → **PASS**

- **Resolved:** Billings, MT 59101 (`zip-center`; Billings, MT; 45.786509, -108.505071)

1. **0 mi** — LaVie Health (Billings, MT 59101)
2. **98.6 mi** — Inspire Pregnancy Outreach Center (Lewistown, MT 59457)
3. **72.4 mi** — Serenity Pregnancy Resource Center (Powell, WY 82435)
4. **91.6 mi** — Serenity Pregnancy Resource Center (Cody, WY 82414)
5. **123.9 mi** — ZoeCare (Bozeman, MT 59718)

### 96813 — Honolulu HI → **PASS**

- **Resolved:** Honolulu, HI 96813 (`zip-center`; Honolulu, HI; 21.309636, -157.859631)

1. **0 mi** — Pearson Place Pregnancy Resource Center (Honolulu, HI 96813)
2. **9.2 mi** — Aloha Pregnancy Care/Counseling Centers (Kailua, HI 96734)
3. **11.4 mi** — A Place For Women in Waipio (Waipahu, HI 96797)
4. **11.4 mi** — Oahu Pregnancy Center - Image Clear Ultrasound Waipahu (Waipahu, HI 96797)
5. **92.3 mi** — Pregnancy & Wellness Maui (Wailuku, HI 96793)

### 99501 — Anchorage AK → **PASS**

- **Resolved:** Anchorage, AK 99501 (`zip`; Anchorage, AK; 61.2201, -149.8587)

1. **2.7 mi** — Community Pregnancy Center (Anchorage, AK 99508)
2. **12.3 mi** — Heart to Heart Pregnancy Resource Center (Eagle River, AK 99577)
3. **154.6 mi** — Copper Basin Pregnancy Center (Glennallen, AK 99588)
4. **28.5 mi** — HeartReach Mobile Medical Unit (Wasilla, AK 99654)
5. **29.5 mi** — HeartReach Center (Wasilla, AK 99654)

### Dallas — bare city disambiguation → **PASS**

- **Resolved:** Dallas, TX (`city-zip`; dallas, TX; 32.7129, -96.6824)

1. **6.5 mi** — Viola's House (Dallas, TX)
2. **7.5 mi** — Real Options Mobile Unit Dallas Dream Center (Dallas, TX)
3. **8.3 mi** — In My Shoes (Dallas, TX)

### 00601 — Puerto Rico FAR → **PASS**

- **Resolved:** Puerto Rico, PR 00601 (`zip`; Puerto Rico, PR; 18.1653, -66.7226)
- **Mode:** `national`

1. **—** — Birthright International Helpline (Nationwide, US) _(national)_
2. **—** — Care Net Pregnancy Decision Line (Nationwide, US) _(national)_
3. **—** — Option Line (Heartbeat International) (Nationwide, US) _(national)_
4. **1010.6 mi** — ICU Mobile South Florida (Miami, FL)
5. **1012.9 mi** — Pregnancy Options Miami (Palmetto Bay, FL)

### 00901 — Puerto Rico FAR → **PASS**

- **Resolved:** Puerto Rico, PR 00901 (`zip`; Puerto Rico, PR; 18.4659, -66.1036)
- **Mode:** `national`

1. **—** — Birthright International Helpline (Nationwide, US) _(national)_
2. **—** — Care Net Pregnancy Decision Line (Nationwide, US) _(national)_
3. **—** — Option Line (Heartbeat International) (Nationwide, US) _(national)_
4. **1033.7 mi** — ICU Mobile South Florida (Miami, FL)
5. **1035.7 mi** — North Miami Pregnancy Help Medical Clinic (FPPSSP) (North Miami, FL)

## Honesty / chips

| Check | Result |
|-------|--------|
| `dir-need-chip` set (diapers, food, formula, clothes, counseling, housing, ultrasound, talk, parenting, mentor) | PASS |
| `NEED_ALIASES.diapers` exact `["diapers"]` (no supplies fallback) | PASS |
| Centers with `needs.diapers` | 2 (must be < 50) |
| Mass diaper tags restored in centers.js | **No** — kept stripped |

## Code fixes in this pass

| Area | Change |
|------|--------|
| `js/app.js` `resolveLocation` | SCF 4→3 neighbor enrichment for zip-coords PO Boxes; PR territory label; Dallas preferState + center-count tiebreak |
| `js/app.js` `rankCenters` | When no locals ≤100mi / no in-state: **nationals-first**, then honest far mainland |
| `js/geo.js` | Bare-city major-metro preference (Dallas→TX); PR city/state on zip-coords |
| `scripts/proof-zips-nationwide.mjs` | FAR ZIPs no longer false-PASS Miami~1000mi; nationals-first honesty gate; Dallas + PO Box asserts |
| `scripts/proof-get-help-nationwide.mjs` | End-to-end Get Help rankCenters proof for required ZIPs + PR + Dallas + chips |

## Typed ZIP vs GPS

- `geoForQuery` returns `null` for any typed city/ZIP (GPS only for empty / "Near me").
- `rankCenters` uses `hasOwnProperty(opts, "geo")` so `geo: null` does **not** fall back to stale `geoOverride`.
- Regression: `proof-zip-10458.mjs` — Bronx locals first; Gateway Elizabeth is ~22mi from 10458, not 1.2mi.

## Notes

- Sparse states (MT) may list cross-border / farther in-state after #1 local — #1 must still be close.
- Same-zip3 tier can place a slightly farther same-SCF center above a closer different-zip3 neighbor (by design).
- **Do not gh-pages ship from this session** unless a ship executor asks — commits go to `ux/resources-get-help`.
