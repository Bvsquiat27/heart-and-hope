/**
 * Nationwide ZIP proof for Heart & Hope ≥1.6.10
 * Asserts lookupZip prefix/SCF fallback covers PO Box / unique ZIPs,
 * nearest life-affirming centers have finite miles, and no abortion providers.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import vm from "vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadWindowScripts(files) {
  const window = globalThis;
  window.window = window;
  for (const f of files) {
    const code = fs.readFileSync(path.join(root, f), "utf8");
    vm.runInThisContext(code, { filename: f });
  }
  return window;
}

loadWindowScripts([
  "data/centers.js",
  "data/zips.js",
  "data/zip-coords.js",
  "js/centers-filter.js",
  "js/geo.js"
]);

const zips = globalThis.HEART_ZIPS || {};
const filter = globalThis.HeartCentersFilter;
let centers = globalThis.HEART_CENTERS || [];
if (filter) centers = filter.filterLifeAffirming(centers);

const PROVEN_CITIES = [
  "10001", "77002", "90210", "60614", "33101", "98101",
  "19103", "02115", "75201", "80202", "37203", "94102", "10458"
];

const FORMER_FAILS = ["30301", "85001"]; // Atlanta PO Box, Phoenix PO Box
const RURAL = ["59715", "83201"]; // Bozeman MT, Pocatello ID
const EXTRA = [
  "19107", "20001", "30303", "85003", "99501", "96813",
  "87101", "64101", "55401", "43215"
];

const PR_CANDIDATES = ["00601", "00602", "00901", "00725"];
const prPresent = PR_CANDIDATES.filter((z) => zips[z] || (globalThis.HEART_ZIP_COORDS && globalThis.HEART_ZIP_COORDS[z]));
const prAnyScf = Object.keys(zips).some((k) => k.startsWith("006") || k.startsWith("007") || k.startsWith("009"));

const TEST_ZIPS = [...new Set([...PROVEN_CITIES, ...FORMER_FAILS, ...RURAL, ...EXTRA, ...prPresent])];

function scfNeighborExists(z) {
  const z3 = z.slice(0, 3);
  return Object.keys(zips).some((k) => k.startsWith(z3));
}

function topResults(origin, limit = 8) {
  return centers
    .filter((c) => {
      if (c.lat == null || c.lng == null) return false;
      const nat =
        (c.type || "").toLowerCase().includes("national") ||
        c.zip === "00000" ||
        (c.city || "").toLowerCase() === "nationwide";
      return !nat;
    })
    .map((c) => ({
      c,
      miles: globalThis.HeartGeo.haversineMiles(origin, c)
    }))
    .sort((a, b) => a.miles - b.miles)
    .slice(0, limit);
}

const ABORTION_RE =
  /\b(planned\s*parenthood|abortion\s*clinic|abortion\s*provider|provide[s]?\s+abortions?|abortion\s+services)\b/i;

let failed = false;
let passed = 0;
const rows = [];

console.log("HEART_ZIPS count:", Object.keys(zips).length);
console.log("PR in dataset?", prPresent.length ? prPresent.join(",") : "none");
if (!prPresent.length) {
  console.log(
    prAnyScf
      ? "NOTE: PR SCF keys exist but candidates not listed — skipping PR-specific asserts."
      : "NOTE: Puerto Rico ZIPs not present in HEART_ZIPS — skip PR honestly."
  );
}

for (const zip of TEST_ZIPS) {
  const hit = globalThis.HeartGeo.lookupZip(zip);
  const hasScf = scfNeighborExists(zip);
  const exactInDb = !!zips[zip];

  if (!hit) {
    if (hasScf) {
      console.error(`FAIL ${zip}: lookupZip null but SCF neighbor exists`);
      failed = true;
      rows.push({ zip, ok: false, reason: "null despite SCF" });
      continue;
    }
    console.log(`SKIP ${zip}: no SCF neighbor in HEART_ZIPS (honest miss)`);
    rows.push({ zip, ok: true, skipped: true });
    continue;
  }

  if (hit.zip !== zip) {
    console.error(`FAIL ${zip}: .zip should preserve typed ZIP, got ${hit.zip}`);
    failed = true;
  }
  if (!exactInDb && !hit.matchedZip && hit.lat == null) {
    console.error(`FAIL ${zip}: miss without matchedZip/coords`);
    failed = true;
  }
  if (hit.lat == null || hit.lng == null || !isFinite(hit.lat) || !isFinite(hit.lng)) {
    console.error(`FAIL ${zip}: bad lat/lng`, hit);
    failed = true;
    continue;
  }

  const top = topResults(hit);
  if (!top.length) {
    console.error(`FAIL ${zip}: no local centers ranked`);
    failed = true;
    continue;
  }
  const badMiles = top.filter((t) => !isFinite(t.miles));
  if (badMiles.length) {
    console.error(`FAIL ${zip}: non-finite miles in top`);
    failed = true;
  }
  const abortHit = top.find((t) => {
    const blob = [t.c.name, t.c.city, t.c.notes, t.c.services, (t.c.needs || []).join(" ")].join(" ");
    return ABORTION_RE.test(blob) || /planned\s*parenthood/i.test(t.c.name || "");
  });
  if (abortHit) {
    console.error(`FAIL ${zip}: abortion provider in top: ${abortHit.c.name}`);
    failed = true;
  }

  const nearest = top[0];
  const note =
    hit.matchedZip && hit.matchedZip !== zip
      ? `via ${hit.matchedZip}`
      : exactInDb
        ? "exact"
        : "zip-coords";
  const LOCAL_MAX = 100;
  const localsNear = top.filter((t) => t.miles <= LOCAL_MAX);
  if (!localsNear.length) {
    /* No life-affirming center within 100mi — must NOT false-pass Miami-as-nearby.
       Honest path: label FAR and require Get Help nationals-first (checked below). */
    console.log(
      `FAR ${zip} ${String(hit.city || "").padEnd(14)} ${hit.state || "--"}  ` +
        `no local ≤${LOCAL_MAX}mi; nearest mainland ${nearest.miles.toFixed(1)} mi ` +
        `${nearest.c.city}, ${nearest.c.state} (${note}) — nationals-first required`
    );
    rows.push({
      zip,
      ok: false,
      far: true,
      city: hit.city,
      state: hit.state,
      matchedZip: hit.matchedZip || null,
      nearestMi: nearest.miles,
      reason: `no local ≤${LOCAL_MAX}mi (nearest ${nearest.miles.toFixed(1)}mi ${nearest.c.city})`
    });
    /* Mark failed until nationals-first gate passes for this ZIP */
    failed = true;
    continue;
  }
  console.log(
    `OK  ${zip} ${String(hit.city || "").padEnd(14)} ${hit.state || "--"}  ` +
      `→ #1 ${localsNear[0].miles.toFixed(1)} mi ${localsNear[0].c.city}, ${localsNear[0].c.state} (${note})`
  );
  passed++;
  rows.push({ zip, ok: true, city: hit.city, state: hit.state, matchedZip: hit.matchedZip || null, nearestMi: localsNear[0].miles });
}

