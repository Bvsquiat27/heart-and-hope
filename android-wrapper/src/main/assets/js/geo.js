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
   * 4-digit then 3-digit (SCF) neighbor, then nearest numeric ZIP nationwide. `.zip` stays the user-typed ZIP;
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
      // enrich city/state from nearest SCF neighbor; else use neighbor lat/lng;
      // last resort nearest numeric ZIP nationwide (never fail-close a 5-digit).
      var near = nearestZipByPrefix(zipOnly, zips);
      function territoryState(lat, lng) {
        if (lat == null || lng == null) return null;
        if (lat === 0 && lng === 0) return null;
        if (lat >= 17.5 && lat <= 18.6 && lng >= -67.5 && lng <= -65.0) return { city: "Puerto Rico", state: "PR" };
        if (lat >= 17.6 && lat <= 18.5 && lng >= -65.2 && lng <= -64.5) return { city: "US Virgin Islands", state: "VI" };
        if (lat >= 13.0 && lat <= 13.9 && lng >= -65.2 && lng <= -64.5) return { city: "St. Croix", state: "VI" };
        if (lat >= 13.2 && lat <= 14.3 && lng >= 144.4 && lng <= 145.1) return { city: "Guam", state: "GU" };
        if (lat >= -14.6 && lat <= -14.1 && lng >= -171.0 && lng <= -169.3) return { city: "American Samoa", state: "AS" };
        if (lat >= 14.0 && lat <= 15.4 && lng >= 145.0 && lng <= 146.2) return { city: "Northern Mariana Islands", state: "MP" };
        if (lat >= 18.5 && lat <= 22.5 && lng >= -161 && lng <= -154) return { city: "Hawaii", state: "HI" };
        if (lat >= 51 && lng < -130) return { city: "Alaska", state: "AK" };
        return null;
      }
      function nearestNumericZip(zipOnly, zips) {
        var zipNum = parseInt(zipOnly, 10);
        if (!isFinite(zipNum)) return null;
        var bestKey = null, bestDist = Infinity;
        for (var zk in zips) {
          var d = Math.abs(parseInt(zk, 10) - zipNum);
          if (d < bestDist) { bestDist = d; bestKey = zk; }
        }
        return bestKey && zips[bestKey] ? { key: bestKey, rec: zips[bestKey] } : null;
      }
      if (zipCoords[zipOnly]) {
        var pair = zipCoords[zipOnly];
        var lat = Array.isArray(pair) ? pair[0] : pair.lat;
        var lng = Array.isArray(pair) ? pair[1] : pair.lng;
        var nullIsland = lat === 0 && lng === 0;
        if (lat != null && lng != null && isFinite(lat) && isFinite(lng) && !nullIsland) {
          var city = near ? near.rec.city : null;
          var state = near ? near.rec.state : null;
          if (!state) {
            var terr = territoryState(lat, lng);
            if (terr) { city = city || terr.city; state = terr.state; }
          }
          if (!state) {
            var fill = near || nearestNumericZip(zipOnly, zips);
            if (fill) { city = city || fill.rec.city; state = fill.rec.state; }
          }
          if (state) {
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
      var nationwide = nearestNumericZip(zipOnly, zips);
      if (nationwide) {
        return {
          lat: nationwide.rec.lat,
          lng: nationwide.rec.lng,
          city: nationwide.rec.city,
          state: nationwide.rec.state,
          zip: zipOnly,
          matchedZip: nationwide.key
        };
      }
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
  };
})(typeof window !== "undefined" ? window : globalThis);
