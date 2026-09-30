/**
 * Proof 1.6.14: HI zip-coords honesty + Fairbanks 99701 + PR knownStates.
 * - Drop Midway/Samoa/ocean 967/968 centroids; zip3-nearest → HI local Best
 * - 96813/96720 keep honest HI local Best
 * - 99701 Fairbanks must not show ~177mi inflated miles
 * - san juan pr → label includes PR
 * - needs honesty: diapers < 50
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

if (!window.HearthHelp || typeof window.HearthHelp.rankCenters !== "function") {
  console.error("FAIL: HearthHelp.rankCenters not available");
  process.exit(1);
}

function isNat(c) {
  return (c.type || "").toLowerCase().includes("national") ||
    c.zip === "00000" ||
    (c.city || "").toLowerCase() === "nationwide";
}

function mainlandFarBest(c) {
  if (!c || isNat(c)) return false;
  const st = String(c.state || "");
  const mi = c._dist;
  if (!isFinite(mi) || mi < 600) return false;
  return ["FL", "CA", "TX", "NY", "WA", "OR", "NV", "AZ"].includes(st);
}

let failed = false;
const rows = [];

console.log("=== 1.6.14 HI zip-coords + Fairbanks 99701 + PR proof ===\n");

// Data gate: no bogus HI zip-coords outside bbox
{
  const coords = window.HEARTH_ZIP_COORDS || {};
  const bad = [];
  for (const [z, c] of Object.entries(coords)) {
    if (!/^96[78]/.test(z)) continue;
    const [lat, lng] = c;
    const ok = lat >= 18.5 && lat <= 22.5 && lng >= -161 && lng <= -154;
    if (!ok) bad.push(z);
  }
  const ok = bad.length === 0 && !coords["96801"] && !coords["96799"];
  console.log(`${ok ? "PASS" : "FAIL"} zip-coords HI bbox (bad leftover=${bad.length})`);
  if (!ok) failed = true;
  rows.push({ gate: "hi-bbox-data", pass: ok, bad });
}

// 96813 / 96720 local Best
for (const spec of [
  { zip: "96813", expectState: "HI", maxMi: 15, nameHint: /pearson|honolulu|hawaii|oahu/i },
  { zip: "96720", expectState: "HI", maxMi: 20, nameHint: /hilo|liv|hawaii/i },
]) {
  const r = window.HearthHelp.rankCenters(spec.zip, [], { limit: 8, geo: null });
  const locals = (r.items || []).filter((c) => !isNat(c));
  const t0 = locals[0] || r.items?.[0];
  const reasons = [];
  if (!r.resolved || r.resolved.state !== spec.expectState) reasons.push(`state ${r.resolved?.state}`);
  if (!t0) reasons.push("no top");
  if (t0 && isNat(t0)) reasons.push("national Best (expected HI local)");
  if (t0 && isFinite(t0._dist) && t0._dist > spec.maxMi) reasons.push(`mi ${t0._dist.toFixed(1)} > ${spec.maxMi}`);
  if (t0 && t0.state !== "HI") reasons.push(`top state ${t0.state}`);
  if (mainlandFarBest(t0)) reasons.push("mainland 600mi+ Best");
  const ok = reasons.length === 0;
  if (!ok) failed = true;
  console.log(`${ok ? "PASS" : "FAIL"} ${spec.zip} HI local Best — ${t0?.name} ${t0?._dist?.toFixed?.(1)}mi ${t0?.city}, ${t0?.state}`);
  if (!ok) console.log("  reasons:", reasons.join("; "));
  rows.push({ zip: spec.zip, pass: ok, reasons, resolved: r.resolved, top: t0 && { name: t0.name, mi: t0._dist, city: t0.city, state: t0.state } });
}

// Former bad PO / unique ZIPs
for (const zip of ["96801", "96799", "96802", "96823"]) {
  const r = window.HearthHelp.rankCenters(zip, [], { limit: 8, geo: null });
  const t0 = r.items?.[0];
  const locals = (r.items || []).filter((c) => !isNat(c));
  const reasons = [];
  if (mainlandFarBest(t0)) reasons.push(`mainland far Best ${t0.state} ${t0._dist?.toFixed?.(0)}mi`);
  // Accept: HI local ≤100mi OR nationals-first (national #1) — never FL/CA Best at 600+
  const hiLocal = locals[0] && locals[0].state === "HI" && isFinite(locals[0]._dist) && locals[0]._dist <= 100;
  const natFirst = t0 && isNat(t0);
  if (!hiLocal && !natFirst) {
    if (locals[0] && locals[0].state === "HI" && locals[0]._dist > 100) {
      reasons.push(`HI Best inflated ${locals[0]._dist.toFixed(0)}mi (want ≤100 or nationals-first)`);
    } else if (!t0) {
      reasons.push("empty results");
    } else {
      reasons.push(`unexpected Best ${t0.name} ${t0.state} ${t0._dist}`);
    }
  }
  // Resolve should not be Midway/Samoa
  const lat = r.resolved?.lat, lng = r.resolved?.lng;
  if (lat != null && (lat < 18.5 || lat > 22.5 || lng < -161 || lng > -154)) {
    // Allow if nationals-first from unresolved / non-HI — still fail if using ocean as origin with HI label
    if (r.resolved?.state === "HI") reasons.push(`resolved HI but outside bbox ${lat},${lng}`);
  }
  const ok = reasons.length === 0;
  if (!ok) failed = true;
  console.log(`${ok ? "PASS" : "FAIL"} ${zip} — resolve ${r.resolved?.source} ${r.resolved?.city}, ${r.resolved?.state} (${r.resolved?.lat?.toFixed?.(2)},${r.resolved?.lng?.toFixed?.(2)}) mode=${r.mode}`);
  console.log(`  #1 ${t0 ? `${isNat(t0) ? "NAT" : t0._dist?.toFixed?.(1) + "mi"} ${t0.city}, ${t0.state} — ${t0.name}` : "none"}`);
  if (!ok) console.log("  reasons:", reasons.join("; "));
  rows.push({ zip, pass: ok, reasons, resolved: r.resolved, mode: r.mode, top: t0 && { name: t0.name, mi: t0._dist, city: t0.city, state: t0.state, nat: isNat(t0) } });
}

// Fairbanks 99701 — no inflated miles
{
  const z = window.HEARTH_ZIPS["99701"];
  const r = window.HearthHelp.rankCenters("99701", [], { limit: 8, geo: null });
  const locals = (r.items || []).filter((c) => !isNat(c));
  const t0 = locals[0];
  const reasons = [];
  if (!z || Math.abs(z.lat - 64.8378) > 0.05) reasons.push(`zips.js 99701 still bad ${JSON.stringify(z)}`);
  if (!t0) reasons.push("no local top");
  if (t0 && t0.state !== "AK") reasons.push(`top state ${t0.state}`);
  if (t0 && !(isFinite(t0._dist) && t0._dist <= 25)) reasons.push(`inflated mi ${t0?._dist}`);
  if (t0 && !/fairbanks/i.test(t0.city || "")) reasons.push(`top city ${t0.city} not Fairbanks`);
  const ok = reasons.length === 0;
  if (!ok) failed = true;
  console.log(`${ok ? "PASS" : "FAIL"} 99701 Fairbanks — ${t0?._dist?.toFixed?.(1)}mi ${t0?.name} (${t0?.city})`);
  if (!ok) console.log("  reasons:", reasons.join("; "));
  rows.push({ zip: "99701", pass: ok, reasons, resolved: r.resolved, top: t0 && { name: t0.name, mi: t0._dist, city: t0.city, state: t0.state } });
}

// san juan pr
{
  const r = window.HearthHelp.rankCenters("san juan pr", [], { limit: 5, geo: null });
  const label = String(r.resolved?.label || "");
  const st = r.resolved?.state;
  const reasons = [];
  if (st !== "PR" && !/\bPR\b/.test(label)) reasons.push(`label/state missing PR (${label} / ${st})`);
  const appSrc = fs.readFileSync(path.join(REPO, "js/app.js"), "utf8");
  if (!/knownStates = "[^"]*\bPR\b/.test(appSrc)) reasons.push("PR not in knownStates");
  const ok = reasons.length === 0;
  if (!ok) failed = true;
  console.log(`${ok ? "PASS" : "FAIL"} san juan pr → ${label} state=${st}`);
  if (!ok) console.log("  reasons:", reasons.join("; "));
  rows.push({ query: "san juan pr", pass: ok, reasons, resolved: r.resolved });
}

// needs honesty
{
  const centers = window.HEARTH_CENTERS || [];
  let diapers = 0;
  centers.forEach((c) => { if ((c.needs || []).includes("diapers")) diapers++; });
  const ok = diapers < 50;
  if (!ok) failed = true;
  console.log(`${ok ? "PASS" : "FAIL"} needs honesty diapers=${diapers} (<50)`);
  rows.push({ gate: "diapers", pass: ok, diapers });
}

fs.writeFileSync("/tmp/proof-hi-1.6.14-results.json", JSON.stringify(rows, null, 2));

if (failed) {
  console.error("\nFAIL: proof-hi-zip-coords-1.6.14");
  process.exit(1);
}
console.log("\nPASS: proof-hi-zip-coords-1.6.14");