// Explicit before/after style checks for former fails
for (const z of FORMER_FAILS) {
  const hit = globalThis.HeartGeo.lookupZip(z);
  if (!hit || hit.zip !== z || hit.lat == null) {
    console.error(`FAIL former-miss ${z} still unresolved`);
    failed = true;
  } else {
    console.log(`FORMER FAIL FIXED: ${z} → ${hit.city}, ${hit.state} matchedZip=${hit.matchedZip || "(coords)"}`);
  }
}

// ZIP with no SCF neighbor in HEART_ZIPS should stay null (unless zip-coords only)
const nonsense = "00000";
const nonsenseHit = globalThis.HeartGeo.lookupZip(nonsense);
if (nonsenseHit && !scfNeighborExists(nonsense) && !(globalThis.HEART_ZIP_COORDS && globalThis.HEART_ZIP_COORDS[nonsense])) {
  console.error("FAIL: 00000 should not resolve without SCF/coords");
  failed = true;
} else if (!nonsenseHit) {
  console.log("OK  00000 correctly unresolved (no SCF)");
} else {
  console.log("OK  00000 resolved via available data");
}

// ---------------------------------------------------------------------------
// PR / FAR gate: FAIL if Get Help Best is far mainland (~1000mi Miami).
// Loads app.js with DOM stubs; asserts HeartHelp.matchCenters nationals-first.
// ---------------------------------------------------------------------------
const farRows = rows.filter((r) => r.far);

