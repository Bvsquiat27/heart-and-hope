(function () {
  "use strict";

  const RESOURCES = [
    {
      id: "pregnancy-health",
      cat: "Pregnancy & health",
      icon: "🌿",
      iconClass: "green",
      title: "Pregnancy & health basics",
      summary: "What to expect week by week, prenatal visits, and when to call your doctor.",
      body: [
        "Early pregnancy can bring excitement and a lot of questions. A trusted clinician can confirm pregnancy, discuss prenatal vitamins, and help you plan your first visit.",
        "Watch for warning signs your doctor has named for you — severe pain, heavy bleeding, fainting, or sudden swelling. When in doubt, call your care team or go to urgent care / ER.",
        "Practical next step: schedule (or confirm) a prenatal appointment and write down your questions beforehand."
      ],
      medical: true,
      faith: "“For you created my inmost being; you knit me together in my mother’s womb.” — Psalm 139:13 (optional reflection)"
    },
    {
      id: "parenting-basics",
      cat: "Parenting basics",
      icon: "🤍",
      iconClass: "cream",
      title: "Newborn & early parenting",
      summary: "Feeding, sleep, soothing, and finding your rhythm without perfectionism.",
      body: [
        "There is no single “right” way to be a mom. Safe sleep, feeding (breast, bottle, or both), and asking for help are the foundations.",
        "If possible, line up one trusted person who can bring a meal or watch the baby so you can rest.",
        "Practical next step: pick one local class or mentor (see Directory) and one supply need to check off this week."
      ],
      medical: true,
      faith: null
    },
    {
      id: "adoption",
      cat: "Adoption options",
      icon: "🤝",
      iconClass: "",
      title: "Learning about adoption",
      summary: "Clear, non-pressure information if you want to explore adoption as a loving path.",
      body: [
        "Adoption can be an act of love — for your child and for you. You deserve unhurried, honest information without coercion.",
        "Ask about open vs. closed options, counseling for birth parents, and timelines. Reputable agencies put your dignity first.",
        "Practical next step: talk with a counselor or center that offers adoption education (see Directory) and bring a support person if you want."
      ],
      medical: false,
      faith: "You are not alone in discerning this path. Wisdom and peace are gifts you can ask for — at your own pace."
    },
    {
      id: "financial-housing",
      cat: "Financial & housing aid",
      icon: "🏠",
      iconClass: "green",
      title: "Money, housing & supplies",
      summary: "Rent help, food, diapers, and places that quietly fill the gaps.",
      body: [
        "Many communities have pregnancy centers, churches, diaper banks, and benevolence funds ready to help — often without long waitlists.",
        "Bring ID if you have it, but ask what they need; some places meet you with fewer barriers.",
        "Practical next step: use Find help nearby, filter by your ZIP, and call two places this week."
      ],
      medical: false,
      faith: null
    },
    {
      id: "emotional-faith",
      cat: "Emotional support & faith",
      icon: "💛",
      iconClass: "cream",
      title: "Someone to talk to",
      summary: "Peer support, mentoring, and optional prayer — without pressure or shame.",
      body: [
        "Feeling overwhelmed, lonely, or unsure does not make you weak. It makes you human — and help is wise.",
        "You can ask for a mentor who shares your faith, or simply a kind listener. Skip any spiritual content that doesn’t feel right today.",
        "Practical next step: use Get Help and select “need someone to talk to,” or call a center’s peer line."
      ],
      medical: false,
      faith: "Optional prayer: “Lord, give me courage for today and people who will walk with me. Amen.”"
    },
    {
      id: "crisis",
      cat: "Crisis help",
      icon: "🆘",
      iconClass: "",
      title: "If you are in crisis",
      summary: "Safety first. Emergency services, hotlines, and immediate local options.",
      body: [
        "If you or your child are in immediate danger, call 911 (or your local emergency number) now.",
        "For emotional crisis support in the U.S., you can dial or text 988 (Suicide & Crisis Lifeline).",
        "Local pregnancy centers and churches in our Directory often offer same-week listening and practical aid — they are not a substitute for emergency services."
      ],
      medical: true,
      faith: null
    }
  ];

  const NEED_LABELS = {
    expecting: "I’m expecting",
    "new-mom": "I’m a new mom",
    housing: "I need housing",
    food: "I need food help",
    diapers: "I need diapers",
    formula: "I need formula",
    clothes: "I need baby clothes",
    "car-seat": "I need a car seat",
    supplies: "I need other baby supplies",
    parenting: "I need parenting classes",
    childcare: "I need childcare",
    job: "I need help with a job",
    ultrasound: "I need an ultrasound / appointment",
    ride: "I need a ride to an appointment",
    mentor: "Please connect me with a mentor mom",
    talk: "I need someone to talk to",
    counseling: "I need pregnancy counseling",
    apply: "Please help me apply for local aid",
    adoption: "I want to learn about adoption"
  };


  /* ---------- Navigation ---------- */
  const views = document.querySelectorAll(".view");
  const navLinks = document.querySelectorAll("[data-nav]");
  const navToggle = document.getElementById("nav-toggle");
  const siteNav = document.getElementById("site-nav");

  const NAV_GROUPS = {
    home: ["home"],
    help: ["directory", "help", "crisis"],
    ember: ["postpartum"],
    tools: [
      "support", "contractions", "baby", "reminders", "ultrasound", "ninety",
      "mentor", "goods", "invite", "work", "resume", "resources", "budget", "stories"
    ],
    more: ["about", "account"]
  };
  function navGroupFor(id) {
    for (const [group, ids] of Object.entries(NAV_GROUPS)) {
      if (ids.indexOf(id) !== -1) return group;
    }
    return "";
  }
  const BOTTOM_HREF = { home: "#home", help: "#directory", ember: "#postpartum", tools: "#support", more: "#about" };

  function showView(hash) {
    const id = (hash || "#home").replace(/^#/, "") || "home";
    views.forEach((v) => {
      const active = v.id === "view-" + id;
      v.classList.toggle("active", active);
      v.hidden = !active;
    });
    const group = navGroupFor(id);
    navLinks.forEach((a) => {
      const target = (a.getAttribute("href") || "").replace(/^#/, "");
      let on = target === id;
      if (a.hasAttribute("data-bottom-nav") && group) {
        on = (BOTTOM_HREF[group] || "").replace(/^#/, "") === target;
      }
      a.classList.toggle("active", on);
    });
    if (siteNav) siteNav.classList.remove("open");
    if (navToggle) navToggle.setAttribute("aria-expanded", "false");
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (id === "stories" && window.HearthSupport && HearthSupport.stories) {
      try { HearthSupport.stories(); } catch (e) {}
    }
    if (id === "account" && window.HearthAccount && HearthAccount.onView) {
      try { HearthAccount.onView(); } catch (e) {}
    }
    if (id === "postpartum" && window.HearthBeacon && HearthBeacon.onView) {
      try { HearthBeacon.onView(); } catch (e) {}
    }
  }

  function route() {
    showView(location.hash || "#home");
  }

  window.addEventListener("hashchange", route);
  navLinks.forEach((a) => {
    a.addEventListener("click", () => {
      /* hashchange handles show */
    });
  });

  if (navToggle && siteNav) {
    navToggle.addEventListener("click", () => {
      const open = siteNav.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  /* ---------- Resources ---------- */
  const resourceGrid = document.getElementById("resource-grid");
  const resourceSearch = document.getElementById("resource-search");
  const resourceChips = document.getElementById("resource-chips");
  const resourceDetail = document.getElementById("resource-detail");
  let activeCat = "all";

  function renderResources() {
    if (!resourceGrid) return;
    const q = (resourceSearch && resourceSearch.value || "").trim().toLowerCase();
    const list = RESOURCES.filter((r) => {
      const catOk = activeCat === "all" || r.cat === activeCat;
      const text = (r.title + " " + r.summary + " " + r.cat).toLowerCase();
      const qOk = !q || text.includes(q);
      return catOk && qOk;
    });

    resourceGrid.innerHTML = list.map((r) => `
      <article class="card" data-resource-id="${r.id}">
        <div class="card-icon ${r.iconClass || ""}" aria-hidden="true">${r.icon}</div>
        <span class="tag">${escapeHtml(r.cat)}</span>
        <h3>${escapeHtml(r.title)}</h3>
        <p>${escapeHtml(r.summary)}</p>
        <button type="button" class="btn btn-secondary" data-open-resource="${r.id}">Read more</button>
      </article>
    `).join("") || `<div class="empty-state">No resources match that search. Try another word.</div>`;
  }

  function openResource(id) {
    const r = RESOURCES.find((x) => x.id === id);
    if (!r || !resourceDetail) return;
    resourceDetail.hidden = false;
    resourceDetail.innerHTML = `
      <h3>${escapeHtml(r.title)}</h3>
      <p class="meta"><span class="tag">${escapeHtml(r.cat)}</span></p>
      ${r.body.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}
      ${r.medical ? `<div class="disclaimer"><strong>Not medical advice.</strong> Talk with your doctor or midwife about your situation. If you are in danger, call 911.</div>` : ""}
      ${r.faith ? `<details class="optional-faith"><summary>Optional encouragement (skip anytime)</summary><p>${escapeHtml(r.faith)}</p></details>` : ""}
      <p style="margin-top:1rem;display:flex;flex-wrap:wrap;gap:0.5rem">
        <a class="btn btn-primary" href="#directory" data-nav>Find help near me</a>
        <a class="btn btn-secondary" href="#help" data-nav>Ask a center</a>
        <button type="button" class="btn btn-ghost" id="close-resource">Close</button>
      </p>
    `;
    resourceDetail.scrollIntoView({ behavior: "smooth", block: "nearest" });
    const closeBtn = document.getElementById("close-resource");
    if (closeBtn) closeBtn.addEventListener("click", () => {
      resourceDetail.hidden = true;
    });
  }

  if (resourceChips) {
    const cats = ["all", ...new Set(RESOURCES.map((r) => r.cat))];
    resourceChips.innerHTML = cats.map((c) => `
      <button type="button" class="chip ${c === "all" ? "active" : ""}" data-cat="${escapeHtml(c)}">${c === "all" ? "All" : escapeHtml(c)}</button>
    `).join("");
    resourceChips.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-cat]");
      if (!btn) return;
      activeCat = btn.getAttribute("data-cat");
      resourceChips.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c === btn));
      renderResources();
    });
  }

  if (resourceSearch) resourceSearch.addEventListener("input", renderResources);
  if (resourceGrid) {
    resourceGrid.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-open-resource]");
      if (btn) openResource(btn.getAttribute("data-open-resource"));
    });
  }

  /* ---------- Directory / proximity matching ---------- */
  const centerList = document.getElementById("center-list");
  const locFilter = document.getElementById("loc-filter");
  const typeFilter = document.getElementById("type-filter");
  const dirMatchNote = document.getElementById("dir-match-note");
  const LOCAL_MILES = 100;
  let geoOverride = null; // { lat, lng, label } from "Use my location" — GPS mode only

  function isNearMeQuery(q) {
    return String(q || "").trim().toLowerCase() === "near me";
  }

  /** GPS only when field is empty or "Near me". Any typed city/ZIP clears GPS ranking. */
  function geoForQuery(q) {
    const t = String(q || "").trim();
    if (!t || isNearMeQuery(t)) return geoOverride;
    return null;
  }

  function clearGeoMode() {
    geoOverride = null;
  }

  function syncGeoModeFromTypedLocation(raw) {
    const t = String(raw || "").trim();
    if (t && !isNearMeQuery(t)) clearGeoMode();
  }

  function getCenters() {
    const all = window.HEARTH_CENTERS || [];
    const f = window.HearthCentersFilter;
    if (f && typeof f.filterLifeAffirming === "function") {
      return f.filterLifeAffirming(all);
    }
    return all;
  }

  function toRad(d) { return (d * Math.PI) / 180; }

  function haversineMiles(a, b) {
    if (!a || !b || a.lat == null || b.lat == null) return Infinity;
    const R = 3958.8;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function normalizeQuery(raw) {
    let s = String(raw || "").trim().toLowerCase();
    s = s.replace(/[,\s]+/g, " ").trim();
    s = s.replace(/\bnew york city\b/g, "new york");
    s = s.replace(/\bn\.?y\.?c\.?\b/g, "nyc");
    return s;
  }

  function extractZip(q) {
    const m = String(q).match(/\b(\d{5})(?:-\d{4})?\b/);
    return m ? m[1] : null;
  }

  function aliasCity(token) {
    const aliases = window.HEARTH_CITY_ALIASES || {};
    return aliases[token] || token;
  }

  function resolveLocation(raw, geo) {
    if (geo && geo.lat != null && geo.lng != null) {
      return { lat: geo.lat, lng: geo.lng, zip: geo.zip || null, state: geo.state || null, city: geo.city || null, source: "geo", label: geo.label || "Your location" };
    }
    const q = normalizeQuery(raw);
    if (!q) return null;

    const zipObj = window.HEARTH_ZIPS || null;
    const zipCoords = window.HEARTH_ZIP_COORDS || {};
    const cityIndex = window.HEARTH_CITY_INDEX || {};
    const cityMap = window.HEARTH_CITIES || {};
    const aliases = {
      "nyc": "new york", "new york city": "new york", "n.y.c.": "new york",
      "manhattan": "new york", "la": "los angeles", "l.a.": "los angeles",
      "philly": "philadelphia", "dc": "washington", "washington dc": "washington",
      "washington d.c.": "washington", "st louis": "saint louis", "st. louis": "saint louis"
    };

    const zip = extractZip(q);

    function fromZip(z) {
      // Prefer a listed center at this ZIP (more accurate than some large ZCTA centroids)
      const hit = getCenters().find((c) => c.zip === z && c.lat != null);
      if (zipObj && zipObj[z]) {
        const o = zipObj[z];
        if (hit) return { lat: hit.lat, lng: hit.lng, zip: z, state: hit.state || o.state, city: hit.city || o.city, source: "zip-center", label: `${hit.city}, ${hit.state} ${z}` };
        return { lat: o.lat, lng: o.lng, zip: z, state: o.state, city: o.city, source: "zip", label: `${o.city || "ZIP"}, ${o.state || ""} ${z}`.trim() };
      }
      if (hit) return { lat: hit.lat, lng: hit.lng, zip: z, state: hit.state, city: hit.city, source: "zip-center", label: `${hit.city}, ${hit.state} ${z}` };
      if (zipCoords[z]) {
        const [lat, lng] = zipCoords[z];
        return { lat, lng, zip: z, state: null, city: null, source: "zip", label: `ZIP ${z}` };
      }
      return null;
    }

    if (zip) {
      const exact = fromZip(zip);
      if (exact) return exact;
      const z3 = zip.slice(0, 3);
      const zipNum = parseInt(zip, 10);

      function nearestZipKey(keys) {
        let best = null;
        let bestDist = Infinity;
        for (const z of keys) {
          if (!z || z.length < 3 || !z.startsWith(z3)) continue;
          const d = Math.abs(parseInt(z, 10) - zipNum);
          if (d < bestDist) {
            bestDist = d;
            best = z;
          }
        }
        return best;
      }

      function labelFor(city, state, z) {
        const c = (city || "").trim();
        const st = (state || "").trim();
        if (c && st) return `${c}, ${st} ${z}`;
        if (st) return `${st} ${z}`;
        return `ZIP ${z}`;
      }

      /* Prefer nearest ZIP in HEARTH_ZIPS / zip-coords within same zip3 (e.g. 30301→30303 Atlanta) */
      const dbKeys = zipObj ? Object.keys(zipObj) : Object.keys(zipCoords);
      const nearDb = nearestZipKey(dbKeys);
      if (nearDb) {
        const got = fromZip(nearDb);
        if (got && got.lat != null) {
          return {
            lat: got.lat,
            lng: got.lng,
            zip,
            state: got.state,
            city: got.city,
            source: "zip3-nearest",
            label: labelFor(got.city, got.state, zip)
          };
        }
      }

      const z3Centers = getCenters().filter((c) => {
        if (c.lat == null || !String(c.zip || "").startsWith(z3)) return false;
        const nat = (c.type || "").toLowerCase().includes("national") || c.zip === "00000" || (c.city || "").toLowerCase() === "nationwide";
        return !nat;
      });
      if (z3Centers.length) {
        const nearest = z3Centers.slice().sort((a, b) =>
          Math.abs(parseInt(a.zip, 10) - zipNum) - Math.abs(parseInt(b.zip, 10) - zipNum)
        )[0];
        return {
          lat: nearest.lat,
          lng: nearest.lng,
          zip,
          state: nearest.state,
          city: nearest.city,
          source: "zip3-center",
          label: labelFor(nearest.city, nearest.state, zip)
        };
      }
    }

    let cityPart = q.replace(/\b\d{5}(?:-\d{4})?\b/g, "").trim();
    const knownStates = "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" ");
    let stateHint = null;
    const stateMatch = cityPart.match(/\b([a-z]{2})$/i);
    if (stateMatch) {
      const maybe = stateMatch[1].toUpperCase();
      if (knownStates.includes(maybe)) {
        stateHint = maybe;
        cityPart = cityPart.slice(0, -2).trim();
      }
    }
    cityPart = aliases[cityPart] || cityPart;

    // HEARTH_CITIES: "city|ST" -> zip
    if (cityPart) {
      const preferState = { "new york": "NY", "los angeles": "CA", "chicago": "IL", "houston": "TX", "phoenix": "AZ", "philadelphia": "PA", "san antonio": "TX", "san diego": "CA", "dallas": "TX", "san jose": "CA", "austin": "TX", "jacksonville": "FL", "miami": "FL", "seattle": "WA", "denver": "CO", "boston": "MA", "nashville": "TN", "detroit": "MI", "portland": "OR", "las vegas": "NV", "memphis": "TN", "louisville": "KY", "baltimore": "MD", "milwaukee": "WI", "albuquerque": "NM", "tucson": "AZ", "atlanta": "GA", "minneapolis": "MN", "omaha": "NE", "raleigh": "NC", "oakland": "CA", "tampa": "FL", "tulsa": "OK", "cleveland": "OH", "wichita": "KS", "arlington": "VA", "new orleans": "LA", "bakersfield": "CA", "honolulu": "HI", "anaheim": "CA", "santa ana": "CA", "riverside": "CA", "corpus christi": "TX", "lexington": "KY", "henderson": "NV", "stockton": "CA", "saint paul": "MN", "saint louis": "MO", "cincinnati": "OH", "pittsburgh": "PA", "greensboro": "NC", "lincoln": "NE", "orlando": "FL", "durham": "NC", "boise": "ID", "spokane": "WA", "birmingham": "AL", "des moines": "IA", "tacoma": "WA", "buffalo": "NY", "reno": "NV", "richmond": "VA", "baton rouge": "LA", "salt lake city": "UT", "little rock": "AR", "cheyenne": "WY", "fairbanks": "AK", "anchorage": "AK", "billings": "MT", "casper": "WY", "charleston": "SC", "springfield": "IL", "columbus": "OH", "washington": "DC", "newark": "NJ", "jersey city": "NJ", "hoboken": "NJ" };
      const matches = Object.keys(cityMap).filter((k) => k === cityPart + "|" + (k.split("|")[1] || "") && k.startsWith(cityPart + "|"));
      // exact city|ST keys only
      const exactMatches = Object.keys(cityMap).filter((k) => {
        const [c] = k.split("|");
        return c === cityPart;
      });
      const centerStates = new Set(getCenters().filter((c) => c.city.toLowerCase() === cityPart).map((c) => c.state));
      const ranked = exactMatches.slice().sort((a, b) => {
        const sa = a.split("|")[1], sb = b.split("|")[1];
        const score = (st) => {
          if (stateHint && st === stateHint) return 0;
          if (preferState[cityPart] && st === preferState[cityPart]) return 1;
          if (centerStates.has(st)) return 2;
          return 3;
        };
        return score(sa) - score(sb) || a.localeCompare(b);
      });
      for (const key of ranked) {
        const z = cityMap[key];
        if (z) {
          const got = fromZip(z);
          if (got) return { ...got, city: cityPart, source: "city-zip", label: got.city ? `${got.city}, ${got.state}` : cityPart };
        }
      }
    }

    if (cityIndex[cityPart]) {
      const [lat, lng, st, z] = cityIndex[cityPart];
      return { lat, lng, zip: z, state: stateHint || st, city: cityPart, source: "city-index", label: cityPart };
    }

    const centers = getCenters();
    const cityHits = centers.filter((c) => c.city.toLowerCase() === cityPart);
    if (cityHits.length) {
      const pool = stateHint ? cityHits.filter((c) => c.state === stateHint) : cityHits;
      const use = pool.length ? pool : cityHits;
      const lat = use.reduce((s, c) => s + c.lat, 0) / use.length;
      const lng = use.reduce((s, c) => s + c.lng, 0) / use.length;
      return { lat, lng, zip: use[0].zip, state: use[0].state, city: use[0].city, source: "center-city", label: `${use[0].city}, ${use[0].state}` };
    }

    if (cityPart.length >= 3) {
      const partial = centers.filter((c) =>
        c.city.toLowerCase().includes(cityPart) || cityPart.includes(c.city.toLowerCase())
      );
      if (partial.length) {
        const lat = partial.reduce((s, c) => s + c.lat, 0) / partial.length;
        const lng = partial.reduce((s, c) => s + c.lng, 0) / partial.length;
        return { lat, lng, zip: partial[0].zip, state: partial[0].state, city: partial[0].city, source: "partial-city", label: `${partial[0].city}, ${partial[0].state}` };
      }
    }

    if (zip) return { lat: null, lng: null, zip, state: stateHint, city: cityPart || null, source: "unresolved", label: raw };
    return { lat: null, lng: null, zip: null, state: stateHint, city: cityPart || null, source: "unresolved", label: raw };
  }


  function rankCenters(locRaw, needs, opts) {
    opts = opts || {};
    const limit = opts.limit || 50;
    /* Explicit opts.geo (including null) must win — never fall back to stale GPS via || */
    const geo = Object.prototype.hasOwnProperty.call(opts, "geo") ? opts.geo : geoOverride;
    const resolved = resolveLocation(locRaw, geo);
    const type = opts.type || "";
    let pool = getCenters().filter((c) => !type || c.type === type);

    const scored = pool.map((c) => {
      let tier = 50;
      let dist = Infinity;
      const national = (c.type || "").toLowerCase().includes("national") || c.zip === "00000" || (c.city || "").toLowerCase() === "nationwide";
      if (resolved && resolved.lat != null && c.lat != null && !national) {
        dist = haversineMiles(resolved, c);
      }
      if (national) {
        tier = 9; /* always after real locals / in-state */
        dist = Infinity;
      } else if (resolved && resolved.zip && c.zip === resolved.zip) tier = 0;
      else if (resolved && resolved.zip && c.zip.slice(0, 3) === resolved.zip.slice(0, 3)) tier = 1;
      else if (resolved && resolved.city && c.city.toLowerCase() === String(resolved.city).toLowerCase()) tier = 2;
      else if (resolved && resolved.state && c.state === resolved.state && dist <= LOCAL_MILES) tier = 3;
      else if (dist <= LOCAL_MILES) tier = 4;
      else if (resolved && resolved.state && c.state === resolved.state) tier = 5;
      else tier = 6;

      // Text boost when unresolved coords but query tokens match
      const q = normalizeQuery(locRaw);
      if (q && (resolved == null || resolved.lat == null)) {
        const hay = `${c.city} ${c.state} ${c.zip} ${c.name}`.toLowerCase();
        if (resolved && resolved.zip && c.zip === resolved.zip) tier = 0;
        else if (q && hay.includes(q)) tier = Math.min(tier, 2);
      }

      const overlap = (needs || []).length
        ? (needs || []).filter((n) => (c.needs || []).includes(n)).length
        : 0;
      return { c, tier, dist, overlap };
    });

    scored.sort((a, b) => {
      const needFirst = (needs || []).length > 0;
      if (needFirst) {
        return (
          a.tier - b.tier ||
          b.overlap - a.overlap ||
          a.dist - b.dist ||
          a.c.name.localeCompare(b.c.name)
        );
      }
      return (
        a.tier - b.tier ||
        a.dist - b.dist ||
        b.overlap - a.overlap ||
        a.c.name.localeCompare(b.c.name)
      );
    });

    const local = scored.filter((s) => s.tier < 9 && (s.dist <= LOCAL_MILES || s.tier <= 4));
    let mode = "all";
    let list;
    if (!locRaw && !geo) {
      list = scored;
      mode = "browse";
    } else if (local.length) {
      list = local;
      mode = local.some((s) => s.tier <= 2) ? "exact" : "local";
    } else {
      const inState = scored.filter((s) => resolved && resolved.state && s.c.state === resolved.state);
      if (inState.length) {
        list = inState;
        mode = "in-state";
      } else {
        list = scored;
        mode = "national";
      }
    }

    // Thin-state / sparse results: never leave a mom with nothing — pad with
    // nearest across the border and national helplines.
    let items = list.slice(0, limit).map((s) => ({ ...s.c, _dist: s.dist, _tier: s.tier }));
    const localNonNat = items.filter((c) => !((c.type || "").toLowerCase().includes("national") || c.zip === "00000"));
    if (locRaw || geo) {
      const thin = localNonNat.length < 5;
      if (thin) {
        const have = new Set(items.map((c) => c.id));
        const nationals = scored
          .filter((s) => (s.c.type || "").toLowerCase().includes("national") || s.c.zip === "00000")
          .map((s) => ({ ...s.c, _dist: s.dist, _tier: s.tier }));
        const nearestExtra = scored
          .filter((s) => !have.has(s.c.id))
          .slice(0, Math.max(0, 8 - items.length))
          .map((s) => ({ ...s.c, _dist: s.dist, _tier: s.tier }));
        for (const c of nearestExtra) {
          if (!have.has(c.id)) { items.push(c); have.add(c.id); }
        }
        for (const c of nationals) {
          if (!have.has(c.id) && items.length < Math.max(limit, 8)) {
            items.push(c); have.add(c.id);
          }
        }
        if (thin && mode !== "browse") mode = mode === "national" ? "national" : (mode + "+backup");
      }
    }

    return {
      resolved,
      mode,
      items: items.slice(0, Math.max(limit, 8))
    };
  }

  function formatDist(miles) {
    if (miles == null || !isFinite(miles)) return "";
    if (miles < 10) return ` · ${miles.toFixed(1)} mi`;
    return ` · ${Math.round(miles)} mi`;
  }


  function selectedDirNeeds() {
    return Array.prototype.map.call(
      document.querySelectorAll('.dir-need-chip[aria-pressed="true"]'),
      function (b) { return b.getAttribute("data-dir-need"); }
    ).filter(Boolean);
  }

  /** Honest service strings from center.services only — never invent diaper/formula/clothes. */
  function honestServicePills(c) {
    var list = Array.isArray(c.services) ? c.services : [];
    var out = [];
    var seen = Object.create(null);
    list.forEach(function (s) {
      var lab = String(s || "").trim();
      if (!lab) return;
      var key = lab.toLowerCase();
      if (seen[key]) return;
      seen[key] = 1;
      out.push(lab);
    });
    return out.slice(0, 8);
  }

  function hearthTap(ms) {
    try {
      if (window.HearthHaptics && typeof window.HearthHaptics.tap === "function") {
        window.HearthHaptics.tap(ms);
        return;
      }
    } catch (e) {}
    try {
      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      if (navigator.vibrate) navigator.vibrate(Math.max(8, Math.min(15, ms || 10)));
    } catch (e2) {}
  }

  var _dirRenderTimer = null;
  function scheduleRenderCenters() {
    if (_dirRenderTimer) clearTimeout(_dirRenderTimer);
    _dirRenderTimer = setTimeout(function () {
      _dirRenderTimer = null;
      renderCenters();
    }, 300);
  }

  function populateTypeFilter() {
    if (!typeFilter) return;
    const types = [...new Set(getCenters().map((c) => c.type))].sort();
    typeFilter.innerHTML = `<option value="">All types</option>` +
      types.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");
  }

  function setDirMatchNote(msg, ok) {
    if (!dirMatchNote) return;
    if (!msg) {
      dirMatchNote.hidden = true;
      dirMatchNote.textContent = "";
      dirMatchNote.style.color = "";
      return;
    }
    dirMatchNote.hidden = false;
    dirMatchNote.textContent = msg;
    dirMatchNote.style.color = ok === false ? "#8a4b2e" : "";
  }

  function renderCenters() {
    if (!centerList) return;
    const q = (locFilter && locFilter.value || "").trim();
    const type = (typeFilter && typeFilter.value) || "";
    syncGeoModeFromTypedLocation(q);
    const geo = geoForQuery(q);
    const queryForRank = isNearMeQuery(q) ? "" : q;
    const dirNeeds = selectedDirNeeds();
    /* Rank with aliases (e.g. diapers→supplies); cards still show honest services only */
    const rankNeeds = (typeof expandNeeds === "function") ? expandNeeds(dirNeeds) : dirNeeds;
    const result = rankCenters(queryForRank, rankNeeds, { type, limit: 40, geo: geo });
    const list = result.items;
    const resolved = result.resolved;
    const usingGps = !!(geo && resolved && resolved.source === "geo");
    const hasQuery = !!(queryForRank || usingGps);

    if (!q && !geoOverride) {
      setDirMatchNote("Enter a city or ZIP, or use your current location, to see nearest life-affirming centers.");
    } else if (q && !isNearMeQuery(q) && resolved && resolved.source === "unresolved") {
      setDirMatchNote("Could not place that location on the map. Check the ZIP or try a nearby city.", false);
    } else if (usingGps) {
      setDirMatchNote("Using your current location — showing nearest centers.");
    } else if (resolved && resolved.lat != null && (result.mode === "exact" || result.mode === "local")) {
      setDirMatchNote("Showing nearest centers near " + (resolved.label || q) + (dirNeeds.length ? " · matching selected needs" : "") + ".");
    } else if (result.mode === "in-state" || String(result.mode).startsWith("in-state")) {
      setDirMatchNote("Few centers right here — showing in-state options plus nearby and national backups.");
    } else if (result.mode === "national" || String(result.mode).includes("backup")) {
      setDirMatchNote("Limited local listings — showing the nearest life-affirming centers plus national helplines.");
    } else if (hasQuery && resolved && resolved.lat != null) {
      setDirMatchNote("Showing nearest centers near " + (resolved.label || q) + ".");
    } else if (!hasQuery) {
      setDirMatchNote("");
    } else {
      setDirMatchNote("");
    }

    if (!list.length) {
      const nationals = getCenters().filter((c) => (c.type || "").toLowerCase().includes("national") || c.zip === "00000");
      if (q && resolved && resolved.source === "unresolved" && nationals.length) {
        centerList.innerHTML = `<div class="empty-state">That place did not match a map point. National life-affirming helplines are below — or try another city or ZIP.</div>` +
          nationals.slice(0, 3).map((c) => {
            const actions = [];
            if (c.phone) actions.push(`<a class="btn-call" href="tel:${escapeAttr(c.phone)}">Call ${escapeHtml(c.phone)}</a>`);
            if (c.website) actions.push(`<a href="${escapeAttr(c.website)}" target="_blank" rel="noopener noreferrer">Website</a>`);
            return `<article class="center-card"><header><h3>${escapeHtml(c.name)}</h3><span class="tag green">${escapeHtml(c.type)}</span></header><p class="blurb">${escapeHtml(c.blurb || "")}</p><div class="center-actions">${actions.join("")}</div></article>`;
          }).join("");
        return;
      }
      if (nationals.length && hasQuery) {
        centerList.innerHTML = `<div class="empty-state">No local centers matched that search. These national life-affirming helplines can still connect you.</div>` +
          nationals.slice(0, 3).map((c) => {
            const actions = [];
            if (c.phone) actions.push(`<a class="btn-call" href="tel:${escapeAttr(c.phone)}">Call ${escapeHtml(c.phone)}</a>`);
            if (c.website) actions.push(`<a href="${escapeAttr(c.website)}" target="_blank" rel="noopener noreferrer">Website</a>`);
            return `<article class="center-card"><header><h3>${escapeHtml(c.name)}</h3><span class="tag green">${escapeHtml(c.type)}</span></header><p class="blurb">${escapeHtml(c.blurb || "")}</p><div class="center-actions">${actions.join("")}</div></article>`;
          }).join("");
        return;
      }
      centerList.innerHTML = `<div class="empty-state">No centers matched. Try another city or ZIP, or clear the search to browse.</div>`;
      return;
    }

    centerList.innerHTML = list.map((c) => {
      const actions = [];
      if (c.phone) actions.push(`<a class="btn-call" href="tel:${escapeAttr(c.phone)}" aria-label="Call ${escapeAttr(c.name)}">Call ${escapeHtml(c.phone)}</a>`);
      if (c.website) actions.push(`<a href="${escapeAttr(c.website)}" target="_blank" rel="noopener noreferrer">Website</a>`);
      if (c.email) actions.push(`<a href="mailto:${escapeAttr(c.email)}">Email</a>`);
      actions.push(`<a href="#help" data-pref-zip="${escapeAttr(c.zip)}">Ask via app</a>`);
      const distLabel = (resolved && resolved.lat != null) ? formatDist(c._dist) : "";
      return `
      <article class="center-card">
        <header>
          <h3>${escapeHtml(c.name)}</h3>
          <span class="tag green">${escapeHtml(c.type)}</span>
        </header>
        <p class="loc">${escapeHtml(c.city)}, ${escapeHtml(c.state)} ${escapeHtml(c.zip)}${distLabel}</p>
        <p class="blurb">${escapeHtml(c.blurb || "")}</p>
        ${typeof offerTagsHtml === "function" ? offerTagsHtml(c, dirNeeds) : `<div class="services offer-tags" aria-label="What this center offers">${honestServicePills(c).map((s) => `<span class="service-pill offer-service">${escapeHtml(s)}</span>`).join("")}</div>`}
        <div class="center-actions">${actions.join("")}</div>
      </article>`;
    }).join("");
  }


  function useBrowserLocation(target) {
    const helpNote = document.getElementById("help-geo-note");
    const setNote = (el, msg, ok) => {
      if (!el) return;
      el.hidden = false;
      el.textContent = msg;
      el.style.color = ok ? "" : "#8a4b2e";
    };
    if (!navigator.geolocation) {
      if (target === "help") setNote(helpNote, "Location is not supported in this browser.", false);
      else setDirMatchNote("Location is not supported in this browser.", false);
      return;
    }
    if (target === "help") setNote(helpNote, "Getting your location…", true);
    else setDirMatchNote("Getting your location…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        geoOverride = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: "Your location",
          source: "geo"
        };
        /* GPS mode owns the field so status, origin, and miles never disagree with a leftover ZIP */
        if (target === "dir" || target === "both") {
          if (locFilter) locFilter.value = "Near me";
          renderCenters();
        }
        if (target === "help" || target === "both") {
          const loc = document.getElementById("location");
          if (loc) loc.value = "Near me";
          setNote(helpNote, "Using your current location for matching.", true);
          updatePreview();
        }
      },
      () => {
        if (target === "help") setNote(helpNote, "Location denied or unavailable. You can still type a city or ZIP.", false);
        else setDirMatchNote("Location denied or unavailable. You can still type a city or ZIP.", false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  }

  if (locFilter) {
    locFilter.addEventListener("input", () => {
      syncGeoModeFromTypedLocation(locFilter.value);
      scheduleRenderCenters();
    });
  }
  if (typeFilter) typeFilter.addEventListener("change", renderCenters);

  const dirNeedsRoot = document.getElementById("dir-needs");
  if (dirNeedsRoot) {
    dirNeedsRoot.addEventListener("click", (ev) => {
      const btn = ev.target.closest(".dir-need-chip");
      if (!btn) return;
      const on = btn.getAttribute("aria-pressed") === "true";
      btn.setAttribute("aria-pressed", on ? "false" : "true");
      btn.classList.toggle("is-active", !on);
      renderCenters();
    });
  }



  const btnDirGeo = document.getElementById("use-my-location-dir");
  const btnHelpGeo = document.getElementById("use-my-location-help");
  if (btnDirGeo) btnDirGeo.addEventListener("click", () => useBrowserLocation("dir"));
  if (btnHelpGeo) btnHelpGeo.addEventListener("click", () => useBrowserLocation("help"));

  /* ---------- Get Help form ---------- */
  const helpForm = document.getElementById("help-form");
  const previewEl = document.getElementById("message-preview");
  const matchEl = document.getElementById("match-preview");
  const formError = document.getElementById("form-error");
  const formSuccess = document.getElementById("form-success");
  const copyMsgBtn = document.getElementById("copy-message");

  function selectedNeeds() {
    if (!helpForm) return [];
    return [...helpForm.querySelectorAll('input[name="needs"]:checked')].map((i) => i.value);
  }


  /* Map UI need ids to directory need tags (centers use a smaller set). */
  const NEED_ALIASES = {
    expecting: ["expecting"],
    "new-mom": ["new-mom"],
    housing: ["housing"],
    /* Specific supply needs prefer exact tags, then generic supplies */
    food: ["food", "supplies"],
    diapers: ["diapers", "supplies"],
    formula: ["formula", "supplies"],
    clothes: ["clothes", "supplies"],
    "car-seat": ["car-seat", "supplies"],
    supplies: ["supplies"],
    parenting: ["parenting", "new-mom"],
    childcare: ["childcare", "new-mom", "supplies"],
    job: ["job", "apply", "talk"],
    ultrasound: ["expecting"],
    ride: ["expecting"],
    mentor: ["talk"],
    talk: ["talk"],
    counseling: ["counseling"],
    apply: ["apply", "expecting", "new-mom"],
    adoption: ["adoption"]
  };

  /* Short honest labels for need tags shown on cards (never invent diapers from supplies). */
  const OFFER_NEED_LABELS = {
    expecting: "Pregnancy support",
    "new-mom": "New-mom support",
    housing: "Housing help",
    food: "Food help",
    diapers: "Diapers",
    formula: "Formula",
    clothes: "Baby clothes",
    "car-seat": "Car seats",
    supplies: "Baby supplies",
    parenting: "Parenting classes",
    childcare: "Childcare",
    job: "Job help",
    ultrasound: "Ultrasound",
    ride: "Rides",
    mentor: "Mentoring",
    talk: "Someone to talk to",
    counseling: "Pregnancy counseling",
    apply: "Help applying for aid",
    adoption: "Adoption information"
  };

  function servicesOfferHtml(center, limit) {
    return offerTagsHtml(center, [], limit);
  }

  /** Exact need-tag overlap for display (no alias expansion — avoids fake item claims). */
  function exactNeedMatches(center, needs) {
    const cNeeds = (center && center.needs) || [];
    return (needs || []).filter((n) => cNeeds.includes(n));
  }

  /**
   * Offer pills: center.services first, then truthful c.needs labels only when tagged.
   * Never invent diapers/formula/clothes. "Baby supplies" only when supplies is tagged
   * (or already present as a service string).
   */
  function honestOfferItems(center, selectedNeeds) {
    const items = [];
    const seen = Object.create(null);
    const selected = selectedNeeds || [];
    const selectedSet = Object.create(null);
    selected.forEach((n) => { selectedSet[n] = 1; });
    const svcList = Array.isArray(center && center.services) ? center.services : [];
    const needList = Array.isArray(center && center.needs) ? center.needs : [];

    function serviceMatchesNeed(sk, n) {
      if (!n) return false;
      if (n === "ultrasound") return /ultrasound/.test(sk);
      if (n === "mentor") return /mentor/.test(sk);
      if (n === "counseling") return /counsel/.test(sk);
      if (n === "parenting") return /parenting/.test(sk);
      if (n === "adoption") return /adoption/.test(sk);
      if (n === "talk") return /mentor|counsel|listen|talk|hotline/.test(sk);
      if (n === "housing") return /hous/.test(sk);
      if (n === "supplies" || n === "diapers" || n === "formula" || n === "clothes" || n === "food" || n === "car-seat") {
        return /baby\s*supplies|\bsupplies\b/.test(sk);
      }
      return sk.indexOf(String(n).replace(/-/g, " ")) >= 0 || sk.indexOf(n) >= 0;
    }

    svcList.forEach((s) => {
      const lab = String(s || "").trim();
      if (!lab) return;
      const key = lab.toLowerCase();
      if (seen[key]) return;
      seen[key] = 1;
      const matched = selected.some((n) => serviceMatchesNeed(key, n));
      items.push({ label: lab, kind: "service", matched: !!matched });
    });

    const NEED_DISPLAY_ORDER = [
      "ultrasound", "mentor", "counseling", "housing", "supplies", "food",
      "diapers", "formula", "clothes", "parenting", "talk", "adoption",
      "childcare", "job", "car-seat", "expecting", "new-mom", "ride", "apply"
    ];
    NEED_DISPLAY_ORDER.forEach((nid) => {
      if (needList.indexOf(nid) === -1) return;
      const lab = OFFER_NEED_LABELS[nid];
      if (!lab) return;
      const key = lab.toLowerCase();
      const coveredByService = svcList.some((s) => serviceMatchesNeed(String(s).toLowerCase(), nid));
      if (coveredByService) return;
      if (seen[key]) return;
      seen[key] = 1;
      items.push({ label: lab, kind: "need", needId: nid, matched: !!selectedSet[nid] });
    });

    return items;
  }

  function offerTagsHtml(center, selectedNeeds, limit) {
    const lim = limit == null ? 10 : limit;
    const items = honestOfferItems(center, selectedNeeds).slice(0, lim);
    if (!items.length) return "";
    return `<div class="services offer-tags" aria-label="What this center offers">${items.map((it) => {
      const cls = "service-pill offer-service" + (it.kind === "need" ? " offer-need" : "") + (it.matched ? " is-match" : "");
      return `<span class="${cls}">${escapeHtml(it.label)}</span>`;
    }).join("")}</div>`;
  }

  function expandNeeds(needs) {
    const out = new Set();
    (needs || []).forEach((n) => {
      (NEED_ALIASES[n] || [n]).forEach((x) => out.add(x));
    });
    return [...out];
  }

  function centerNeedOverlap(center, needs) {
    const expanded = expandNeeds(needs);
    const cNeeds = center.needs || [];
    return expanded.filter((n) => cNeeds.includes(n));
  }

  function isNational(c) {
    return (c.type || "").toLowerCase().includes("national") || c.zip === "00000" || (c.city || "").toLowerCase() === "nationwide";
  }

  function hasContact(c) {
    return !!(c.email || c.phone);
  }

  function matchCenters(loc, needs) {
    const q = (loc || "").trim();
    syncGeoModeFromTypedLocation(q);
    const geo = geoForQuery(q);
    const queryForRank = isNearMeQuery(q) ? "" : q;
    /* Rank by proximity first (no need-first) so locals beat nationals; soft need boosts applied below */
    const result = rankCenters(queryForRank, [], { limit: 80, geo: geo });
    const resolved = result.resolved;
    const wantCounseling = (needs || []).includes("counseling");
    const SOFT_BAND_MI = 20;

    function scoreOne(c) {
      const covered = centerNeedOverlap(c, needs);
      let overlap = covered.length;
      const national = isNational(c);
      const hasEmail = !!c.email;
      const hasPhone = !!c.phone;
      let counselBoost = 0;
      if (wantCounseling && !national) {
        const svc = ((c.services || []).join(" ") + " " + (c.blurb || "")).toLowerCase();
        const offers =
          (c.needs || []).includes("counseling") ||
          /pregnancy\s*counsel|options\s*counsel|decision\s*coach|\bcounsel(?:ing|ling)?\b/.test(svc);
        if (offers) {
          counselBoost = 1;
          if (!(c.needs || []).includes("counseling") && !covered.includes("counseling")) {
            covered.push("counseling");
            overlap = covered.length;
          }
        }
      }
      const dist = (c._dist != null && isFinite(c._dist)) ? c._dist : Infinity;
      return { c, covered, overlap, dist, national, hasEmail, hasPhone, counselBoost };
    }

    const allContactable = getCenters().filter(hasContact).map((c) => {
      let dist = Infinity;
      if (!isNational(c) && resolved && resolved.lat != null && c.lat != null) {
        dist = haversineMiles(resolved, c);
      }
      const copy = Object.assign({}, c, { _dist: dist });
      return scoreOne(copy);
    });

    const locals = allContactable
      .filter((s) => !s.national && s.dist <= LOCAL_MILES)
      .sort((a, b) => a.dist - b.dist || b.overlap - a.overlap || a.c.name.localeCompare(b.c.name));

    function softSortLocals(list) {
      if (!list.length) return list;
      const closest = list[0].dist;
      return list.slice().sort((a, b) => {
        const aNear = a.dist <= closest + SOFT_BAND_MI;
        const bNear = b.dist <= closest + SOFT_BAND_MI;
        if (aNear && bNear) {
          return (
            b.overlap - a.overlap ||
            b.counselBoost - a.counselBoost ||
            (b.hasEmail ? 1 : 0) - (a.hasEmail ? 1 : 0) ||
            a.dist - b.dist ||
            a.c.name.localeCompare(b.c.name)
          );
        }
        return a.dist - b.dist || b.overlap - a.overlap || a.c.name.localeCompare(b.c.name);
      });
    }

    let chosen = [];
    let mode = result.mode || "browse";

    if (locals.length) {
      chosen = softSortLocals(locals);
      mode = (resolved && resolved.zip && chosen[0] && chosen[0].c.zip === resolved.zip) ? "exact" : "local";
    } else if (resolved && resolved.state) {
      const inState = allContactable
        .filter((s) => !s.national && s.c.state === resolved.state)
        .sort((a, b) => a.dist - b.dist || b.overlap - a.overlap || a.c.name.localeCompare(b.c.name));
      if (inState.length) {
        chosen = inState;
        mode = "in-state";
      }
    }

    if (!chosen.length && resolved && resolved.lat != null) {
      const byDist = allContactable
        .filter((s) => !s.national)
        .sort((a, b) => a.dist - b.dist || b.overlap - a.overlap);
      if (byDist.length) {
        chosen = byDist;
        mode = "national-geo";
      }
    }

    /* Nationals only after locals — never Best match when a contactable local exists */
    const nationals = allContactable
      .filter((s) => s.national)
      .sort((a, b) => b.overlap - a.overlap || a.c.name.localeCompare(b.c.name));

    let list;
    if (chosen.length) {
      list = chosen.concat(nationals.filter((n) => !chosen.some((x) => x.c.id === n.c.id)));
    } else {
      list = nationals.length ? nationals : allContactable.sort((a, b) => b.overlap - a.overlap);
      mode = "national";
    }

    const mapped = list.map((s) => {
      const c = s.c;
      c._covered = s.covered;
      c._overlap = s.overlap;
      c._dist = s.dist;
      c._national = s.national;
      c._isLocalBest = !s.national && (mode === "local" || mode === "exact" || mode === "in-state");
      return c;
    });

    const top = mapped.slice(0, 3);
    top._matchMode = mode;
    top._resolved = resolved;
    return top;
  }

  function formatDistShort(miles) {
    if (miles == null || !isFinite(miles)) return "";
    if (miles < 10) return miles.toFixed(1) + " mi";
    return Math.round(miles) + " mi";
  }

  function needLabelsList(needs) {
    return (needs || []).map((n) => NEED_LABELS[n] || n);
  }

  function buildMessage(data, centers) {
    const needText = data.needs.map((n) => NEED_LABELS[n] || n).join("; ") || "General support";
    const centerNames = centers.map((c) => c.name).join(", ");
    const church = data.church ? `\nChurch preference: ${data.church}` : "";
    const contactParts = [];
    if (data.email) contactParts.push(`Email: ${data.email}`);
    if (data.phone) contactParts.push(`Phone: ${data.phone}`);
    const contact = contactParts.join(" · ") || "(she will follow up)";

    const subject = `Support request from ${data.firstName} via Hearth & Hope`;
    const body =
`Hello,

My name is ${data.firstName}. I’m reaching out through Hearth & Hope, an app that helps mothers connect with local support. I gave permission for this message to be sent on my behalf.

Location: ${data.location}
Situation: ${needText}${church}
Preferred contact: ${contact}

Message:
${data.message || "(No additional note — please reach out with available help.)"}

Thank you for the work you do. Please contact me at your earliest convenience.

— ${data.firstName}
(Draft prepared with Hearth & Hope; centers: ${centerNames})`;

    const sms =
`Hi, I'm ${data.firstName}. Hearth & Hope connected me. Near ${data.location}. Needs: ${needText}. ${data.phone ? "Call/text " + data.phone + "." : ""} ${data.email ? "Email " + data.email + "." : ""} ${data.message || ""}`.replace(/\s+/g, " ").trim();

    return { subject, body, sms };
  }

  function readForm() {
    const fd = new FormData(helpForm);
    return {
      firstName: (fd.get("firstName") || "").toString().trim(),
      email: (fd.get("email") || "").toString().trim(),
      phone: (fd.get("phone") || "").toString().trim(),
      location: (fd.get("location") || "").toString().trim(),
      church: (fd.get("church") || "").toString().trim(),
      message: (fd.get("message") || "").toString().trim(),
      consent: helpForm.querySelector("#consent") && helpForm.querySelector("#consent").checked,
      needs: selectedNeeds()
    };
  }

  function openMailto(email, subject, body) {
    const mailto = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const mailLink = document.createElement("a");
    mailLink.href = mailto;
    mailLink.style.display = "none";
    document.body.appendChild(mailLink);
    mailLink.click();
    mailLink.remove();
  }

  function validateForSend(data, centers) {
    const errors = [];
    if (!data.firstName) errors.push("Please enter your first name.");
    if (!data.location) errors.push("Please enter a city or ZIP.");
    if (!data.email && !data.phone) errors.push("Please share an email and/or phone so they can reach you.");
    if (!data.needs.length) errors.push("Select at least one kind of help.");
    if (!data.consent) errors.push("Please check the consent box before we open your mail or messages app.");
    if (!centers.length) errors.push("We couldn’t match a place yet. Try a ZIP or nearby city.");
    return errors;
  }

  function updatePreview() {
    if (!helpForm || !matchEl) return;
    const data = readForm();
    const helpNote = document.getElementById("help-geo-note");
    syncGeoModeFromTypedLocation(data.location);
    if (helpNote) {
      if (geoOverride && (isNearMeQuery(data.location) || !String(data.location || "").trim())) {
        helpNote.hidden = false;
        helpNote.textContent = "Using your current location for matching.";
        helpNote.style.color = "";
      } else if (String(data.location || "").trim() && !isNearMeQuery(data.location)) {
        /* Typed ZIP/city — do not leave a stale GPS status */
        if (helpNote.textContent && /current location/i.test(helpNote.textContent)) {
          helpNote.hidden = true;
          helpNote.textContent = "";
        }
      }
    }
    const centers = (data.location || data.needs.length || geoOverride)
      ? matchCenters(data.location, data.needs)
      : [];
    const msg = buildMessage(
      data.firstName ? data : { ...data, firstName: "Friend" },
      centers.length ? centers : [{ name: "(centers appear when you enter a city/ZIP)" }]
    );

    const primaryBtn = document.getElementById("help-primary-btn");
    const secondaryCall = document.getElementById("help-call-btn");
    const secondarySms = document.getElementById("help-sms-btn");

    if (!data.location && !data.needs.length && !geoOverride) {
      matchEl.innerHTML = `<p class="hint">Enter your city or ZIP and check what you need — we’ll show the nearest places here.</p>`;
      if (primaryBtn) primaryBtn.textContent = "Email best match now";
      if (secondaryCall) secondaryCall.hidden = true;
      if (secondarySms) secondarySms.hidden = true;
      if (previewEl) previewEl.textContent = "Fill in the form to see your draft…";
      helpForm._lastPreview = { data, centers, msg };
      return;
    }

    if (!centers.length) {
      const unresolved = centers._resolved && centers._resolved.source === "unresolved";
      matchEl.innerHTML = unresolved
        ? `<p class="hint">Could not place that location. Check the ZIP or try a nearby city.</p>`
        : `<p class="hint">No match yet. Try another city or ZIP.</p>`;
      helpForm._lastPreview = { data, centers, msg };
      return;
    }

    const best = centers[0];
    const needPhrase = data.needs.length
      ? needLabelsList(data.needs).slice(0, 2).join(", ").replace(/^I /i, "").replace(/^I’m /i, "")
      : "support";
    const resolved = centers._resolved;
    const placeLabel = (resolved && resolved.source === "geo")
      ? "your current location"
      : (resolved && resolved.label
        ? resolved.label
        : (isNearMeQuery(data.location) ? "your current location" : (data.location || "").trim()));
    const bestIsNational = isNational(best);

    const cards = centers.map((c, idx) => {
      const dist = formatDistShort(c._dist);
      const nat = isNational(c);
      let badge;
      if (nat) {
        badge = `<span class="match-badge quiet">National line</span>`;
      } else if (idx === 0) {
        badge = `<span class="match-badge">Best match</span>`;
      } else {
        badge = `<span class="match-badge quiet">Also nearby</span>`;
      }
      /* Display: services are source of truth; exact need matches only (no soft alias claims). */
      const exact = exactNeedMatches(c, data.needs);
      const matchBits = exact.map((n) => OFFER_NEED_LABELS[n] || n);
      const covLine = nat
        ? "National helpline — can connect you locally"
        : (matchBits.length
          ? `Matches your needs: ${matchBits.map(escapeHtml).join(", ")}`
          : "Listed services below — ask them what they can offer for your situation.");
      const offerHtml = nat ? "" : offerTagsHtml(c, data.needs, 6);
      const actions = [];
      /* Prefer Call on phone-only locals; Email only when the center has email (user taps national Email explicitly). */
      if (!nat && c.phone && !c.email) {
        actions.push(`<a class="btn ${idx === 0 ? "btn-primary" : "btn-secondary"}" href="tel:${escapeAttr(c.phone)}">Call</a>`);
      } else {
        if (c.email) {
          actions.push(`<button type="button" class="btn ${idx === 0 && c.email ? "btn-primary" : "btn-secondary"}" data-match-email="${escapeAttr(c.id)}">Email</button>`);
        }
        if (c.phone) {
          actions.push(`<a class="btn btn-secondary" href="tel:${escapeAttr(c.phone)}">Call</a>`);
        }
      }
      const locBits = nat
        ? "Nationwide"
        : `${escapeHtml(c.city)}${c.state && c.state !== "US" ? ", " + escapeHtml(c.state) : ""}${dist ? " · " + escapeHtml(dist) : ""}`;
      return `
        <article class="match-card${idx === 0 && !nat ? " match-card-best" : ""}" data-center-id="${escapeAttr(c.id)}">
          <header class="match-card-head">${badge}
            <h3>${escapeHtml(c.name)}</h3>
          </header>
          <p class="match-meta">${locBits} · ${escapeHtml(nat ? "National helpline" : (c.type || ""))}</p>
          <p class="match-cov">${covLine}</p>
          ${offerHtml}
          <div class="match-actions">${actions.join("")}</div>
        </article>`;
    }).join("");

    const leadNear = placeLabel
      ? `Near ${escapeHtml(placeLabel)}`
      : "Near you";
    matchEl.innerHTML = `
      <div class="match-live">
        <p class="match-lead"><strong>${leadNear} — help for ${escapeHtml(needPhrase)}.</strong> Tap to connect.</p>
        ${cards}
      </div>`;

    /* Wire per-card Email buttons (respect consent) */
    matchEl.querySelectorAll("[data-match-email]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-match-email");
        const center = centers.find((c) => c.id === id) || best;
        const d = readForm();
        const errors = validateForSend(d, [center]);
        if (errors.length) {
          if (formError) {
            formError.hidden = false;
            formError.textContent = errors.join(" ");
            formError.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }
          return;
        }
        if (formError) formError.hidden = true;
        const m = buildMessage(d, [center]);
        openMailto(center.email, m.subject, m.body);
        if (formSuccess) {
          formSuccess.hidden = false;
          formSuccess.innerHTML = `<strong>Your mail app should open</strong> to ${escapeHtml(center.name)}. Review, then send.`;
        }
      });
    });

    /* Primary / secondary toolbar buttons — never mailto a national when local phone is best */
    if (primaryBtn) {
      const short = best.name.length > 28 ? best.name.slice(0, 26) + "…" : best.name;
      if (!bestIsNational && best.phone && !best.email) {
        primaryBtn.textContent = `Call ${short} now`;
        primaryBtn.dataset.mode = "call";
      } else if (!bestIsNational && best.phone && best.email) {
        primaryBtn.textContent = `Email ${short} now`;
        primaryBtn.dataset.mode = "email";
      } else if (!bestIsNational && best.phone) {
        primaryBtn.textContent = `Call ${short} now`;
        primaryBtn.dataset.mode = "call";
      } else if (best.email && (bestIsNational || !best.phone)) {
        primaryBtn.textContent = bestIsNational
          ? `Email national line`
          : `Email ${short} now`;
        primaryBtn.dataset.mode = "email";
      } else if (best.phone) {
        primaryBtn.textContent = `Call ${short} now`;
        primaryBtn.dataset.mode = "call";
      } else {
        primaryBtn.textContent = "Connect to best match";
        primaryBtn.dataset.mode = "call";
      }
    }
    if (secondaryCall) {
      if (best.phone && best.email && !bestIsNational) {
        secondaryCall.hidden = false;
        secondaryCall.href = `tel:${best.phone}`;
        secondaryCall.textContent = `Call ${best.phone}`;
      } else if (bestIsNational && best.phone) {
        secondaryCall.hidden = false;
        secondaryCall.href = `tel:${best.phone}`;
        secondaryCall.textContent = `Call national line`;
      } else if (best.phone && !best.email) {
        secondaryCall.hidden = true;
      } else {
        secondaryCall.hidden = true;
      }
    }
    if (secondarySms) {
      if (best.phone) {
        secondarySms.hidden = false;
        secondarySms.textContent = "Text best match";
      } else {
        secondarySms.hidden = true;
      }
    }

    if (previewEl) {
      previewEl.textContent =
`Subject: ${msg.subject}

${msg.body}

——— SMS version ———
${msg.sms}`;
    }

    helpForm._lastPreview = { data, centers, msg, best };
  }

  var _previewTimer = null;
  function scheduleUpdatePreview() {
    if (_previewTimer) clearTimeout(_previewTimer);
    _previewTimer = setTimeout(function () {
      _previewTimer = null;
      updatePreview();
    }, 300);
  }

  if (helpForm) {
    helpForm.addEventListener("input", scheduleUpdatePreview);
    helpForm.addEventListener("change", scheduleUpdatePreview);

    helpForm.addEventListener("submit", (e) => {
      e.preventDefault();
      if (formError) formError.hidden = true;
      if (formSuccess) formSuccess.hidden = true;

      const data = readForm();
      const centers = matchCenters(data.location, data.needs);
      const best = centers[0];
      const errors = validateForSend(data, centers);
      if (errors.length) {
        if (formError) {
          formError.hidden = false;
          formError.textContent = errors.join(" ");
        }
        return;
      }

      const primaryBtn = document.getElementById("help-primary-btn");
      const bestNat = isNational(best);
      const mode = (primaryBtn && primaryBtn.dataset.mode) ||
        ((!bestNat && best.phone && !best.email) ? "call" : (best.email ? "email" : "call"));
      const msg = buildMessage(data, best.email ? [best] : centers);

      if ((mode === "call" || (!best.email && best.phone)) && best.phone) {
        window.location.href = "tel:" + best.phone;
        if (formSuccess) {
          formSuccess.hidden = false;
          formSuccess.innerHTML = `<strong>Calling ${escapeHtml(best.name)}</strong> — ${escapeHtml(best.phone)}.`;
        }
      } else if (best.email && (mode === "email" || bestNat)) {
        /* Email only the selected best (or explicit card). Do not silently swap to a national
           when a local phone best-match exists — that path is handled by Call above. */
        const m = buildMessage(data, [best]);
        openMailto(best.email, m.subject, m.body);
        if (formSuccess) {
          formSuccess.hidden = false;
          formSuccess.innerHTML = `<strong>Your mail app should open</strong> to ${escapeHtml(best.name)}. Review it, then send.`;
        }
      } else {
        /* No local contact: allow national email fallback */
        let target = centers.find((c) => c.email) || getCenters().find((c) => isNational(c) && c.email);
        if (!target || !target.email) {
          if (formError) {
            formError.hidden = false;
            formError.textContent = "This match has no email. Use Call or Text instead.";
          }
          return;
        }
        const m = buildMessage(data, [target]);
        openMailto(target.email, m.subject, m.body);
        if (formSuccess) {
          formSuccess.hidden = false;
          formSuccess.innerHTML = `<strong>Your mail app should open</strong> to ${escapeHtml(target.name)}. Review it, then send.`;
        }
      }

      const preferSms = helpForm.querySelector("#prefer-sms") && helpForm.querySelector("#prefer-sms").checked;
      if (preferSms && best && best.phone && mode !== "call") {
        const digits = best.phone.replace(/[^\d+]/g, "");
        const smsUrl = `sms:${digits}?&body=${encodeURIComponent(msg.sms)}`;
        window.setTimeout(() => { window.location.href = smsUrl; }, 600);
      }

      helpForm._lastPreview = { data, centers, msg, best };
      updatePreview();
      formSuccess && formSuccess.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });

    const smsBtn = document.getElementById("help-sms-btn");
    if (smsBtn) {
      smsBtn.addEventListener("click", () => {
        const data = readForm();
        const centers = matchCenters(data.location, data.needs);
        const best = centers[0];
        const errors = validateForSend(data, centers);
        if (errors.length) {
          if (formError) {
            formError.hidden = false;
            formError.textContent = errors.join(" ");
          }
          return;
        }
        if (!best || !best.phone) return;
        const msg = buildMessage(data, [best]);
        const digits = best.phone.replace(/[^\d+]/g, "");
        window.location.href = `sms:${digits}?&body=${encodeURIComponent(msg.sms)}`;
      });
    }
  }

  if (copyMsgBtn) {
    copyMsgBtn.addEventListener("click", async () => {
      const last = helpForm && helpForm._lastPreview;
      const text = last && last.msg
        ? `Subject: ${last.msg.subject}\n\n${last.msg.body}`
        : (previewEl && previewEl.textContent) || "";
      try {
        await navigator.clipboard.writeText(text);
        copyMsgBtn.textContent = "Copied!";
        setTimeout(() => { copyMsgBtn.textContent = "Copy message"; }, 2000);
      } catch {
        copyMsgBtn.textContent = "Select text above to copy";
        setTimeout(() => { copyMsgBtn.textContent = "Copy message"; }, 2500);
      }
    });
  }

  /* Prefill ZIP from directory links */
  document.body.addEventListener("click", (e) => {
    const a = e.target.closest("[data-pref-zip]");
    if (!a) return;
    const zip = a.getAttribute("data-pref-zip");
    window.setTimeout(() => {
      const loc = document.getElementById("location");
      if (loc && zip) {
        loc.value = zip;
        updatePreview();
      }
    }, 100);
  });

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/'/g, "&#39;");
  }

  /* ---------- PWA: service worker, install prompt, standalone ---------- */
  const DISMISS_KEY = "hearthHopeInstallDismissed";
  let deferredInstallPrompt = null;

  function isStandalone() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      window.navigator.standalone === true
    );
  }

  function isIos() {
    const ua = window.navigator.userAgent || "";
    const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    return iOS;
  }

  function isSafari() {
    const ua = window.navigator.userAgent || "";
    return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|Chrome|Android/.test(ua);
  }

  function wasDismissed() {
    try {
      return localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  }

  function setDismissed() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch { /* ignore */ }
  }

  function showInstallBanner({ showInstallBtn, showIosSteps }) {
    const banner = document.getElementById("install-banner");
    const installBtn = document.getElementById("install-btn");
    const iosSteps = document.getElementById("ios-install-steps");
    const hint = document.getElementById("install-banner-hint");
    if (!banner || wasDismissed() || isStandalone()) return;

    banner.hidden = false;
    if (installBtn) installBtn.hidden = !showInstallBtn;
    if (iosSteps) iosSteps.hidden = !showIosSteps;
    if (hint) {
      if (showIosSteps) {
        hint.textContent = "On iPhone, use Safari’s Share menu — steps below. You can dismiss this tip anytime.";
      } else if (showInstallBtn) {
        hint.textContent = "Install for a full-screen app and offline access to pages you’ve opened.";
      } else {
        hint.textContent = "Keep resources and help one tap away — works offline for pages you’ve already opened.";
      }
    }
  }

  function hideInstallBanner() {
    const banner = document.getElementById("install-banner");
    if (banner) banner.hidden = true;
  }

  function wireInstallUI() {
    if (isStandalone()) {
      document.body.classList.add("standalone-mode");
      hideInstallBanner();
      const aboutBtn = document.getElementById("about-install-btn");
      if (aboutBtn) aboutBtn.hidden = true;
      return;
    }

    const dismissBtn = document.getElementById("install-dismiss");
    if (dismissBtn) {
      dismissBtn.addEventListener("click", () => {
        setDismissed();
        hideInstallBanner();
      });
    }

    const installBtn = document.getElementById("install-btn");
    const aboutInstallBtn = document.getElementById("about-install-btn");

    async function triggerInstall() {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      try {
        await deferredInstallPrompt.userChoice;
      } catch { /* ignore */ }
      deferredInstallPrompt = null;
      hideInstallBanner();
      if (installBtn) installBtn.hidden = true;
      if (aboutInstallBtn) aboutInstallBtn.hidden = true;
    }

    if (installBtn) installBtn.addEventListener("click", triggerInstall);
    if (aboutInstallBtn) {
      aboutInstallBtn.addEventListener("click", triggerInstall);
    }

    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      if (aboutInstallBtn) aboutInstallBtn.hidden = false;
      if (!wasDismissed()) {
        showInstallBanner({ showInstallBtn: true, showIosSteps: false });
      }
    });

    window.addEventListener("appinstalled", () => {
      deferredInstallPrompt = null;
      hideInstallBanner();
      setDismissed();
    });

    /* iOS Safari: gentle how-to (no beforeinstallprompt) */
    if (isIos() && !isStandalone() && !wasDismissed()) {
      /* Delay slightly so it doesn’t compete with first paint */
      window.setTimeout(() => {
        showInstallBanner({ showInstallBtn: false, showIosSteps: true });
      }, 1800);
    }
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    /* Only register when served over http(s) — not file:// */
    if (!window.location.protocol.startsWith("http")) return;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch((err) => {
        console.warn("Service worker registration failed:", err);
      });
    });
  }

  function wireOfflineToast() {
    let toast = document.getElementById("offline-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "offline-toast";
      toast.className = "offline-toast";
      toast.hidden = true;
      toast.setAttribute("role", "status");
      toast.textContent = "You’re offline — showing saved pages only. No new medical content is invented.";
      document.body.appendChild(toast);
    }
    function sync() {
      toast.hidden = navigator.onLine;
    }
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    sync();
  }


  function applyHelpPrefill(opts) {
    opts = opts || {};
    if (!helpForm) {
      try { sessionStorage.setItem("hearthHelpPrefill", JSON.stringify(opts)); } catch (e) {}
      location.hash = "#help";
      return;
    }
    if (opts.location) {
      const loc = document.getElementById("location");
      if (loc) loc.value = opts.location;
    }
    if (opts.firstName) {
      const fn = document.getElementById("firstName");
      if (fn && !fn.value) fn.value = opts.firstName;
    }
    if (opts.message) {
      const msg = document.getElementById("message");
      if (msg) msg.value = opts.message;
    }
    if (opts.needs && opts.needs.length) {
      helpForm.querySelectorAll('input[name="needs"]').forEach((cb) => {
        if (opts.needs.indexOf(cb.value) !== -1) cb.checked = true;
      });
    }
    updatePreview();
    location.hash = "#help";
    window.setTimeout(updatePreview, 50);
  }

  function consumeStoredHelpPrefill() {
    try {
      const raw = sessionStorage.getItem("hearthHelpPrefill");
      if (!raw) return;
      sessionStorage.removeItem("hearthHelpPrefill");
      applyHelpPrefill(JSON.parse(raw));
    } catch (e) {}
  }

  window.addEventListener("hashchange", () => {
    if ((location.hash || "").replace(/^#/, "") === "help") {
      window.setTimeout(consumeStoredHelpPrefill, 0);
    }
  });

  window.HearthHelp = {
    applyHelpPrefill: applyHelpPrefill,
    updatePreview: updatePreview,
    matchCenters: matchCenters,
    rankCenters: rankCenters,
    NEED_LABELS: NEED_LABELS
  };

  /* Boot */

  populateTypeFilter();
  renderResources();
  renderCenters();
  updatePreview();
  route();
  if ((location.hash || "").replace(/^#/, "") === "help") consumeStoredHelpPrefill();
  wireInstallUI();

  registerServiceWorker();
  wireOfflineToast();
})();
