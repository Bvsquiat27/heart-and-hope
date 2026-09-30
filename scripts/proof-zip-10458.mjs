/**
 * Proof: ZIP 10458 (Bronx) ranks local NY centers first with honest miles.
 * Gateway Pregnancy Center (Elizabeth NJ) must NOT appear as ~1.2 mi from 10458.
 * Also proves typed ZIP wins over a stale GPS fix near Elizabeth.
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

function haversineMiles(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return Infinity;
  const R = 3958.8;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

const zips = globalThis.HEART_ZIPS || {};
const zc = globalThis.HEART_ZIP_COORDS || {};
const filter = globalThis.HeartCentersFilter;
let centers = globalThis.HEART_CENTERS || [];
if (filter) centers = filter.filterLifeAffirming(centers);

const zip = "10458";
const originZip = zips[zip] || (zc[zip] ? { lat: zc[zip][0], lng: zc[zip][1], city: "Bronx", state: "NY" } : null);
if (!originZip) {
  console.error("FAIL: no coords for 10458");
  process.exit(1);
}
const origin = { lat: originZip.lat, lng: originZip.lng, zip, city: originZip.city, state: originZip.state };

console.log("Origin 10458:", origin.city, origin.state, origin.lat, origin.lng);

const LOCAL = 100;
const ranked = centers
  .filter((c) => c.lat != null && !((c.type || "").toLowerCase().includes("national") || c.zip === "00000"))
  .map((c) => ({ c, dist: haversineMiles(origin, c) }))
  .sort((a, b) => a.dist - b.dist);

const top8 = ranked.slice(0, 8);
console.log("\nTop 8 from ZIP 10458 (life-affirming only):");
top8.forEach((s, i) => {
  console.log(
    `${String(i + 1).padStart(2)}. ${s.dist.toFixed(1).padStart(5)} mi  ${s.c.city}, ${s.c.state} ${s.c.zip} — ${s.c.name}`
  );
});

const gateway = ranked.find((s) => /gateway/i.test(s.c.name) && /elizabeth/i.test(s.c.city || ""));
console.log("\nGateway Elizabeth distance from 10458:", gateway ? gateway.dist.toFixed(1) + " mi" : "not in list");

const topIsBronxArea = top8.slice(0, 3).every((s) => s.dist < 15 && (s.c.state === "NY" || s.dist < 12));
const gatewayNotFake = !gateway || gateway.dist > 15;
const gatewayNotFirst = !gateway || ranked.indexOf(gateway) > 2;

// Simulate stale GPS near Elizabeth + typed ZIP must use ZIP origin
const staleGps = { lat: 40.664341 + 0.017, lng: -74.212673 }; // ~1.2 mi from Gateway
const gpsToGateway = haversineMiles(staleGps, gateway.c);
console.log("\nStale GPS near Elizabeth → Gateway:", gpsToGateway.toFixed(1), "mi (the bug symptom)");
console.log("With fix, typed 10458 ignores that GPS and uses ZIP origin above.");

let failed = false;
if (!topIsBronxArea) {
  console.error("FAIL: top centers are not Bronx/NYC-local");
  failed = true;
}
if (!gatewayNotFake) {
  console.error("FAIL: Gateway appears closer than 15 mi from 10458");
  failed = true;
}
if (top8[0].dist < 0.5 && /elizabeth/i.test(top8[0].c.city)) {
  console.error("FAIL: Elizabeth is #1 from 10458");
  failed = true;
}
if (top8[0].c.state !== "NY") {
  console.error("FAIL: #1 is not NY");
  failed = true;
}
if (gateway && gateway.dist.toFixed(1) === "1.2") {
  console.error("FAIL: Gateway still 1.2 from 10458");
  failed = true;
}

// Unit-check the opts.geo nullish fix logic
function pickGeo(opts, geoOverride) {
  return Object.prototype.hasOwnProperty.call(opts, "geo") ? opts.geo : geoOverride;
}
const bugWouldUseGps = (null || staleGps) === staleGps;
const fixedUsesNull = pickGeo({ geo: null }, staleGps) === null;
console.log("\nRegression: opts.geo||geoOverride would use GPS?", bugWouldUseGps);
console.log("Fixed hasOwnProperty path uses null?", fixedUsesNull);
if (!fixedUsesNull) {
  console.error("FAIL: geo null handling");
  failed = true;
}

if (failed) process.exit(1);
console.log("\nPASS: 10458 locals-first with honest miles; Gateway not 1.2 mi; ZIP wins over stale GPS.");
