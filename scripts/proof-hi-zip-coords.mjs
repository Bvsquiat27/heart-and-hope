/**
 * Proof: HI PO Box / unique ZIPs must not use Midway/Samoa zip-coords as origin.
 * 96801/96799 previously resolved to ~24.8N/-168 or -7/-170 → 690–2000mi "Best".
 * Fix: distrust zip-coords >75mi from SCF neighbor (or 0,0); use neighbor centroid.
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
window.location = { hash: "", href: "http://localhost/", pathname: "/", hostname: "localhost", protocol: "http:", origin: "http://localhost" };
window.navigator = { geolocation: null, vibrate: null, serviceWorker: { register: async () => ({}) }, userAgent: "node", onLine: true };
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

for (const f of [
  "data/centers.js", "data/zips.js", "data/zip-coords.js",
  "js/centers-filter.js", "js/geo.js", "js/haptics.js", "js/app.js"
]) {
  vm.runInThisContext(fs.readFileSync(path.join(REPO, f), "utf8"), { filename: f });
}

function isNat(c) {
  return (c.type || "").toLowerCase().includes("national") ||
    c.zip === "00000" ||
    (c.city || "").toLowerCase() === "nationwide";
}

const CASES = [
  { zip: "96801", expectState: "HI", maxMi: 25, note: "Honolulu PO Box (was Midway ~690mi)" },
  { zip: "96799", expectState: "HI", maxMi: 25, note: "Waipahu unique (was Samoa ~2100mi)" },
  { zip: "96802", expectState: "HI", maxMi: 25, note: "Honolulu PO sibling" },
  { zip: "96823", expectState: "HI", maxMi: 25, note: "Honolulu PO sibling" },
  { zip: "96813", expectState: "HI", maxMi: 15, note: "honest Honolulu control" },
  { zip: "96701", expectState: "HI", maxMi: 20, note: "Aiea control" },
];

let failed = false;
console.log("=== HI zip-coords false-Best proof ===\n");

for (const spec of CASES) {
  const { zip, expectState, maxMi, note } = spec;
  const geoHit = window.HearthGeo.lookupZip(zip);
  const ranked = window.HearthHelp.rankCenters(zip, [], { limit: 5, geo: null });
  const matched = window.HearthHelp.matchCenters(zip, ["counseling"]);
  const reasons = [];

  if (!geoHit || geoHit.lat == null) reasons.push("geo lookup null");
  if (geoHit && geoHit.state !== expectState) reasons.push(`geo state ${geoHit.state}`);
  /* Must not sit on Midway / Samoa / null island */
  if (geoHit) {
    if (geoHit.lat === 0 && geoHit.lng === 0) reasons.push("null island");
    if (geoHit.lat < 18.5 || geoHit.lat > 22.5 || geoHit.lng > -154.5 || geoHit.lng < -160.5) {
      reasons.push(`geo outside HI bbox ${geoHit.lat},${geoHit.lng}`);
    }
  }

  const locals = (ranked.items || []).filter((c) => !isNat(c));
  const top = locals[0];
  if (!top) reasons.push("no local centers after rank");
  if (top && (!isFinite(top._dist) || top._dist > maxMi)) {
    reasons.push(`rank #1 ${top._dist}mi > ${maxMi} (${top.city})`);
  }
  if (top && top.state !== expectState) reasons.push(`rank #1 state ${top.state}`);

  const m0 = (matched || [])[0];
  if (!m0) reasons.push("matchCenters empty");
  if (m0 && isNat(m0) && top && isFinite(top._dist) && top._dist <= maxMi) {
    reasons.push("matchCenters nationals-first despite local ≤maxMi");
  }
  if (m0 && !isNat(m0) && (!isFinite(m0._dist) || m0._dist > maxMi)) {
    reasons.push(`match Best ${m0._dist}mi > ${maxMi}`);
  }
  if (m0 && !isNat(m0) && !m0._isLocalBest) {
    reasons.push("match Best not _isLocalBest");
  }

  const ok = reasons.length === 0;
  if (!ok) failed = true;
  console.log(`${ok ? "PASS" : "FAIL"} ${zip} — ${note}`);
  console.log(`  geo: ${geoHit?.city}, ${geoHit?.state} ${geoHit?.lat?.toFixed?.(4)},${geoHit?.lng?.toFixed?.(4)} matchedZip=${geoHit?.matchedZip || "(exact)"}`);
  console.log(`  rank mode=${ranked.mode} #1 ${top?`${top._dist.toFixed(1)}mi ${top.city} ${top.name}`:"(none)"}`);
  console.log(`  match mode=${matched?._matchMode} Best ${m0?`${isNat(m0)?"NAT " :""}${isFinite(m0._dist)?m0._dist.toFixed(1)+"mi ":""}${m0.city} ${m0.name}`:"(none)"}`);
  if (!ok) console.log("  reasons:", reasons.join("; "));
  console.log("");
}

/* Regression: good PO Box SCF enrich (Atlanta/Phoenix) still works */
for (const z of ["30301", "85001"]) {
  const h = window.HearthGeo.lookupZip(z);
  const ok = h && h.city && h.state && h.lat != null && !(h.lat === 0 && h.lng === 0);
  console.log(`${ok ? "PASS" : "FAIL"} regress ${z} → ${h?.city}, ${h?.state} matchedZip=${h?.matchedZip}`);
  if (!ok) failed = true;
}

/* PR still nationals-first (zip-coords only, no SCF) */
{
  const r = window.HearthHelp.rankCenters("00601", [], { limit: 3, geo: null });
  const first = (r.items || [])[0];
  const ok = r.mode === "national" && first && isNat(first);
  console.log(`${ok ? "PASS" : "FAIL"} PR 00601 nationals-first mode=${r.mode} #1 ${first?.name}`);
  if (!ok) failed = true;
}

console.log(failed ? "\nOVERALL FAIL" : "\nOVERALL PASS");
process.exit(failed ? 1 : 0);
