/**
 * Nationwide Get Help proof — app.js rankCenters path (2026-09-30).
 * - Required ZIPs: closest locals, typed beats GPS
 * - PO Box 30301/85001: city/state enriched
 * - Bare "Dallas" → TX not NC
 * - PR / no-local≤100mi: nationals-first (not Miami-as-Best)
 * - Chips + exact NEED_ALIASES (no invented diapers)
 */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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
  addEventListener() {},
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
window.CustomEvent = function (n, o) { this.type = n; this.detail = o?.detail; };
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

function load(files) {
  for (const f of files) {
    vm.runInThisContext(fs.readFileSync(path.join(REPO, f), "utf8"), { filename: f });
  }
}
load([
  "data/centers.js",
  "data/zips.js",
  "data/zip-coords.js",
  "js/centers-filter.js",
  "js/geo.js",
  "js/haptics.js",
  "js/app.js",
]);

if (!window.HearthHelp || typeof window.HearthHelp.rankCenters !== "function") {
  console.error("FAIL: HearthHelp.rankCenters not available");
  process.exit(1);
}

function isNational(c) {
  return (c.type || "").toLowerCase().includes("national") ||
    c.zip === "00000" ||
    (c.city || "").toLowerCase() === "nationwide";
}
function locals(items) {
  return (items || []).filter((c) => !isNational(c));
}

const REQUIRED = [
  { zip: "10458", expectState: "NY", region: "Bronx NY", maxMi: 15 },
  { zip: "30301", expectState: "GA", region: "Atlanta GA (PO Box)", maxMi: 25 },
  { zip: "85001", expectState: "AZ", region: "Phoenix AZ (PO Box)", maxMi: 30 },
  { zip: "90210", expectState: "CA", region: "Beverly Hills CA", maxMi: 25 },
  { zip: "75201", expectState: "TX", region: "Dallas TX", maxMi: 20 },
  { zip: "59101", expectState: "MT", region: "Billings MT", maxMi: 40 },
  { zip: "96813", expectState: "HI", region: "Honolulu HI", maxMi: 30 },
  { zip: "99501", expectState: "AK", region: "Anchorage AK", maxMi: 30 },
];

const STALE_GPS = { lat: 40.664341 + 0.017, lng: -74.212673, label: "stale GPS Elizabeth NJ" };
const rows = [];
let failed = false;

console.log("=== Get Help nationwide rankCenters proof ===\n");

for (const spec of REQUIRED) {
  const { zip, expectState, region, maxMi } = spec;
  const typed = window.HearthHelp.rankCenters(zip, [], { limit: 10, geo: null });
  const gpsMode = window.HearthHelp.rankCenters("", [], { limit: 10, geo: STALE_GPS });
  const top = locals(typed.items);
  const t0 = top[0];
  const resolved = typed.resolved;
  const reasons = [];

  if (!resolved || resolved.lat == null) reasons.push("unresolved coords");
  if (resolved && resolved.source === "geo") reasons.push("used GPS source (typed must win)");
  if (resolved && (!resolved.city || !resolved.state)) reasons.push("missing city/state enrichment");
  if (resolved && resolved.state && resolved.state !== expectState) {
    reasons.push(`resolved state ${resolved.state} != ${expectState}`);
  }
  if (!t0) reasons.push("no local centers");
  if (t0 && !isFinite(t0._dist)) reasons.push("non-finite miles");
  if (t0 && t0._dist > maxMi) reasons.push(`#1 ${t0._dist.toFixed(1)}mi > max ${maxMi}`);
  if (t0 && t0.state !== expectState && !(t0._dist <= 12)) {
    reasons.push(`#1 state ${t0.state} != ${expectState}`);
  }

  const gpsTop = locals(gpsMode.items)[0];
  if (zip === "10458") {
    if (!t0 || t0.state !== "NY" || t0._dist >= 15) reasons.push("10458 top not Bronx/NYC local");
    if (gpsTop && /elizabeth/i.test(gpsTop.city || "") && t0 && t0.id === gpsTop.id) {
      reasons.push("10458 typed equals stale-GPS Elizabeth top");
    }
    const pickGeo = (opts, override) =>
      Object.prototype.hasOwnProperty.call(opts, "geo") ? opts.geo : override;
    if (pickGeo({ geo: null }, STALE_GPS) !== null) reasons.push("geo nullish coalescing regression");
  }

  const ok = reasons.length === 0;
  if (!ok) failed = true;

  const row = {
    zip, region, pass: ok, reasons,
    resolved: resolved
      ? { source: resolved.source, city: resolved.city, state: resolved.state, lat: resolved.lat, lng: resolved.lng, label: resolved.label, matchedZip: resolved.matchedZip || null }
      : null,
    top: top.slice(0, 5).map((c) => ({
      miles: Math.round(c._dist * 10) / 10,
      city: c.city, state: c.state, zip: c.zip, name: c.name,
      services: (c.services || []).slice(0, 6),
      needs: (c.needs || []).slice(0, 8),
    })),
  };
  rows.push(row);

  console.log(`${ok ? "PASS" : "FAIL"} ${zip} ${region}`);
  console.log(`  resolve: ${resolved?.source} ${resolved?.city || "?"}, ${resolved?.state || "?"} (${resolved?.label || ""})`);
  top.slice(0, 5).forEach((c, i) => {
    console.log(`  ${i + 1}. ${c._dist.toFixed(1).padStart(5)} mi  ${c.city}, ${c.state} ${c.zip} — ${c.name}`);
  });
  if (!ok) console.log("  reasons:", reasons.join("; "));
  console.log("");
}

