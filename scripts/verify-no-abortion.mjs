#!/usr/bin/env node
/**
 * CI-style check: fail if any shipped center trips the hard abortion/PP exclude.
 * Abortion recovery / post-abortion healing is allowed.
 * Loads the same patterns as js/centers-filter.js (duplicated lightly for Node).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import vm from "vm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function loadCenters() {
  const text = fs.readFileSync(path.join(root, "data/centers.js"), "utf8");
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(text, ctx);
  return ctx.window.HEART_CENTERS || [];
}

function loadFilter() {
  const text = fs.readFileSync(path.join(root, "js/centers-filter.js"), "utf8");
  const ctx = { window: {}, globalThis: {} };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(text, ctx);
  return ctx.window.HeartCentersFilter || ctx.HeartCentersFilter;
}

const centers = loadCenters();
const filter = loadFilter();
if (!filter) {
  console.error("FAIL: HeartCentersFilter not loaded");
  process.exit(2);
}

const bad = centers.filter((c) => filter.isExcludedCenter(c));
const recovery = centers.filter((c) => {
  const blob = [c.name, c.blurb, ...(c.services || [])].join(" ");
  return /abortion\s*recovery|post[- ]?abortion/i.test(blob) && !filter.isExcludedCenter(c);
});

const states = new Set(centers.map((c) => c.state).filter((s) => s && s !== "US"));
const need = "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" ");
const missing = need.filter((s) => !states.has(s));

console.log("centers:", centers.length);
console.log("excluded hits:", bad.length);
console.log("recovery kept:", recovery.length);
console.log("states+DC present:", need.length - missing.length, "/ 51");
if (missing.length) console.log("missing states:", missing.join(", "));

if (bad.length) {
  console.error("FAIL — abortion/PP patterns found:");
  bad.slice(0, 20).forEach((c) => console.error(" -", c.id, c.name, c.state));
  process.exit(1);
}
if (missing.length) {
  console.error("FAIL — missing state coverage");
  process.exit(1);
}
console.log("OK — no abortion/PP providers; all 50 states + DC present; recovery allowed.");