function isNatCenter(c) {
  return (
    (c.type || "").toLowerCase().includes("national") ||
    c.zip === "00000" ||
    (c.city || "").toLowerCase() === "nationwide"
  );
}

function loadAppForMatchCenters() {
  class El {
    constructor(tag, id) {
      this.tagName = (tag || "div").toUpperCase();
      this.id = id || "";
      this.children = [];
      this.style = {};
      this.classList = { add() {}, remove() {}, toggle() {}, contains() { return false; } };
      this.attributes = {};
      this.value = "";
      this.hidden = false;
      this.textContent = "";
      this.innerHTML = "";
      this.checked = false;
      this._listeners = {};
      this.elements = [];
    }
    setAttribute(k, v) { this.attributes[k] = String(v); }
    getAttribute(k) { return this.attributes[k] ?? null; }
    addEventListener(t, fn) { (this._listeners[t] ||= []).push(fn); }
    removeEventListener() {}
    appendChild(c) { this.children.push(c); return c; }
    querySelector() { return null; }
    querySelectorAll() { return []; }
    closest() { return null; }
    focus() {}
    click() {}
    scrollIntoView() {}
    reset() {}
  }
  const byId = {};
  function el(id, tag) {
    if (!byId[id]) byId[id] = new El(tag || "div", id);
    return byId[id];
  }
  [
    "resource-chips","resource-list","resource-detail","resource-detail-title","resource-detail-body",
    "loc-filter","type-filter","center-list","dir-match-note","dir-needs",
    "use-my-location-dir","use-my-location-help","help-form","message-preview","match-preview",
    "form-error","form-success","copy-message","help-geo-note","location","firstName","message",
    "help-primary-btn","help-call-btn","help-sms-btn","install-banner","install-btn",
    "ios-install-steps","install-banner-hint","install-dismiss","about-install-btn","offline-toast",
    "nav","views","toast"
  ].forEach((id) => el(id, id === "help-form" ? "form" : "div"));

  const document = {
    getElementById: (id) => el(id),
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: (tag) => new El(tag),
    body: el("body", "body"),
    documentElement: el("html", "html"),
    addEventListener() {}
  };
  document.body.classList = { add() {}, remove() {}, toggle() {}, contains() { return false; } };

  const window = globalThis;
  window.window = window;
  window.document = document;
  window.location = {
    hash: "", href: "http://localhost/", pathname: "/", hostname: "localhost",
    protocol: "http:", origin: "http://localhost"
  };
  window.navigator = {
    geolocation: null, vibrate: null,
    serviceWorker: { register: async () => ({}) },
    userAgent: "node", onLine: true
  };
  window.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} });
  window.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  window.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  window.addEventListener = () => {};
  window.removeEventListener = () => {};
  window.history = { replaceState() {}, pushState() {} };
  window.HTMLElement = El;
  window.HTMLFormElement = El;
  window.Node = function () {};
  window.CustomEvent = function (n, o) { this.type = n; this.detail = o && o.detail; };
  window.fetch = async () => ({ ok: false, json: async () => ({}) });
  window.alert = () => {};
  window.confirm = () => false;
  window.scrollTo = () => {};
  window.FormData = class {
    constructor() { this._m = new Map(); }
    get(k) { return this._m.has(k) ? this._m.get(k) : ""; }
    set(k, v) { this._m.set(k, v); }
    append(k, v) { this._m.set(k, v); }
    entries() { return this._m.entries(); }
  };
  window.IntersectionObserver = class { observe() {} disconnect() {} };
  window.ResizeObserver = class { observe() {} disconnect() {} };

  for (const f of ["js/haptics.js", "js/app.js"]) {
    vm.runInThisContext(fs.readFileSync(path.join(root, f), "utf8"), { filename: f });
  }
  if (!window.HeartHelp || typeof window.HeartHelp.matchCenters !== "function") {
    throw new Error("HeartHelp.matchCenters not available");
  }
  return window.HeartHelp;
}

