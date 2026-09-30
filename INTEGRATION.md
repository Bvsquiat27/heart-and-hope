# Distance search integration status

**`app.js` already implements distance matching** (`resolveLocation`, `rankCenters`,
`haversineMiles`). No further patch required for nationwide Find Help.

## Scripts in `index.html`

```html
<script src="data/centers.js"></script>
<script src="data/zips.js"></script>
<script src="js/geo.js"></script>
<script src="js/app.js"></script>
```

| Global | File | Shape |
|--------|------|--------|
| `HEARTH_CENTERS` | `data/centers.js` | center objects with lat/lng |
| `HEARTH_ZIPS` | `data/zips.js` | `zip → {lat,lng,city,state}` |
| `HEARTH_CITIES` | `data/zips.js` | `"city\|ST" → zip` |
| `HearthGeo` | `js/geo.js` | optional helpers (`lookupZip`, `nearestCenters`) |

Optional on-disk fallback (not loaded by default): `data/zip-coords.js` (`HEARTH_ZIP_COORDS`).

Source datasets and rebuild scripts: `/workspace/hearth-data/`.