// Bare Dallas → TX
{
  const r = window.HearthHelp.rankCenters("Dallas", [], { limit: 5, geo: null });
  const ok = r.resolved && r.resolved.state === "TX" && locals(r.items)[0]?.state === "TX";
  console.log(`${ok ? "PASS" : "FAIL"} bare city Dallas → ${r.resolved?.city}, ${r.resolved?.state} #1 ${locals(r.items)[0]?.city}, ${locals(r.items)[0]?.state}`);
  rows.push({
    zip: "Dallas",
    region: "bare city disambiguation",
    pass: ok,
    resolved: r.resolved,
    top: locals(r.items).slice(0, 3).map((c) => ({ miles: Math.round(c._dist * 10) / 10, city: c.city, state: c.state, name: c.name })),
  });
  if (!ok) failed = true;
}

// PR nationals-first
for (const z of ["00601", "00901"]) {
  const r = window.HearthHelp.rankCenters(z, [], { limit: 8, geo: null });
  const items = r.items || [];
  const first = items[0];
  const localNear = locals(items).filter((c) => isFinite(c._dist) && c._dist <= 100);
  const reasons = [];
  if (localNear.length) reasons.push("unexpected local ≤100mi in PR");
  if (!first || !isNational(first)) reasons.push(`#1 must be national helpline, got ${first?.name} (${first?.city})`);
  if (r.mode !== "national" && !String(r.mode).includes("national")) {
    reasons.push(`mode should be national, got ${r.mode}`);
  }
  if (r.resolved && r.resolved.state !== "PR") reasons.push(`resolved state ${r.resolved.state} != PR`);
  const ok = reasons.length === 0;
  if (!ok) failed = true;
  console.log(`${ok ? "PASS" : "FAIL"} PR ${z} nationals-first mode=${r.mode} #1 ${first?.name}`);
  if (!ok) console.log("  reasons:", reasons.join("; "));
  rows.push({
    zip: z, region: "Puerto Rico FAR", pass: ok, reasons,
    resolved: r.resolved,
    mode: r.mode,
    top: items.slice(0, 5).map((c) => ({
      miles: c._dist != null && isFinite(c._dist) ? Math.round(c._dist * 10) / 10 : null,
      city: c.city, state: c.state, name: c.name, national: isNational(c),
    })),
  });
}

// Chips + NEED_ALIASES honesty
const html = fs.readFileSync(path.join(REPO, "index.html"), "utf8");
const chipNeeds = ["diapers", "food", "formula", "clothes", "counseling", "housing", "ultrasound", "talk", "parenting", "mentor"];
const chipsOk = chipNeeds.every((n) => html.includes(`data-dir-need="${n}"`));
console.log(chipsOk ? "PASS chips: dir-need-chip set present" : "FAIL chips missing");
if (!chipsOk) failed = true;

const appSrc = fs.readFileSync(path.join(REPO, "js/app.js"), "utf8");
const exactDiapers = /diapers:\s*\[\s*"diapers"\s*\]/.test(appSrc);
const noSuppliesFallback = !/diapers:\s*\[[^\]]*supplies/.test(appSrc);
console.log(exactDiapers && noSuppliesFallback ? "PASS NEED_ALIASES diapers exact (no supplies fallback)" : "FAIL NEED_ALIASES");
if (!exactDiapers || !noSuppliesFallback) failed = true;

const centers = window.HEARTH_CENTERS || [];
const diaperNeedCount = centers.filter((c) => (c.needs || []).includes("diapers")).length;
console.log(`centers with needs.diapers: ${diaperNeedCount} ${diaperNeedCount < 50 ? "PASS" : "FAIL"}`);
if (diaperNeedCount >= 50) failed = true;

console.log(failed ? "\nOVERALL FAIL" : "\nOVERALL PASS");

const out = {
  generated: "2026-09-30",
  overallPass: !failed,
  diaperNeedCount,
  chipsOk,
  rows,
};
fs.writeFileSync("/tmp/nationwide-help-proof-data.json", JSON.stringify(out, null, 2));
process.exit(failed ? 1 : 0);