if (farRows.length) {
  console.log(`\n=== PR / FAR gate (${farRows.length} ZIP(s) with no local ≤100mi) ===`);
  let help = null;
  try {
    help = loadAppForMatchCenters();
  } catch (e) {
    console.error("FAIL PR gate: could not load matchCenters:", e && e.message ? e.message : e);
    failed = true;
  }
  if (help) {
    let farGateOk = true;
    for (const fr of farRows) {
      const top = help.matchCenters(fr.zip, ["counseling", "expecting"]);
      const best = top && top[0];
      const mode = top && top._matchMode;
      if (!best) {
        console.error(`FAIL ${fr.zip}: matchCenters returned empty`);
        failed = true;
        farGateOk = false;
        fr.ok = false;
        continue;
      }
      const bestIsNat = isNatCenter(best);
      const bestIsFarMainland = !bestIsNat && isFinite(best._dist) && best._dist > 100;
      if (bestIsFarMainland || !bestIsNat) {
        console.error(
          `FAIL ${fr.zip}: Best must be national when no local ≤100; got ` +
            `${best.city}, ${best.state} ${isFinite(best._dist) ? Number(best._dist).toFixed(1) + "mi" : ""} ` +
            `(${best.name}) mode=${mode}`
        );
        failed = true;
        farGateOk = false;
        fr.ok = false;
        continue;
      }
      console.log(
        `PASS PR gate ${fr.zip}: Best=${best.name} (national) mode=${mode}; ` +
          `nearest mainland ${Number(fr.nearestMi).toFixed(1)}mi NOT labeled Best`
      );
      fr.ok = true;
      fr.nationalsFirst = true;
      fr.bestName = best.name;
      fr.mode = mode;
    }
    if (farGateOk && farRows.every((r) => r.ok)) {
      failed = rows.some((r) => r.ok === false && !r.far && !r.skipped);
    }
  }
}

// Dallas bare-city → TX (not NC)
const dallasHit = globalThis.HeartGeo.lookupZip("Dallas");
if (!dallasHit || dallasHit.state !== "TX") {
  console.error(`FAIL bare city Dallas → expected TX, got`, dallasHit);
  failed = true;
} else {
  console.log(`OK  bare city Dallas → ${dallasHit.city}, ${dallasHit.state} ${dallasHit.zip}`);
}

// PO Box city/state enrichment
for (const z of FORMER_FAILS) {
  const hit = globalThis.HeartGeo.lookupZip(z);
  if (!hit || !hit.city || !hit.state) {
    console.error(`FAIL ${z}: blank city/state after enrichment`, hit);
    failed = true;
  }
}

console.log(`\nNationwide proof: ${passed} local ZIPs passed (${TEST_ZIPS.length} tested, FAR=${farRows.length}, PR skipped=${prPresent.length === 0})`);
if (failed) {
  console.error("FAIL: nationwide ZIP proof");
  process.exit(1);
}
console.log("PASS: nationwide ZIP lookup + finite miles + life-affirming top lists + PR/FAR nationals-first gate");
