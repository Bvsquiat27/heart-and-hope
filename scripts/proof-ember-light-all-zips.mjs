/**
 * Proof: Light my Ember resolve + create for diverse US ZIPs (incl PR/HI/AK/territories).
 * Client resolve uses HeartGeo (ZIPS → zip-coords → SCF) + territory centroids in beacon.js.
 * Create posts to local express mirror (PORT) or LIVE_API env.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import vm from "vm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function loadBrowserScript(rel) {
  const code = fs.readFileSync(path.join(root, rel), "utf8");
  const sandbox = { window: {}, globalThis: {}, console };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(code, sandbox, { filename: rel });
  return sandbox;
}

const zipsCtx = loadBrowserScript("data/zips.js");
const coordsCtx = loadBrowserScript("data/zip-coords.js");
Object.assign(zipsCtx, {
  HEART_ZIP_COORDS: coordsCtx.HEART_ZIP_COORDS,
});
const geoCode = fs.readFileSync(path.join(root, "js/geo.js"), "utf8");
vm.runInNewContext(geoCode, zipsCtx, { filename: "js/geo.js" });
const HeartGeo = zipsCtx.HeartGeo;

const STATE_OK = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","PR","VI","GU","AS","MP"
]);

function resolve(q) {
  const hit = HeartGeo.lookupZip(q);
  if (!hit || hit.lat == null) return null;
  let state =
    hit.state ||
    HeartGeo.territoryStateFromZip(hit.zip) ||
    HeartGeo.territoryStateFromCoords(hit.lat, hit.lng);
  if (!state || !STATE_OK.has(state)) return null;
  return {
    lat: Math.round(Number(hit.lat) * 100) / 100,
    lng: Math.round(Number(hit.lng) * 100) / 100,
    state,
    coarseZip: hit.zip || q,
    matchedZip: hit.matchedZip || null,
  };
}

const ZIPS = [
  ["10458", "NY"],
  ["30301", "GA"],
  ["85001", "AZ"],
  ["90210", "CA"],
  ["96813", "HI"],
  ["99701", "AK"],
  ["00601", "PR"],
  ["00901", "PR"],
  ["00680", "PR"],
  ["00802", "VI"],
  ["96910", "GU"],
  ["96950", "MP"],
  ["59001", "MT"],
  ["57701", "SD"],
  ["02101", "MA"],
  ["19101", "PA"],
];

const API = process.env.LIVE_API || process.env.API || "http://127.0.0.1:8765";
const doCreate = process.env.SKIP_CREATE !== "1";

let fail = 0;
const rows = [];
for (const [z, expect] of ZIPS) {
  const r = resolve(z);
  const ok = !!(r && r.state === expect && Number.isFinite(r.lat) && Number.isFinite(r.lng));
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"} resolve ${z} → ${JSON.stringify(r)} expect=${expect}`);
  rows.push({ z, expect, resolve: r, resolveOk: ok });
}
const closed = resolve("00000");
console.log(`${!closed ? "PASS" : "FAIL"} fail-closed 00000`);
if (closed) fail++;

if (doCreate) {
  const now = Date.now();
  for (const row of rows) {
    if (!row.resolveOk) {
      row.createOk = false;
      continue;
    }
    const payload = {
      lat: row.resolve.lat,
      lng: row.resolve.lng,
      createdAt: now,
      expiresAt: now + 2 * 3600 * 1000,
      coarseZip: row.resolve.coarseZip,
      state: row.resolve.state,
    };
    const res = await fetch(API + "/beacons", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://bvsquiat27.github.io" },
      body: JSON.stringify(payload),
    });
    const j = await res.json().catch(() => ({}));
    const ok = res.status === 201 && j.id && j.beacon && j.beacon.state === row.expect;
    if (!ok) fail++;
    row.createOk = ok;
    row.id = j.id;
    console.log(
      `${ok ? "PASS" : "FAIL"} create ${row.z} ${row.expect} → ${res.status} id=${j.id || "-"} err=${j.error || ""}`
    );
  }
}

console.log(fail ? `\nOVERALL FAIL (${fail})` : "\nOVERALL PASS");
process.exit(fail ? 1 : 0);
