/**
 * Hearth & Hope geo helpers — pure functions for ZIP/city → nearest centers.
 * Depends on window.HEARTH_ZIPS / HEARTH_CITIES (data/zips.js) and HEARTH_CENTERS.
 */
(function (w) {
  "use strict";

  var R_MI = 3958.7613;

  function toRad(d) {
    return (d * Math.PI) / 180;
  }

  function haversineMiles(a, b) {
    if (!a || !b || a.lat == null || b.lat == null) return Infinity;
    var dLat = toRad(b.lat - a.lat);
    var dLng = toRad(b.lng - a.lng);
    var lat1 = toRad(a.lat);
    var lat2 = toRad(b.lat);
    var h =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R_MI * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function normalizeZip(z) {
    if (z == null) return "";
    var s = String(z).replace(/\D/g, "");
    if (s.length >= 5) return s.slice(0, 5);
    return s;
  }

  /**
   * USPS ZIP → territory ST when HEARTH_ZIPS has no row (PR/VI/GU/AS/MP).
   * Uses official ZIP ranges only — never invents coords.
   */
  function territoryStateFromZip(zipOnly) {
    if (!/^\d{5}$/.test(zipOnly)) return null;
    if (zipOnly === "96799") return "AS";
    var p3 = zipOnly.slice(0, 3);
    if (p3 === "006" || p3 === "007" || p3 === "009") return "PR";
    if (p3 === "008") return "VI";
    if (p3 === "969") {
      var n = parseInt(zipOnly, 10);
      if (n >= 96950 && n <= 96952) return "MP";
      if (n >= 96910 && n <= 96932) return "GU";
      return "GU";
    }
    return null;
  }

  /** Coarse bbox → territory when coords exist but SCF neighbor/state missing. */
  function territoryStateFromCoords(lat, lng) {
    lat = Number(lat); lng = Number(lng);
    if (!isFinite(lat) || !isFinite(lng)) return null;
    /* PR + VI Caribbean */
    if (lat >= 17.5 && lat <= 18.6 && lng >= -68.2 && lng <= -64.4) {
      return lng > -65.1 ? "VI" : "PR";
    }
    /* Guam / Northern Mariana (east longitude) */
    if (lat >= 13.0 && lat <= 15.5 && lng >= 144.0 && lng <= 146.2) {
      return lat >= 14.5 ? "MP" : "GU";
    }
    /* American Samoa */
    if (lat >= -14.7 && lat <= -13.9 && lng >= -171.2 && lng <= -169.2) return "AS";
    return null;
  }

  /** When SCF prefix misses (unique/PO Box SCFs absent from HEARTH_ZIPS), enrich state by nearest centroid. */
  function nearestZipByDistance(lat, lng, zips, maxMiles) {
    maxMiles = maxMiles == null ? 200 : maxMiles;
    var best = null, bestD = Infinity;
    for (var zk in zips) {
      if (!Object.prototype.hasOwnProperty.call(zips, zk)) continue;
      var rec = zips[zk];
      if (!rec || rec.lat == null || rec.lng == null || !rec.state) continue;
      var d = haversineMiles({ lat: lat, lng: lng }, rec);
      if (d < bestD) {
        bestD = d;
        best = { key: zk, rec: rec, miles: d };
      }
    }
    if (best && best.miles <= maxMiles) return best;
    return null;
  }

  /**
   * Among HEARTH_ZIPS keys sharing prefix, pick closest numeric ZIP to target.
   * Tries 4-digit then 3-digit (SCF). Returns {key, rec} or null.
   */
  function nearestZipByPrefix(zipOnly, zips) {
    var zipNum = parseInt(zipOnly, 10);
    if (!isFinite(zipNum)) return null;
    var prefixes = [zipOnly.slice(0, 4), zipOnly.slice(0, 3)];
    for (var pi = 0; pi < prefixes.length; pi++) {
      var p = prefixes[pi];
      if (!p || p.length < 3) continue;
      var bestKey = null;
      var bestDist = Infinity;
      for (var zk in zips) {
        if (zk.indexOf(p) !== 0) continue;
        var d = Math.abs(parseInt(zk, 10) - zipNum);
        if (d < bestDist) {
          bestDist = d;
          bestKey = zk;
        }
      }
      if (bestKey && zips[bestKey]) {
        return { key: bestKey, rec: zips[bestKey] };
      }
    }
    return null;
  }

  /**
   * Resolve a query string (ZIP, "City, ST", or "City ST") to
   * {lat,lng,city,state,zip, matchedZip?}.
   * For PO Box / unique ZIPs missing from HEARTH_ZIPS, falls back to nearest
   * 4-digit then 3-digit (SCF) neighbor. `.zip` stays the user-typed ZIP;
   * `.matchedZip` is the centroid ZIP actually used when they differ.
   */
  function lookupZip(query) {
    var q = (query || "").trim();
    if (!q) return null;
    var zips = w.HEARTH_ZIPS || {};
    var cities = w.HEARTH_CITIES || {};
    var zipCoords = w.HEARTH_ZIP_COORDS || {};

    var zipOnly = normalizeZip(q);
    if (/^\d{5}$/.test(zipOnly)) {
      if (zips[zipOnly]) {
        var z = zips[zipOnly];
        return { lat: z.lat, lng: z.lng, city: z.city, state: z.state, zip: zipOnly };
      }

      // Exact miss in HEARTH_ZIPS: prefer zip-coords centroid when present,
      // enrich city/state from nearest SCF neighbor; else use neighbor lat/lng.
      var near = nearestZipByPrefix(zipOnly, zips);
      var terrZip = territoryStateFromZip(zipOnly);
      if (zipCoords[zipOnly]) {
        var pair = zipCoords[zipOnly];
        var lat = Array.isArray(pair) ? Number(pair[0]) : Number(pair.lat);
        var lng = Array.isArray(pair) ? Number(pair[1]) : Number(pair.lng);
        /* Reject placeholder (0,0) — fail closed / fall through, never wrong state */
        var junk = !Number.isFinite(lat) || !Number.isFinite(lng) ||
          (Math.abs(lat) < 0.01 && Math.abs(lng) < 0.01);
        if (!junk) {
          var city = near ? near.rec.city : null;
          var state = near ? near.rec.state : null;
          /* Territory ZIP ranges win over mainland SCF neighbor (e.g. do not paint AS as HI) */
          if (terrZip) {
            state = terrZip;
            city = null;
          }
          if (!state) {
            state = territoryStateFromCoords(lat, lng);
          }
          if (!state) {
            var byDist = nearestZipByDistance(lat, lng, zips, 200);
            if (byDist) {
              city = byDist.rec.city;
              state = byDist.rec.state;
              near = byDist;
            }
          }
          if (state === "PR") city = city || "Puerto Rico";
          else if (state === "VI") city = city || "Virgin Islands";
          else if (state === "GU") city = city || "Guam";
          else if (state === "MP") city = city || "Northern Mariana Islands";
          else if (state === "AS") city = city || "American Samoa";
          return {
            lat: lat,
            lng: lng,
            city: city,
            state: state,
            zip: zipOnly,
            matchedZip: near ? near.key : null
          };
        }
      }
      /* Territory-only ZIP (e.g. 96799 AS) — state without inventing mainland SCF coords */
      if (terrZip && (!near || near.rec.state !== terrZip)) {
        return {
          lat: null,
          lng: null,
          city: null,
          state: terrZip,
          zip: zipOnly,
          matchedZip: null,
          needsCentroid: true
        };
      }
      if (near) {
        return {
          lat: near.rec.lat,
          lng: near.rec.lng,
          city: near.rec.city,
          state: near.rec.state,
          zip: zipOnly,
          matchedZip: near.key
        };
      }
      if (terrZip) {
        return {
          lat: null,
          lng: null,
          city: null,
          state: terrZip,
          zip: zipOnly,
          matchedZip: null,
          needsCentroid: true
        };
      }
      // Valid 5-digit with no SCF neighbor in DB — fail closed (no city parse)
      return null;
    }

    // "City, ST" or "City ST"
    var m = q.match(/^(.+?)[,\s]+([A-Za-z]{2})\s*$/);
    if (m) {
      var key = m[1].trim().toLowerCase() + "|" + m[2].toUpperCase();
      var cz = cities[key];
      if (cz && zips[cz]) {
        var c = zips[cz];
        return { lat: c.lat, lng: c.lng, city: c.city, state: c.state, zip: cz };
      }
    }

    // Bare city: unique match, else major-metro preference (dallas → TX not NC)
    var lower = q.toLowerCase();
    var preferState = {
      "new york": "NY", "los angeles": "CA", "chicago": "IL", "houston": "TX",
      "phoenix": "AZ", "philadelphia": "PA", "san antonio": "TX", "san diego": "CA",
      "dallas": "TX", "san jose": "CA", "austin": "TX", "jacksonville": "FL",
      "miami": "FL", "seattle": "WA", "denver": "CO", "boston": "MA",
      "nashville": "TN", "detroit": "MI", "portland": "OR", "las vegas": "NV",
      "atlanta": "GA", "minneapolis": "MN", "honolulu": "HI", "anchorage": "AK",
      "billings": "MT", "washington": "DC"
    };
    var cityHits = [];
    for (var k in cities) {
      if (k.indexOf(lower + "|") === 0) {
        cityHits.push({ key: k, zip: cities[k], state: k.split("|")[1] });
      }
    }
    if (cityHits.length === 1 && zips[cityHits[0].zip]) {
      var h1 = zips[cityHits[0].zip];
      return { lat: h1.lat, lng: h1.lng, city: h1.city, state: h1.state, zip: cityHits[0].zip };
    }
    if (cityHits.length > 1) {
      var pref = preferState[lower];
      cityHits.sort(function (a, b) {
        var sa = pref && a.state === pref ? 0 : 1;
        var sb = pref && b.state === pref ? 0 : 1;
        return sa - sb || a.key.localeCompare(b.key);
      });
      var pick = cityHits[0];
      if (pref) {
        var prefHit = cityHits.filter(function (x) { return x.state === pref; })[0];
        if (prefHit) pick = prefHit;
      }
      if (pick && zips[pick.zip]) {
        var hp = zips[pick.zip];
        return { lat: hp.lat, lng: hp.lng, city: hp.city, state: hp.state, zip: pick.zip };
      }
    }

    // Partial ZIP prefix (3–4 digits typed) — closest numeric among matches
    if (/^\d{3,4}$/.test(zipOnly)) {
      var bestKey = null;
      var bestDist = Infinity;
      var zipNum = parseInt((zipOnly + "00000").slice(0, 5), 10);
      for (var zk in zips) {
        if (zk.indexOf(zipOnly) !== 0) continue;
        var d = Math.abs(parseInt(zk, 10) - zipNum);
        if (d < bestDist) {
          bestDist = d;
          bestKey = zk;
        }
      }
      if (bestKey && zips[bestKey]) {
        var zp = zips[bestKey];
        return { lat: zp.lat, lng: zp.lng, city: zp.city, state: zp.state, zip: bestKey };
      }
    }
    return null;
  }

  /**
   * Return centers sorted by distance to query.
   * @param {string|object} query ZIP/city string or {lat,lng}
   * @param {array} centers HEARTH_CENTERS
   * @param {{limit?:number, needs?:string[], maxMiles?:number}} opts
   */
  function nearestCenters(query, centers, opts) {
    opts = opts || {};
    var limit = opts.limit != null ? opts.limit : 10;
    var list = centers || w.HEARTH_CENTERS || [];
    var origin =
      query && typeof query === "object" && query.lat != null
        ? query
        : lookupZip(query);

    var scored = list
      .filter(function (c) {
        return c && c.state !== "US" && c.lat != null && c.lng != null;
      })
      .map(function (c) {
        var miles = origin ? haversineMiles(origin, c) : null;
        var overlap = 0;
        if (opts.needs && opts.needs.length) {
          overlap = opts.needs.filter(function (n) {
            return (c.needs || []).indexOf(n) >= 0;
          }).length;
        }
        return { c: c, miles: miles, overlap: overlap };
      });

    if (origin && opts.maxMiles != null) {
      scored = scored.filter(function (s) {
        return s.miles <= opts.maxMiles;
      });
    }

    scored.sort(function (a, b) {
      if (origin) {
        if (a.miles !== b.miles) return a.miles - b.miles;
      }
      if (b.overlap !== a.overlap) return b.overlap - a.overlap;
      return a.c.name.localeCompare(b.c.name);
    });

    // Always include national helplines at the end if room / as extras
    var nationals = list.filter(function (c) {
      return c && c.state === "US";
    });

    var out = scored.slice(0, limit).map(function (s) {
      var copy = Object.assign({}, s.c);
      if (s.miles != null && isFinite(s.miles)) {
        copy.distanceMiles = Math.round(s.miles * 10) / 10;
      }
      return copy;
    });

    nationals.forEach(function (n) {
      if (out.length < limit + 2 && !out.find(function (x) { return x.id === n.id; })) {
        out.push(Object.assign({}, n, { distanceMiles: null }));
      }
    });

    return out;
  }

  w.HearthGeo = {
    haversineMiles: haversineMiles,
    lookupZip: lookupZip,
    nearestCenters: nearestCenters,
    normalizeZip: normalizeZip,
    nearestZipByPrefix: nearestZipByPrefix,
    nearestZipByDistance: nearestZipByDistance,
    territoryStateFromZip: territoryStateFromZip,
    territoryStateFromCoords: territoryStateFromCoords
  };
})(typeof window !== "undefined" ? window : globalThis);
