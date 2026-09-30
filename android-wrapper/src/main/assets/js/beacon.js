/**
 * Postpartum Ember — peaceful dark US night map.
 * ONLY soft amber/gold glowing dots for each live ember (coarse lat/lng).
 * US state paths stay dark quiet outlines — never fill/wash when lit.
 * Tap a glowing dot (not the state) → note that ember. Own ember → notes inbox.
 * Opt-in. Expires. Anonymous. No PII. No baby-tracker data on public DB.
 */
(function () {
  "use strict";

  var LS_ID = "hearth_beacon_id";
  var LS_META = "hearth_beacon_meta";
  var LS_SECRETS = "hearth_beacon_secrets";
  var MAX_NOTE = 180;
  var mapRoot = null;
  var unsub = null;
  var beaconsCache = {};
  var viewReady = false;
  var selectedState = "";
  var dotsLayer = null;
  var lastDotPositions = []; /* {id,x,y,mine,state} for hit testing / clusters */

  var SUGGESTED = [
    "Thinking of you tonight",
    "Praying quiet strength for you",
    "You're a good mom",
    "This hard night will pass",
    "Sending gentle warmth",
    "Rest when you can",
    "God sees you",
    "Other moms are awake with you",
    "Holding you in prayer"
  ];

  var BLOCK = [
    /\b(kill|murder|rape|suicide|kms|kys|die\s*bitch|hurt\s*you|stalk|bomb|shoot)\b/i,
    /\b(fuck|fucking|shit|bitch|asshole|cunt|slut|whore|nigg|faggot|retard)\b/i,
    /\b(sex|sexy|nude|porn|onlyfans)\b/i,
    /\b(kill\s*yourself|hang\s*yourself|cut\s*yourself)\b/i,
    /\b(https?:\/\/|www\.|\.com\b|\.net\b|\.org\b)/i,
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
    /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/,
    /(?:^|\s)@[a-z0-9_]{3,}/i,
    /\b(snapchat|instagram|tiktok|discord|telegram|whatsapp|dm\s*me|text\s*me|call\s*me)\b/i
  ];

  /* Approximate state centroids (lat/lng) for legacy payload compat — never shown as pins */
  var STATE_CENTROID = {
    AL:[32.8,-86.8],AK:[64.2,-153.3],AZ:[34.3,-111.7],AR:[34.9,-92.4],CA:[37.2,-119.5],
    CO:[39.0,-105.5],CT:[41.6,-72.7],DE:[39.0,-75.5],DC:[38.9,-77.0],FL:[27.8,-81.7],
    GA:[32.7,-83.4],HI:[20.8,-156.3],ID:[44.4,-114.6],IL:[40.0,-89.2],IN:[39.9,-86.3],
    IA:[42.0,-93.5],KS:[38.5,-98.3],KY:[37.5,-85.3],LA:[31.0,-92.0],ME:[45.3,-69.2],
    MD:[39.0,-76.7],MA:[42.3,-71.8],MI:[43.7,-84.5],MN:[46.3,-94.3],MS:[32.7,-89.7],
    MO:[38.4,-92.5],MT:[47.0,-110.0],NE:[41.5,-99.8],NV:[39.3,-116.6],NH:[43.7,-71.6],
    NJ:[40.2,-74.6],NM:[34.4,-106.1],NY:[42.9,-75.5],NC:[35.6,-79.4],ND:[47.5,-100.5],
    OH:[40.3,-82.8],OK:[35.6,-97.5],OR:[44.0,-120.5],PA:[40.9,-77.2],RI:[41.7,-71.6],
    SC:[33.9,-80.9],SD:[44.4,-100.2],TN:[35.9,-86.3],TX:[31.5,-99.3],UT:[39.3,-111.7],
    VT:[44.1,-72.7],VA:[37.5,-78.8],WA:[47.4,-120.5],WV:[38.6,-80.6],WI:[44.6,-89.8],WY:[43.0,-107.6]
  };


  /* Affine fit: continental US lat/lng → HEARTH_US_STATES SVG space (overview only) */
  var PROJ_X = [17.02288797798043, -0.7165883759352383, 2165.2810719993367];
  var PROJ_Y = [-0.3482647797506093, -25.130762061751128, 1228.373186375625];

  function latLngToSvg(lat, lng) {
    lat = Number(lat); lng = Number(lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    /* AK / HI inset: pin near path centroids rather than geographic projection */
    if (lat > 50 && lng < -130) return { x: 100, y: 540 };
    if (lat < 24 && lng < -150) return { x: 280, y: 545 };
    var x = PROJ_X[0] * lng + PROJ_X[1] * lat + PROJ_X[2];
    var y = PROJ_Y[0] * lng + PROJ_Y[1] * lat + PROJ_Y[2];
    return { x: x, y: y };
  }

  function hashJitter(id) {
    var h = 2166136261;
    var s = String(id || "");
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    var a = ((h & 0xffff) / 0xffff - 0.5) * 16;
    var b = (((h >>> 16) & 0xffff) / 0xffff - 0.5) * 16;
    return { dx: a, dy: b };
  }

  /** Coarse fuzz — never raw GPS. Keeps dots state/ZIP-ish. */
  function fuzzCoarse(lat, lng) {
    var o1 = (Math.random() - 0.5) * 0.4;
    var o2 = (Math.random() - 0.5) * 0.4;
    return {
      lat: Math.round((Number(lat) + o1) * 100) / 100,
      lng: Math.round((Number(lng) + o2) * 100) / 100
    };
  }

  function $(id) { return document.getElementById(id); }

  function restBase() {
    var c = window.HEARTH_FIREBASE;
    return (c && c.restBaseUrl) ? String(c.restBaseUrl).replace(/\/$/, "") : "";
  }
  function isFirebaseReady() {
    var c = window.HEARTH_FIREBASE;
    return !!(c && c.configured && c.databaseURL && c.apiKey && window.firebase);
  }
  function isBackendReady() {
    return isFirebaseReady() || !!restBase();
  }

  function filterNote(text) {
    var t = (text || "").trim().replace(/\s+/g, " ");
    if (!t) return { ok: false, reason: "empty" };
    if (t.length > MAX_NOTE) return { ok: false, reason: "long" };
    for (var i = 0; i < BLOCK.length; i++) {
      if (BLOCK[i].test(t)) return { ok: false, reason: "blocked" };
    }
    return { ok: true, text: t };
  }

  function haversineMiles(a, b) {
    if (window.HearthGeo && HearthGeo.haversineMiles) return HearthGeo.haversineMiles(a, b);
    var R = 3958.7613;
    var toRad = function (d) { return (d * Math.PI) / 180; };
    var dLat = toRad(b.lat - a.lat);
    var dLng = toRad(b.lng - a.lng);
    var lat1 = toRad(a.lat);
    var lat2 = toRad(b.lat);
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  /** Resolve ZIP/city/geo → US state only. Never exact home. */
  function resolveState(queryOrCoords, cb) {
    function done(state, zip, lat, lng) {
      if (!state || !STATE_CENTROID[state]) {
        return cb(new Error("Could not find that place. Try a ZIP or City, ST."));
      }
      var c = STATE_CENTROID[state];
      var baseLat = Number.isFinite(lat) ? lat : c[0];
      var baseLng = Number.isFinite(lng) ? lng : c[1];
      var fuzzed = fuzzCoarse(baseLat, baseLng);
      cb(null, { state: state, lat: fuzzed.lat, lng: fuzzed.lng, coarseZip: zip || "" });
    }

    if (queryOrCoords && typeof queryOrCoords === "object" && queryOrCoords.lat != null) {
      var best = null, bestD = Infinity;
      var zips = window.HEARTH_ZIPS || {};
      var keys = Object.keys(zips);
      if (!keys.length && window.HEARTH_ZIP_COORDS) {
        var coords = window.HEARTH_ZIP_COORDS;
        keys = Object.keys(coords);
        for (var i = 0; i < keys.length; i++) {
          var p = coords[keys[i]];
          var d = haversineMiles(queryOrCoords, { lat: p[0], lng: p[1] });
          if (d < bestD) {
            bestD = d;
            best = { state: (p[3] || p.state || ""), zip: keys[i] };
            if (Array.isArray(p) && p.length >= 4) best = { state: p[3], zip: keys[i] };
          }
        }
      } else {
        for (var j = 0; j < keys.length; j++) {
          var z = zips[keys[j]];
          var dd = haversineMiles(queryOrCoords, z);
          if (dd < bestD) {
            bestD = dd;
            best = { state: z.state, zip: keys[j] };
          }
        }
      }
      if (!best || !best.state) return cb(new Error("Could not place you in a state. Enter a ZIP instead."));
      /* nearest ZIP centroid + fuzz — never raw GPS */
      var zips = window.HEARTH_ZIPS || {};
      var zLat, zLng;
      if (best.zip && zips[best.zip]) {
        zLat = zips[best.zip].lat; zLng = zips[best.zip].lng;
      } else if (window.HEARTH_ZIP_COORDS && best.zip && window.HEARTH_ZIP_COORDS[best.zip]) {
        zLat = window.HEARTH_ZIP_COORDS[best.zip][0];
        zLng = window.HEARTH_ZIP_COORDS[best.zip][1];
      }
      return done(String(best.state).toUpperCase(), best.zip, zLat, zLng);
    }

    var q = String(queryOrCoords || "").trim();
    if (/^[A-Za-z]{2}$/.test(q) && STATE_CENTROID[q.toUpperCase()]) {
      return done(q.toUpperCase(), "");
    }
    var hit = null;
    if (window.HearthGeo && HearthGeo.lookupZip) hit = HearthGeo.lookupZip(q);
    if (hit && hit.state) return done(String(hit.state).toUpperCase(), hit.zip || "", hit.lat, hit.lng);
    var zOnly = q.replace(/\D/g, "").slice(0, 5);
    if (/^\d{5}$/.test(zOnly) && window.HEARTH_ZIPS && window.HEARTH_ZIPS[zOnly]) {
      var zz = window.HEARTH_ZIPS[zOnly];
      return done(String(zz.state).toUpperCase(), zOnly, zz.lat, zz.lng);
    }
    cb(new Error("Could not find that ZIP or city. Try e.g. 10001 or Dallas, TX."));
  }

  function getDb() {
    if (!isFirebaseReady()) return null;
    try {
      if (!firebase.apps.length) firebase.initializeApp(window.HEARTH_FIREBASE);
      return firebase.database();
    } catch (e) {
      console.warn("Firebase init", e);
      return null;
    }
  }

  function myMeta() {
    try { return JSON.parse(localStorage.getItem(LS_META) || "null"); } catch (e) { return null; }
  }
  function setMyMeta(m) {
    if (m) localStorage.setItem(LS_META, JSON.stringify(m));
    else localStorage.removeItem(LS_META);
  }
  function myId() { return localStorage.getItem(LS_ID) || ""; }
  function setMyId(id) {
    if (id) localStorage.setItem(LS_ID, id);
    else localStorage.removeItem(LS_ID);
  }
  function readSecretsMap() {
    try {
      var raw = JSON.parse(localStorage.getItem(LS_SECRETS) || "{}");
      return raw && typeof raw === "object" ? raw : {};
    } catch (e) {
      return {};
    }
  }
  function writeSecretsMap(map) {
    try {
      localStorage.setItem(LS_SECRETS, JSON.stringify(map || {}));
    } catch (e) {}
  }
  function getOwnerSecret(id) {
    if (!id) return "";
    var map = readSecretsMap();
    return String(map[id] || "");
  }
  function setOwnerSecret(id, secret) {
    if (!id || !secret) return;
    var map = readSecretsMap();
    map[id] = String(secret);
    writeSecretsMap(map);
  }
  function clearOwnerSecret(id) {
    if (!id) return;
    var map = readSecretsMap();
    if (map[id]) {
      delete map[id];
      writeSecretsMap(map);
    }
  }
  function beaconOwnerHeaders(id, withJson) {
    var h = {};
    if (withJson) h["Content-Type"] = "application/json";
    var secret = getOwnerSecret(id);
    if (secret) h["X-Hearth-Beacon"] = secret;
    return h;
  }

  function setStatus(msg, isError) {
    var el = $("beacon-status");
    if (!el) return;
    el.textContent = msg || "";
    el.classList.toggle("is-error", !!isError);
  }

  function stateName(st) {
    var data = window.HEARTH_US_STATES;
    if (data && data.names && data.names[st]) return data.names[st];
    return st;
  }

  function updateLightUI() {
    var meta = myMeta();
    var on = !!(meta && meta.expiresAt > Date.now());
    var btnOn = $("beacon-light-on");
    var btnOff = $("beacon-light-off");
    var dur = $("beacon-duration");
    if (btnOn) btnOn.hidden = on;
    if (btnOff) btnOff.hidden = !on;
    if (dur) dur.hidden = on;
    var notesWrap = $("beacon-my-notes");
    if (notesWrap) notesWrap.hidden = !on;
    var pill = $("ember-state-pill");
    if (pill) {
      if (on && meta.state) {
        pill.hidden = false;
        pill.textContent = "Your ember · " + stateName(meta.state);
      } else {
        pill.hidden = true;
      }
    }
    if (on) loadMyNotes();
  }

  function initMap() {
    var el = $("beacon-map");
    if (!el || mapRoot) return;
    var data = window.HEARTH_US_STATES;
    if (!data || !data.paths) {
      el.innerHTML = '<p class="ember-map-fallback">Night map loading…</p>';
      return;
    }
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", data.viewBox || "0 0 975 610");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Peaceful night map of the United States");
    svg.classList.add("ember-us-svg");

    var defs = document.createElementNS(svg.namespaceURI, "defs");
    defs.innerHTML =
      '<radialGradient id="emberSky" cx="50%" cy="35%" r="70%">' +
      '<stop offset="0%" stop-color="#1a2744"/>' +
      '<stop offset="55%" stop-color="#0d1526"/>' +
      '<stop offset="100%" stop-color="#070b14"/>' +
      "</radialGradient>" +
      '<filter id="emberGlow" x="-40%" y="-40%" width="180%" height="180%">' +
      '<feGaussianBlur stdDeviation="4" result="b"/>' +
      '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>' +
      "</filter>" +
      '<filter id="emberDotGlow" x="-150%" y="-150%" width="400%" height="400%">' +
      '<feGaussianBlur stdDeviation="5.5" result="b"/>' +
      '<feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>' +
      "</filter>";
    svg.appendChild(defs);

    var bg = document.createElementNS(svg.namespaceURI, "rect");
    bg.setAttribute("x", "-80");
    bg.setAttribute("y", "-20");
    bg.setAttribute("width", "1200");
    bg.setAttribute("height", "700");
    bg.setAttribute("fill", "url(#emberSky)");
    svg.appendChild(bg);

    /* soft starfield */
    var stars = document.createElementNS(svg.namespaceURI, "g");
    stars.setAttribute("opacity", "0.45");
    var seed = 7;
    for (var s = 0; s < 48; s++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      var sx = (seed % 980) - 40;
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      var sy = (seed % 560) + 10;
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      var sr = 0.6 + (seed % 10) / 12;
      var star = document.createElementNS(svg.namespaceURI, "circle");
      star.setAttribute("cx", String(sx));
      star.setAttribute("cy", String(sy));
      star.setAttribute("r", String(sr));
      star.setAttribute("fill", "#c9d4e8");
      stars.appendChild(star);
    }
    svg.appendChild(stars);

    var g = document.createElementNS(svg.namespaceURI, "g");
    g.classList.add("ember-states");
    Object.keys(data.paths).forEach(function (st) {
      var path = document.createElementNS(svg.namespaceURI, "path");
      path.setAttribute("d", data.paths[st]);
      path.setAttribute("data-state", st);
      path.setAttribute("class", "ember-state");
      path.setAttribute("aria-label", stateName(st));
      path.setAttribute("pointer-events", "none");
      g.appendChild(path);
    });
    svg.appendChild(g);

    dotsLayer = document.createElementNS(svg.namespaceURI, "g");
    dotsLayer.classList.add("ember-dots");
    svg.appendChild(dotsLayer);

    el.innerHTML = "";
    el.appendChild(svg);
    mapRoot = el;
  }

  function onStateTap(st) {
    selectedState = st;
    var counts = countByState(beaconsCache);
    var n = counts[st] || 0;
    hideClusterPicker();
    if (n > 0) {
      setStatus(
        n === 1
          ? "One soft ember in " + stateName(st) + " — tap the glowing dot to send warmth."
          : n + " soft embers in " + stateName(st) + " — tap a glowing dot to send warmth."
      );
    } else {
      setStatus(stateName(st) + " is quiet tonight. You can light an ember for your own state.");
      var panel = $("beacon-encourage-panel");
      if (panel) panel.hidden = true;
    }
  }

  function hideClusterPicker() {
    var p = $("ember-cluster-picker");
    if (p) p.hidden = true;
  }

  function showClusterPicker(embers) {
    var panel = $("ember-cluster-picker");
    var list = $("ember-cluster-list");
    var title = $("ember-cluster-title");
    if (!panel || !list) return;
    var encourage = $("beacon-encourage-panel");
    if (encourage) encourage.hidden = true;
    var mid = myId();
    var others = embers.filter(function (e) { return e.id !== mid; });
    var mine = embers.filter(function (e) { return e.id === mid; });
    if (title) {
      title.textContent =
        others.length + mine.length > 1
          ? (others.length + mine.length) + " moms nearby — tap to choose"
          : "Pick an ember";
    }
    var html = "";
    if (mine.length) {
      html += '<button type="button" class="btn btn-secondary ember-pick-btn" data-pick="mine">Your ember — view notes</button>';
    }
    others.forEach(function (e, i) {
      var label = "A mom nearby" + (e.state ? " · " + stateName(e.state) : "");
      if (others.length > 1) label = "Mom " + (i + 1) + (e.state ? " · " + stateName(e.state) : "");
      html +=
        '<button type="button" class="btn btn-primary ember-pick-btn" data-pick="' +
        escapeHtml(e.id) +
        '">' +
        escapeHtml(label) +
        "</button>";
    });
    list.innerHTML = html;
    panel.hidden = false;
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function onDotTap(emberId, x, y) {
    hideClusterPicker();
    var nearby = [];
    var R = 28;
    for (var i = 0; i < lastDotPositions.length; i++) {
      var p = lastDotPositions[i];
      if (Math.hypot(p.x - x, p.y - y) <= R) nearby.push(p);
    }
    if (!nearby.length) {
      var solo = lastDotPositions.filter(function (p) { return p.id === emberId; });
      nearby = solo;
    }
    var mid = myId();
    var others = nearby.filter(function (p) { return p.id !== mid; });
    var hasMine = nearby.some(function (p) { return p.id === mid; });

    if (nearby.length === 1 && nearby[0].id === mid) {
      openEncourage(null, true);
      setStatus("Your ember — notes from other moms show below.");
      return;
    }
    if (nearby.length > 1 && (others.length > 1 || (others.length >= 1 && hasMine))) {
      showClusterPicker(nearby);
      setStatus("A few embers glow together here — tap one to choose.");
      return;
    }
    if (others.length === 1) {
      openEncourage(others[0].id, false);
      setStatus("Send a kind note to this ember. Anonymous — no names or chat.");
      return;
    }
    if (hasMine) {
      openEncourage(null, true);
      setStatus("Your ember — notes from other moms show below.");
    }
  }

  function countByState(data) {
    var now = Date.now();
    var counts = {};
    Object.keys(data || {}).forEach(function (id) {
      var b = data[id];
      if (!b || !b.state) return;
      if (b.expiresAt && b.expiresAt < now) return;
      counts[b.state] = (counts[b.state] || 0) + 1;
    });
    return counts;
  }

  function renderBeacons(data) {
    beaconsCache = data || {};
    var counts = countByState(beaconsCache);
    var mid = myId();
    var now = Date.now();

    if (mapRoot) {
      /* Never wash/fill whole states — outlines stay dark & quiet. Dots only. */
      var paths = mapRoot.querySelectorAll(".ember-state");
      for (var i = 0; i < paths.length; i++) {
        paths[i].classList.remove("is-lit", "is-lit-2", "is-lit-3", "is-mine");
      }

      var svg = mapRoot.querySelector("svg.ember-us-svg");
      if (svg) {
        if (!dotsLayer || !dotsLayer.parentNode) {
          dotsLayer = document.createElementNS(svg.namespaceURI, "g");
          dotsLayer.classList.add("ember-dots");
          svg.appendChild(dotsLayer);
        }
        while (dotsLayer.firstChild) dotsLayer.removeChild(dotsLayer.firstChild);
        lastDotPositions = [];

        Object.keys(beaconsCache).forEach(function (id) {
          var b = beaconsCache[id];
          if (!b) return;
          if (b.expiresAt && b.expiresAt < now) return;
          var xy = latLngToSvg(b.lat, b.lng);
          if (!xy) return;
          var jit = hashJitter(id);
          var x = xy.x + jit.dx;
          var y = xy.y + jit.dy;
          var mine = id === mid;
          lastDotPositions.push({ id: id, x: x, y: y, mine: mine, state: b.state || "" });

          var halo = document.createElementNS(svg.namespaceURI, "circle");
          halo.setAttribute("cx", String(x));
          halo.setAttribute("cy", String(y));
          halo.setAttribute("r", "28");
          halo.setAttribute("class", "ember-dot-halo" + (mine ? " is-mine" : ""));
          halo.setAttribute("pointer-events", "none");
          dotsLayer.appendChild(halo);

          var dot = document.createElementNS(svg.namespaceURI, "circle");
          dot.setAttribute("cx", String(x));
          dot.setAttribute("cy", String(y));
          dot.setAttribute("r", "12");
          dot.setAttribute("class", "ember-dot" + (mine ? " is-mine" : ""));
          dot.setAttribute("tabindex", "0");
          dot.setAttribute("role", "button");
          dot.setAttribute(
            "aria-label",
            mine ? "Your ember" : "A mom nearby" + (b.state ? " in " + stateName(b.state) : "")
          );
          dot.setAttribute("data-ember-id", id);
          (function (eid, ex, ey) {
            dot.addEventListener("click", function (ev) {
              ev.stopPropagation();
              onDotTap(eid, ex, ey);
            });
            dot.addEventListener("keydown", function (e) {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onDotTap(eid, ex, ey);
              }
            });
          })(id, x, y);
          dotsLayer.appendChild(dot);
        });
      }
    }

    var total = Object.keys(counts).reduce(function (a, k) { return a + counts[k]; }, 0);
    var countEl = $("beacon-count");
    if (countEl) {
      if (!isBackendReady()) {
        countEl.textContent = "Live map needs a quick server connect.";
      } else if (total === 0) {
        countEl.textContent = "The night is quiet. Be the first soft ember.";
      } else if (total === 1) {
        countEl.textContent = "One ember is glowing tonight — tap the golden light.";
      } else {
        countEl.textContent =
          total + " embers glowing tonight. Tap a golden light to send warmth.";
      }
    }
    renderRecentlyLit(beaconsCache);
  }

  function relativeTime(ts) {
    var s = Math.max(0, Math.round((Date.now() - (Number(ts) || 0)) / 1000));
    if (s < 45) return "just now";
    if (s < 3600) return Math.max(1, Math.round(s / 60)) + "m ago";
    if (s < 86400) return Math.max(1, Math.round(s / 3600)) + "h ago";
    return Math.max(1, Math.round(s / 86400)) + "d ago";
  }

  function renderRecentlyLit(data) {
    var list = $("ember-recent-list");
    if (!list) return;
    var now = Date.now();
    var items = Object.keys(data || {}).map(function (id) {
      return Object.assign({ id: id }, data[id] || {});
    }).filter(function (b) {
      return b && !(b.expiresAt && b.expiresAt < now);
    }).sort(function (a, b) {
      return (b.createdAt || 0) - (a.createdAt || 0);
    }).slice(0, 8);
    if (!items.length) {
      list.innerHTML = '<li class="hint">No embers lit yet. Be the first soft light.</li>';
      return;
    }
    list.innerHTML = items.map(function (b) {
      var st = b.state ? String(b.state).toUpperCase() : "US";
      var when = relativeTime(b.createdAt);
      return '<li><span class="ember-recent-dot" aria-hidden="true"></span> A mom · ' +
        escapeHtml(st) + ' · ' + escapeHtml(when) + '</li>';
    }).join("");
  }

  function listenBeaconsRest() {
    var base = restBase();
    if (!base) return;
    setStatus("Listening for embers…");
    function poll() {
      fetch(base + "/beacons")
        .then(function (r) { return r.json(); })
        .then(function (val) {
          renderBeacons(val || {});
          setStatus("Live · glowing embers appear as soft golden lights when moms opt in.");
          updateLightUI();
        })
        .catch(function () {
          setStatus("Could not reach the live ember map.", true);
        });
    }
    poll();
    if (window.__hearthBeaconPoll) clearInterval(window.__hearthBeaconPoll);
    window.__hearthBeaconPoll = setInterval(poll, 3500);
  }

  function listenBeacons() {
    var db = getDb();
    if (!db) {
      if (restBase()) return listenBeaconsRest();
      renderBeacons({});
      setStatus("Live map is offline right now. Try again soon.", true);
      return;
    }
    setStatus("Listening for embers…");
    var ref = db.ref("beacons");
    if (unsub) { try { ref.off("value", unsub); } catch (e) {} }
    unsub = function (snap) {
      var val = snap.val() || {};
      var now = Date.now();
      Object.keys(val).forEach(function (id) {
        if (val[id] && val[id].expiresAt && val[id].expiresAt < now) {
          try { db.ref("beacons/" + id).remove(); } catch (e) {}
          delete val[id];
        }
      });
      renderBeacons(val);
      setStatus("Live · glowing embers appear as soft golden lights when moms opt in.");
      updateLightUI();
    };
    ref.on("value", unsub);
  }

  function lightBeacon(hours) {
    if (!isBackendReady()) {
      setStatus("Live map is offline right now — try again in a moment.", true);
      return;
    }
    var zipInput = $("beacon-zip");
    var q = zipInput ? zipInput.value.trim() : "";

    function place(err, coarse) {
      if (err) { setStatus(err.message || String(err), true); return; }
      var now = Date.now();
      var expires = now + hours * 3600 * 1000;
      var payload = {
        lat: coarse.lat,
        lng: coarse.lng,
        createdAt: now,
        expiresAt: expires,
        coarseZip: coarse.coarseZip || "",
        state: coarse.state
      };
      var existing = myId();
      var done = function (id) {
        setMyId(id);
        setMyMeta({
          lat: payload.lat,
          lng: payload.lng,
          expiresAt: expires,
          hours: hours,
          state: payload.state
        });
        updateLightUI();
        renderBeacons(beaconsCache);
        setStatus(
          "Your ember is glowing near " + stateName(payload.state) +
          " for about " + hours + " hours — a soft golden light on the map, never your home."
        );
        if (window.HearthSounds) HearthSounds.play("chime");
        /* optimistic local paint */
        var local = Object.assign({}, beaconsCache);
        local[id] = payload;
        renderBeacons(local);
      };
      var db = getDb();
      if (db) {
        var ref = existing ? db.ref("beacons/" + existing) : db.ref("beacons").push();
        if (existing) {
          ref.set(payload).then(function () { done(existing); }).catch(function (e) {
            setStatus("Could not update your ember. Try again.", true);
            console.warn(e);
          });
        } else {
          ref.set(payload).then(function () { done(ref.key); }).catch(function (e) {
            setStatus("Could not light your ember. Try again.", true);
            console.warn(e);
          });
        }
        return;
      }
      var base = restBase();
      if (!base) return;
      /* Updates need the owner secret from when this ember was created */
      if (existing && !getOwnerSecret(existing)) {
        existing = "";
        setMyId("");
      }
      var url = existing ? base + "/beacons/" + existing : base + "/beacons";
      var method = existing ? "PUT" : "POST";
      setStatus("Lighting your ember…");
      fetch(url, {
        method: method,
        headers: existing ? beaconOwnerHeaders(existing, true) : { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(function (r) {
          return r.json().then(function (j) {
            if (!r.ok) throw new Error((j && j.error) || ("HTTP " + r.status));
            return j;
          });
        })
        .then(function (j) {
          var id = existing || (j && j.id);
          if (!id) throw new Error("missing id");
          if (j && j.ownerSecret) setOwnerSecret(id, j.ownerSecret);
          /* keep local cache warm until next poll */
          beaconsCache = Object.assign({}, beaconsCache);
          beaconsCache[id] = payload;
          done(id);
        })
        .catch(function (e) {
          setStatus("Could not light your ember. " + (e && e.message ? e.message : "Try again."), true);
        });
    }

    if (q) return resolveState(q, place);
    if (!navigator.geolocation) {
      setStatus("Enter a ZIP or City, ST so we can warm your state (never your exact home).", true);
      return;
    }
    setStatus("Finding your state (not your exact pin)…");
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        resolveState({ lat: pos.coords.latitude, lng: pos.coords.longitude }, place);
      },
      function () {
        setStatus("Location unavailable. Enter a ZIP or City, ST instead.", true);
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 }
    );
  }

  function turnOff() {
    var id = myId();
    var db = getDb();
    function clearLocal() {
      if (id) clearOwnerSecret(id);
      setMyId("");
      setMyMeta(null);
      updateLightUI();
      setStatus("Your ember is resting. You can light it again anytime.");
      if (restBase()) listenBeaconsRest();
      else renderBeacons(beaconsCache);
    }
    if (id && db) {
      db.ref("beacons/" + id).remove().then(clearLocal).catch(clearLocal);
    } else if (id && restBase()) {
      fetch(restBase() + "/beacons/" + id, {
        method: "DELETE",
        headers: beaconOwnerHeaders(id, false)
      }).then(clearLocal).catch(clearLocal);
    } else clearLocal();
  }

  function openEncourage(beaconId, mine) {
    var panel = $("beacon-encourage-panel");
    if (!panel) return;
    hideClusterPicker();
    if (mine) {
      panel.hidden = true;
      var notesWrap = $("beacon-my-notes");
      if (notesWrap) {
        notesWrap.hidden = false;
        notesWrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
      loadMyNotes();
      return;
    }
    panel.hidden = false;
    panel.dataset.beaconId = beaconId;
    var chips = $("beacon-note-chips");
    if (chips) {
      chips.innerHTML = SUGGESTED.map(function (s) {
        return '<button type="button" class="chip beacon-chip ember-chip" data-note="' +
          s.replace(/"/g, "&quot;") + '">' + s + "</button>";
      }).join("");
    }
    var ta = $("beacon-note-text");
    if (ta) ta.value = "";
    var fb = $("beacon-note-feedback");
    if (fb) fb.textContent = "";
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function sendNote() {
    var panel = $("beacon-encourage-panel");
    var beaconId = panel && panel.dataset.beaconId;
    var ta = $("beacon-note-text");
    var fb = $("beacon-note-feedback");
    if (!beaconId) return;
    var checked = filterNote(ta ? ta.value : "");
    if (!checked.ok) {
      if (fb) fb.textContent = "That note couldn’t be sent. Try a kind word instead.";
      return;
    }
    if (!isBackendReady()) {
      if (fb) fb.textContent = "Live notes need the map server.";
      return;
    }
    var note = {
      text: checked.text,
      createdAt: Date.now(),
      fromLabel: "A mom nearby"
    };
    function ok() {
      if (fb) fb.textContent = "Sent — thank you for the kindness.";
      if (ta) ta.value = "";
      if (window.HearthSounds) HearthSounds.play("ping");
      panel.hidden = true;
    }
    function fail() {
      if (fb) fb.textContent = "That note couldn’t be sent. Try a kind word instead.";
    }
    var db = getDb();
    if (db) {
      db.ref("beacons/" + beaconId + "/notes").push(note).then(ok).catch(fail);
      return;
    }
    fetch(restBase() + "/beacons/" + beaconId + "/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(note)
    })
      .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
      .then(ok)
      .catch(fail);
  }

  function loadMyNotes() {
    var list = $("beacon-notes-list");
    if (!list) return;
    var id = myId();
    if (!id || !isBackendReady()) {
      list.innerHTML = "<p class=\"hint\">Kind notes from other moms will show here while your ember is lit.</p>";
      return;
    }
    function showNotes(val) {
      val = val || {};
      var items = Object.keys(val).map(function (k) { return val[k]; });
      items.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
      if (!items.length) {
        list.innerHTML = "<p class=\"hint\">No notes yet — when another mom sends warmth, it will appear here.</p>";
        return;
      }
      list.innerHTML = items.slice(0, 40).map(function (n) {
        var when = n.createdAt ? new Date(n.createdAt).toLocaleString() : "";
        return '<article class="beacon-note-card ember-note-card"><p>' + escapeHtml(n.text) +
          '</p><p class="meta">' + escapeHtml(n.fromLabel || "A mom nearby") +
          (when ? " · " + when : "") + "</p></article>";
      }).join("");
    }
    var db = getDb();
    if (db) {
      db.ref("beacons/" + id + "/notes").once("value").then(function (snap) { showNotes(snap.val()); });
      return;
    }
    if (!getOwnerSecret(id)) {
      list.innerHTML = "<p class=\"hint\">Kind notes from other moms will show here while your ember is lit.</p>";
      return;
    }
    fetch(restBase() + "/beacons/" + id + "/notes", {
      headers: beaconOwnerHeaders(id, false)
    })
      .then(function (r) {
        if (!r.ok) throw new Error("auth");
        return r.json();
      })
      .then(showNotes)
      .catch(function () {
        list.innerHTML = "<p class=\"hint\">Could not load notes right now.</p>";
      });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  function onView() {
    if (!viewReady) {
      viewReady = true;
      initMap();
      listenBeacons();
      updateLightUI();
    } else {
      updateLightUI();
    }
  }

  function bind() {
    var chosenHours = 24;
    var on24 = $("beacon-light-24");
    var on8 = $("beacon-light-8");
    var off = $("beacon-light-off");
    function markDur(h) {
      chosenHours = h;
      if (on8) on8.classList.toggle("is-selected", h === 8);
      if (on24) on24.classList.toggle("is-selected", h === 24);
    }
    if (on24) on24.addEventListener("click", function () { markDur(24); });
    if (on8) on8.addEventListener("click", function () { markDur(8); });
    var primary = $("beacon-light-on");
    if (primary) primary.addEventListener("click", function () { lightBeacon(chosenHours); });
    if (off) off.addEventListener("click", turnOff);
    markDur(24);

    var send = $("beacon-note-send");
    if (send) send.addEventListener("click", sendNote);
    var chips = $("beacon-note-chips");
    if (chips) chips.addEventListener("click", function (e) {
      var t = e.target.closest("[data-note]");
      if (!t) return;
      var ta = $("beacon-note-text");
      if (ta) ta.value = t.getAttribute("data-note");
    });
    var cancel = $("beacon-note-cancel");
    if (cancel) cancel.addEventListener("click", function () {
      var p = $("beacon-encourage-panel");
      if (p) p.hidden = true;
    });

    var clusterCancel = $("ember-cluster-cancel");
    if (clusterCancel) clusterCancel.addEventListener("click", hideClusterPicker);
    var clusterList = $("ember-cluster-list");
    if (clusterList) {
      clusterList.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-pick]");
        if (!btn) return;
        var pick = btn.getAttribute("data-pick");
        hideClusterPicker();
        if (pick === "mine") {
          openEncourage(null, true);
          setStatus("Your ember — notes from other moms show below.");
        } else if (pick) {
          openEncourage(pick, false);
          setStatus("Send a kind note to this ember. Anonymous — no names or chat.");
        }
      });
    }

    window.addEventListener("hashchange", function () {
      if ((location.hash || "") === "#postpartum") onView();
    });
    if ((location.hash || "") === "#postpartum") onView();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();

  window.HearthBeacon = { filterNote: filterNote, onView: onView };
})();
