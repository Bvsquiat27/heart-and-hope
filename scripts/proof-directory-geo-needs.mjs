/**
 * Proof: directory geo + needs honesty gates.
 * - ZIP↔state mismatches = 0 (center.state vs HEART_ZIPS[zip].state)
 * - Las Vegas NM Care Net id/state/coords correct
 * - ultrasound / mentor abundant; diapers / formula rare (no baby-supplies invention)
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

loadWindowScripts(["data/centers.js", "data/zips.js"]);

const centers = globalThis.HEART_CENTERS || [];
const zips = globalThis.HEART_ZIPS || {};

if (!centers.length) {
  console.error("FAIL: no HEART_CENTERS");
  process.exit(1);
}

const counts = {};
centers.forEach((c) => (c.needs || []).forEach((n) => { counts[n] = (counts[n] || 0) + 1; }));

const mismatches = [];
for (const c of centers) {
  const z = String(c.zip || "").trim();
  if (!z || z === "00000") continue;
  const zrec = zips[z];
  if (!zrec || !zrec.state) continue;
  if (String(c.state || "").toUpperCase() !== String(zrec.state).toUpperCase()) {
    mismatches.push({ id: c.id, name: c.name, zip: z, centerState: c.state, zipState: zrec.state });
  }
}

const lvId = "nm-care-net-of-las-vegas-nm-21455";
const lv = centers.find((c) => c.id === lvId);

const ultrasoundOk = (counts.ultrasound || 0) > 1000;
const mentorOk = (counts.mentor || 0) > 500;
const diapersOk = (counts.diapers || 0) < 50;
const formulaOk = (counts.formula || 0) < 50;
const mismatchOk = mismatches.length === 0;
const lvOk =
  !!lv &&
  lv.state === "NM" &&
  Math.abs(lv.lat - 35.5309) < 0.01 &&
  Math.abs(lv.lng - -104.9442) < 0.01;

console.log("centers:", centers.length);
console.log("needs counts:", JSON.stringify(counts, null, 2));
console.log("ZIP↔state mismatches:", mismatches.length);
if (mismatches.length) console.log(mismatches.slice(0, 10));
console.log("LV NM:", lv ? { id: lv.id, state: lv.state, lat: lv.lat, lng: lv.lng } : "MISSING");

const gates = [
  ["mismatches=0", mismatchOk],
  ["LV NM ok", lvOk],
  ["ultrasound>1000", ultrasoundOk],
  ["mentor>500", mentorOk],
  ["diapers<50", diapersOk],
  ["formula<50", formulaOk],
];

let fail = false;
for (const [name, ok] of gates) {
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}`);
  if (!ok) fail = true;
}

if (fail) {
  console.error("\nFAIL: directory geo/needs honesty gates");
  process.exit(1);
}
console.log("\nPASS: directory geo + needs honesty");
