/**
 * Heart & Hope — Postpartum Ember + Accounts API (Express local mirror) v1.7.7
 * Mirrors Worker security: owner secrets, CORS allowlist, rate limits, body caps,
 * hashed tokens, sync caps, quiet health. File-backed Maps instead of KV.
 */
"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const VERSION = "1.7.7";
const PORT = Number(process.env.PORT || 8765);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DATA_FILE = process.env.DATA_FILE || path.join(DATA_DIR, "beacons.json");
const HOPE_FILE = process.env.HOPE_FILE || path.join(DATA_DIR, "hope.json");
const FLAGS_FILE = process.env.FLAGS_FILE || path.join(DATA_DIR, "flags.json");
const MAX_FLAGS = 2000;
const MAX_CENTER_ID = 80;
const MAX_FLAG_REASON = 200;
const MAX_FLAG_NAME = 120;
const MAX_FLAG_CITY = 80;
const MAX_FLAG_STATE = 40;
const MAX_FLAG_NOTE = 280;
const FLAG_SOURCES = new Set(["directory", "get_help"]);
const USERS_FILE = process.env.USERS_FILE || path.join(DATA_DIR, "users.json");
const TOKENS_FILE = process.env.TOKENS_FILE || path.join(DATA_DIR, "tokens.json");

const MAX_NOTE = 200;
const MAX_HOURS = 48;
const MAX_HOPE = 400;
const MAX_HOPE_POSTS = 200;
const MAX_NOTES_PER_BEACON = 50;
const MAX_BODY = 64000;
const MAX_PRIVATE_BYTES = 48000;
const TOKEN_TTL_MS = 90 * 24 * 3600 * 1000;
const PBKDF2_ITERS = 100000;

const ALLOWED_ORIGINS = [
  "https://bvsquiat27.github.io",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
  "null" /* Android WebView / file APK Ember — Origin header is the string "null" */
];

const RATE_TEST = process.env.RATE_TEST === "1" || process.env.RATE_TEST === "true";
const RATE = RATE_TEST
  ? {
      "post-beacons": { max: 3, window: 60 },
      "post-notes": { max: 5, window: 60 },
      "post-hope": { max: 5, window: 60 },
      "post-flags": { max: 5, window: 60 },
      signup: { max: 3, window: 60 },
      login: { max: 5, window: 60 }
    }
  : {
      "post-beacons": { max: 5, window: 600 },
      "post-notes": { max: 20, window: 600 },
      "post-hope": { max: 10, window: 600 },
      "post-flags": { max: 15, window: 600 },
      signup: { max: 5, window: 3600 },
      login: { max: 20, window: 900 }
    };

const CONTENT_BLOCK_WORDS =
  /\b(kill|murder|rape|suicide|bomb|shoot|fuck\w*|shit|bitch|cunt|nigg\w*|faggot)\b/i;
const CONTENT_BLOCK_CONTACT =
  /https?:\/\/|www\.|\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b|(?:^|[^\w])@[a-z0-9_]{3,}/i;

/** Cyrillic glyphs that look like Latin letters. Other Cyrillic stays unchanged. */
const CYRILLIC_LOOKALIKE = {
  "\u0410": "A", "\u0430": "a",
  "\u0412": "B",
  "\u0415": "E", "\u0435": "e",
  "\u041A": "K", "\u043A": "k",
  "\u041C": "M", "\u043C": "m",
  "\u041D": "H",
  "\u041E": "O", "\u043E": "o",
  "\u0420": "P", "\u0440": "p",
  "\u0421": "C", "\u0441": "c",
  "\u0422": "T",
  "\u0423": "Y", "\u0443": "y",
  "\u0425": "X", "\u0445": "x",
  "\u0405": "S", "\u0455": "s",
  "\u0406": "I", "\u0456": "i",
  "\u0408": "J", "\u0458": "j",
  "\u0474": "V", "\u0475": "v",
  "\u04BA": "H", "\u04BB": "h",
  "\u04C0": "I", "\u04CF": "l",
  "\u0500": "D", "\u0501": "d",
  "\u051A": "Q", "\u051B": "q",
  "\u051C": "W", "\u051D": "w"
};

function foldCyrillicLookalikes(text) {
  return String(text).replace(/[\u0400-\u052F]/g, (ch) =>
    Object.prototype.hasOwnProperty.call(CYRILLIC_LOOKALIKE, ch) ? CYRILLIC_LOOKALIKE[ch] : ch
  );
}

function normalizeContentText(text) {
  let t = String(text || "").normalize("NFKC");
  t = t.replace(
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g,
    ""
  );
  t = t.normalize("NFD").replace(/[\u0300-\u036F]/g, "");
  return foldCyrillicLookalikes(t);
}

function collapseSpacedLetters(text) {
  return String(text || "").replace(/([a-z0-9])(?:[\s._\-*"'`·]+)(?=[a-z0-9])/gi, "$1");
}

function contentBlocked(text) {
  const n = normalizeContentText(text);
  const c = collapseSpacedLetters(n);
  return (
    CONTENT_BLOCK_WORDS.test(n) ||
    CONTENT_BLOCK_WORDS.test(c) ||
    CONTENT_BLOCK_CONTACT.test(n) ||
    CONTENT_BLOCK_CONTACT.test(c)
  );
}

/** @type {Record<string, any>} */
let beacons = {};
/** @type {Record<string, any>} */
let hopePosts = {};
/** @type {Record<string, any>} */
let flagPosts = {};
/** @type {Record<string, any>} */
let users = {};
/** @type {Record<string, string>} tokenHash -> email */
let tokenIndex = {};
/** rate limit: key -> { n, exp } */
const rateMap = new Map();

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function atomicWrite(file, obj) {
  ensureDataDir();
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj));
  fs.renameSync(tmp, file);
}

function loadJson(file, fallback) {
  try {
    if (fs.existsSync(file)) {
      const raw = JSON.parse(fs.readFileSync(file, "utf8"));
      return raw && typeof raw === "object" ? raw : fallback;
    }
  } catch (e) {
    console.warn("load failed", file, e.message);
  }
  return fallback;
}

function load() {
  ensureDataDir();
  beacons = loadJson(DATA_FILE, {});
  hopePosts = loadJson(HOPE_FILE, {});
  flagPosts = loadJson(FLAGS_FILE, {});
  users = loadJson(USERS_FILE, {});
  tokenIndex = loadJson(TOKENS_FILE, {});
  /* migrate plaintext tokens → hashed */
  let userDirty = false;
  for (const [email, u] of Object.entries(users)) {
    if (!u || typeof u !== "object") continue;
    if (u.token && !u.tokenHash) {
      const th = hashToken(u.token);
      u.tokenHash = th;
      tokenIndex[th] = email;
      delete u.token;
      userDirty = true;
    } else if (u.token) {
      delete u.token;
      userDirty = true;
    }
    if (u.tokenHash && !tokenIndex[u.tokenHash]) {
      tokenIndex[u.tokenHash] = email;
    }
  }
  /* H5: drop legacy beacons without ownerHash */
  let beaconDirty = false;
  for (const id of Object.keys(beacons)) {
    const b = beacons[id];
    if (!b || !b.ownerHash) {
      delete beacons[id];
      beaconDirty = true;
    }
  }
  if (userDirty) {
    saveUsers();
    saveTokens();
  }
  if (beaconDirty) save();
  prune();
  pruneHope();
}

function save() {
  atomicWrite(DATA_FILE, beacons);
}
function saveHope() {
  atomicWrite(HOPE_FILE, hopePosts);
}
function saveFlags() {
  atomicWrite(FLAGS_FILE, flagPosts);
}
function sanitizeCenterId(raw) {
  const id = String(raw || "").trim().slice(0, MAX_CENTER_ID);
  if (!id) return "";
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,79}$/.test(id)) return "";
  return id;
}
function pruneFlags() {
  const ids = Object.keys(flagPosts).sort(
    (a, b) => (flagPosts[a].createdAt || 0) - (flagPosts[b].createdAt || 0)
  );
  if (ids.length <= MAX_FLAGS) return;
  for (const id of ids.slice(0, ids.length - MAX_FLAGS)) delete flagPosts[id];
}
function saveUsers() {
  atomicWrite(USERS_FILE, users);
}
function saveTokens() {
  atomicWrite(TOKENS_FILE, tokenIndex);
}

function pruneHope() {
  const ids = Object.keys(hopePosts).sort(
    (a, b) => (hopePosts[a].createdAt || 0) - (hopePosts[b].createdAt || 0)
  );
  if (ids.length <= MAX_HOPE_POSTS) return;
  for (const id of ids.slice(0, ids.length - MAX_HOPE_POSTS)) delete hopePosts[id];
  saveHope();
}

function prune() {
  const now = Date.now();
  let changed = false;
  for (const id of Object.keys(beacons)) {
    const b = beacons[id];
    if (!b || !b.ownerHash || (b.expiresAt && b.expiresAt < now)) {
      delete beacons[id];
      changed = true;
    }
  }
  if (changed) save();
}

function newId() {
  return crypto.randomBytes(8).toString("hex");
}

function newOwnerSecret() {
  return crypto.randomBytes(32).toString("base64url");
}

function hashOwnerSecret(secret) {
  return crypto.createHash("sha256").update(String(secret || ""), "utf8").digest("base64");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token || ""), "utf8").digest("base64");
}

function sha256HexTrunc(text, n) {
  return crypto
    .createHash("sha256")
    .update(String(text || ""), "utf8")
    .digest("hex")
    .slice(0, n || 32);
}

function timingSafeEqualStr(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function extractBeaconSecret(req) {
  const h = String(req.get("Authorization") || "");
  const m = h.match(/^Beacon\s+(.+)$/i);
  if (m) return m[1].trim();
  return String(req.get("X-Hearth-Beacon") || "").trim();
}

function verifyBeaconOwner(req, beacon) {
  if (!beacon || !beacon.ownerHash) return false;
  const secret = extractBeaconSecret(req);
  if (!secret) return false;
  return timingSafeEqualStr(hashOwnerSecret(secret), beacon.ownerHash);
}

function extractAdminSecret(req) {
  const h = String(req.get("X-Hearth-Admin") || "").trim();
  if (h) return h;
  const auth = String(req.get("Authorization") || "").trim();
  if (auth.toLowerCase().startsWith("admin ")) return auth.slice(6).trim();
  return "";
}

function verifyHopeAdmin(req) {
  const configured = String(process.env.HOPE_ADMIN_SECRET || "").trim();
  if (!configured) return { ok: false, reason: "unset" };
  const provided = extractAdminSecret(req);
  if (!provided || !timingSafeEqualStr(provided, configured)) return { ok: false, reason: "auth" };
  return { ok: true };
}


function clientIp(req) {
  const cf = String(req.get("CF-Connecting-IP") || "").trim();
  if (cf) return cf;
  const xff = String(req.get("X-Forwarded-For") || "").split(",")[0].trim();
  if (xff) return xff;
  return req.ip || "unknown";
}

function checkRate(req, bucket) {
  const spec = RATE[bucket];
  if (!spec) return null;
  const ipHash = sha256HexTrunc(clientIp(req), 24);
  const key = `rl:${bucket}:${ipHash}`;
  const now = Date.now();
  let entry = rateMap.get(key);
  if (!entry || entry.exp <= now) {
    entry = { n: 0, exp: now + spec.window * 1000 };
  }
  if (entry.n >= spec.max) {
    return { limited: true, retryAfter: Math.max(1, Math.ceil((entry.exp - now) / 1000)) };
  }
  entry.n += 1;
  rateMap.set(key, entry);
  return null;
}

function sanitizeBeacon(body, existing) {
  const now = Date.now();
  let lat = Number(body && (body.lat != null ? body.lat : body.latitude));
  let lng = Number(body && (body.lng != null ? body.lng : body.longitude));
  const stateHint = String((body && body.state) || "")
    .trim()
    .toUpperCase()
    .slice(0, 2);
  if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && /^[A-Z]{2}$/.test(stateHint)) {
    lat = 0;
    lng = 0;
  }
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return { error: "invalid lat" };
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) return { error: "invalid lng" };
  let expiresAt = Number(body && (body.expiresAt != null ? body.expiresAt : body.expires));
  if (!Number.isFinite(expiresAt)) expiresAt = now + 24 * 3600 * 1000;
  const maxExp = now + MAX_HOURS * 3600 * 1000;
  if (expiresAt > maxExp) expiresAt = maxExp;
  if (expiresAt <= now) return { error: "expired" };
  const createdAt = existing && existing.createdAt ? existing.createdAt : now;
  const bodyObj = body && typeof body === "object" ? body : {};
  const hasZip =
    Object.prototype.hasOwnProperty.call(bodyObj, "coarseZip") ||
    Object.prototype.hasOwnProperty.call(bodyObj, "zip");
  const hasState = Object.prototype.hasOwnProperty.call(bodyObj, "state");
  let coarseZip;
  if (hasZip) {
    coarseZip = String(bodyObj.coarseZip || bodyObj.zip || "").slice(0, 10);
  } else if (existing) {
    coarseZip = String(existing.coarseZip || "").slice(0, 10);
  } else {
    coarseZip = "";
  }
  let state;
  if (hasState) {
    state = String(bodyObj.state || "")
      .trim()
      .toUpperCase()
      .slice(0, 2);
  } else if (existing) {
    state = String(existing.state || "")
      .trim()
      .toUpperCase()
      .slice(0, 2);
  } else {
    state = "";
  }
  if (state && !/^[A-Z]{2}$/.test(state)) state = "";
  const out = {
    lat: Math.round(lat * 10000) / 10000,
    lng: Math.round(lng * 10000) / 10000,
    createdAt,
    expiresAt,
    coarseZip,
    state
  };
  if (existing && existing.notes) out.notes = existing.notes;
  if (existing && existing.ownerHash) out.ownerHash = existing.ownerHash;
  return { value: out };
}

function publicBeacon(b) {
  return {
    lat: b.lat,
    lng: b.lng,
    createdAt: b.createdAt,
    expiresAt: b.expiresAt,
    state: b.state || ""
  };
}

function publicBeacons() {
  prune();
  const out = {};
  for (const [id, b] of Object.entries(beacons)) out[id] = publicBeacon(b);
  return out;
}

function normEmail(e) {
  return String(e || "")
    .trim()
    .toLowerCase()
    .slice(0, 120);
}

function validEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function validPassword(p) {
  const s = String(p || "");
  /* 1.7.2: min 8 (was 6). Existing short passwords still login; client UI lags until next ship. */
  return s.length >= 8 && s.length <= 72;
}

function hashPassword(password, saltBuf) {
  const salt = saltBuf || crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(String(password), salt, PBKDF2_ITERS, 32, "sha256");
  return { hash: hash.toString("base64"), salt: salt.toString("base64") };
}

function verifyPassword(password, saltB64, hashB64) {
  const salt = Buffer.from(saltB64, "base64");
  const { hash } = hashPassword(password, salt);
  return timingSafeEqualStr(hash, hashB64);
}

function issueToken(email, user) {
  if (user.tokenHash && tokenIndex[user.tokenHash]) {
    delete tokenIndex[user.tokenHash];
  }
  const token = crypto.randomBytes(24).toString("hex");
  const th = hashToken(token);
  user.tokenHash = th;
  user.tokenExp = Date.now() + TOKEN_TTL_MS;
  delete user.token;
  tokenIndex[th] = email;
  saveUsers();
  saveTokens();
  return token;
}

function findUserByToken(req) {
  const h = String(req.headers.authorization || "");
  const m = h.match(/^Bearer\s+(.+)$/i);
  const token = m ? m[1].trim() : String(req.headers["x-hearth-token"] || "").trim();
  if (!token) return null;
  const th = hashToken(token);
  const email = tokenIndex[th];
  if (!email) return null;
  const u = users[email];
  if (!u || !u.tokenExp || u.tokenExp <= Date.now()) return null;
  if (u.tokenHash && !timingSafeEqualStr(u.tokenHash, th)) return null;
  return u;
}

function publicUser(u) {
  return { id: u.id, email: u.email, createdAt: u.createdAt };
}

function emptyPrivate() {
  return {
    baby: null,
    contractions: null,
    reminders: null,
    ember: null,
    updatedAt: 0
  };
}

function capArray(arr, max) {
  if (!Array.isArray(arr)) return arr;
  return arr.length > max ? arr.slice(-max) : arr;
}

function sanitizePrivateBlob(incoming) {
  const src = incoming && typeof incoming === "object" ? incoming : {};
  const safe = {
    baby: src.baby != null ? src.baby : null,
    contractions: src.contractions != null ? src.contractions : null,
    reminders: src.reminders != null ? src.reminders : null,
    ember: src.ember != null ? src.ember : null,
    updatedAt: Date.now()
  };
  if (safe.contractions && typeof safe.contractions === "object") {
    const c = Object.assign({}, safe.contractions);
    if (Array.isArray(c.events)) c.events = capArray(c.events, 200);
    if (Array.isArray(c.history)) c.history = capArray(c.history, 200);
    safe.contractions = c;
  }
  if (safe.baby && typeof safe.baby === "object") {
    const b = Object.assign({}, safe.baby);
    if (Array.isArray(b.feeds)) b.feeds = capArray(b.feeds, 500);
    if (Array.isArray(b.diapers)) b.diapers = capArray(b.diapers, 500);
    if (Array.isArray(b.events)) b.events = capArray(b.events, 500);
    safe.baby = b;
  }
  if (Array.isArray(safe.reminders)) {
    safe.reminders = capArray(safe.reminders, 50);
  } else if (safe.reminders && typeof safe.reminders === "object") {
    const r = Object.assign({}, safe.reminders);
    if (Array.isArray(r.items)) r.items = capArray(r.items, 50);
    if (Array.isArray(r.list)) r.list = capArray(r.list, 50);
    safe.reminders = r;
  }
  if (safe.ember && typeof safe.ember === "object") {
    safe.ember = {
      id: String(safe.ember.id || "").slice(0, 32),
      state: String(safe.ember.state || "")
        .toUpperCase()
        .slice(0, 2),
      expiresAt: Number(safe.ember.expiresAt) || 0,
      hours: Number(safe.ember.hours) || 0,
      updatedAt: Number(safe.ember.updatedAt) || Date.now()
    };
  }
  if (JSON.stringify(safe).length > MAX_PRIVATE_BYTES) return { error: "too large" };
  return { value: safe };
}

function mergePrivate(cloud, local) {
  const c = cloud && typeof cloud === "object" ? cloud : emptyPrivate();
  const l = local && typeof local === "object" ? local : emptyPrivate();
  const out = emptyPrivate();
  out.updatedAt = Math.max(Number(c.updatedAt) || 0, Number(l.updatedAt) || 0, Date.now());
  function pick(key) {
    const cv = c[key],
      lv = l[key];
    if (cv == null && lv == null) return null;
    if (cv == null) return lv;
    if (lv == null) return cv;
    const ct = Number((cv && cv.updatedAt) || c.updatedAt || 0);
    const lt = Number((lv && lv.updatedAt) || l.updatedAt || 0);
    return lt >= ct ? lv : cv;
  }
  out.baby = pick("baby");
  out.contractions = pick("contractions");
  out.reminders = pick("reminders");
  out.ember = pick("ember");
  return out;
}

function trimNotes(notes) {
  if (!notes || typeof notes !== "object") return {};
  const ids = Object.keys(notes).sort(
    (a, b) => (notes[a].createdAt || 0) - (notes[b].createdAt || 0)
  );
  if (ids.length <= MAX_NOTES_PER_BEACON) return notes;
  const keep = ids.slice(ids.length - MAX_NOTES_PER_BEACON);
  const out = {};
  for (const id of keep) out[id] = notes[id];
  return out;
}

function sleepSync(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    /* busy wait for M1 timing pad — short */
  }
}

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", true);

/* CORS allowlist */
app.use((req, res, next) => {
  const origin = String(req.get("Origin") || "");
  res.setHeader("Vary", "Origin");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Hearth-Token, X-Hearth-Beacon, X-Hearth-Admin"
  );
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else if (!origin) {
    res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGINS[0]);
  }
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

/* Body size: reject Content-Length > 64KB before parse; express limit mirrors */
app.use((req, res, next) => {
  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    const cl = req.get("Content-Length");
    if (cl != null && cl !== "" && Number(cl) > MAX_BODY) {
      return res.status(413).json({ error: "too large" });
    }
  }
  next();
});

app.use(
  express.json({
    limit: MAX_BODY,
    verify: (req, _res, buf) => {
      if (buf && buf.length > MAX_BODY) {
        const err = new Error("too large");
        err.status = 413;
        err.type = "entity.too.large";
        throw err;
      }
    }
  })
);

app.use((err, _req, res, next) => {
  if (err && (err.status === 413 || err.type === "entity.too.large")) {
    return res.status(413).json({ error: "too large" });
  }
  next(err);
});

function noStore(res) {
  res.setHeader("Cache-Control", "no-store");
}

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "heart-ember-api",
    version: VERSION,
    host: "express-local",
    endpoints: [
      "/health",
      "/beacons",
      "/beacons/:id",
      "/beacons/:id/notes",
      "/hope",
      "/flags",
      "/auth/signup",
      "/auth/login",
      "/auth/logout",
      "/auth/me",
      "/me/sync"
    ]
  });
});

app.get("/health", (_req, res) => {
  prune();
  res.json({
    ok: true,
    lights: Object.keys(beacons).length,
    version: VERSION
  });
});

app.get("/beacons", (_req, res) => {
  res.json(publicBeacons());
});

app.post("/beacons", (req, res) => {
  const limited = checkRate(req, "post-beacons");
  if (limited) {
    res.setHeader("Retry-After", String(limited.retryAfter));
    return res.status(429).json({ error: "rate" });
  }
  const { value, error } = sanitizeBeacon(req.body, null);
  if (error) return res.status(400).json({ error });
  const id = newId();
  const ownerSecret = newOwnerSecret();
  value.ownerHash = hashOwnerSecret(ownerSecret);
  value.createdAt = Date.now();
  beacons[id] = value;
  save();
  res.status(201).json({ id, ownerSecret, beacon: publicBeacon(value) });
});

app.put("/beacons/:id", (req, res) => {
  const id = req.params.id;
  const existing = beacons[id];
  if (!existing || !existing.ownerHash) {
    if (existing && !existing.ownerHash) {
      delete beacons[id];
      save();
    }
    return res.status(404).json({ error: "not found" });
  }
  if (!verifyBeaconOwner(req, existing)) {
    noStore(res);
    return res.status(401).json({ error: "auth" });
  }
  const { value, error } = sanitizeBeacon(req.body, existing);
  if (error) return res.status(400).json({ error });
  beacons[id] = value;
  save();
  res.json({ id });
});

app.delete("/beacons/:id", (req, res) => {
  const id = req.params.id;
  if (!beacons[id] || !beacons[id].ownerHash) {
    if (beacons[id] && !beacons[id].ownerHash) {
      delete beacons[id];
      save();
    }
    return res.status(404).json({ error: "not found" });
  }
  if (!verifyBeaconOwner(req, beacons[id])) {
    noStore(res);
    return res.status(401).json({ error: "auth" });
  }
  delete beacons[id];
  save();
  res.json({ ok: true });
});

app.get("/beacons/:id/notes", (req, res) => {
  prune();
  const b = beacons[req.params.id];
  if (!b || !b.ownerHash) return res.status(404).json({ error: "not found" });
  if (!verifyBeaconOwner(req, b)) {
    noStore(res);
    return res.status(401).json({ error: "auth" });
  }
  noStore(res);
  res.json(b.notes || {});
});

app.post("/beacons/:id/notes", (req, res) => {
  const limited = checkRate(req, "post-notes");
  if (limited) {
    res.setHeader("Retry-After", String(limited.retryAfter));
    return res.status(429).json({ error: "rate" });
  }
  prune();
  const b = beacons[req.params.id];
  if (!b || !b.ownerHash) return res.status(404).json({ error: "not found" });
  const text = String((req.body && req.body.text) || "")
    .trim()
    .slice(0, MAX_NOTE);
  if (!text) return res.status(400).json({ error: "empty" });
  const fromLabel = String((req.body && req.body.fromLabel) || "A mom nearby").slice(0, 40);
  if (contentBlocked(text) || contentBlocked(fromLabel)) {
    return res.status(400).json({ error: "blocked" });
  }
  const nid = newId();
  if (!b.notes) b.notes = {};
  b.notes[nid] = {
    text,
    createdAt: Date.now(),
    fromLabel
  };
  b.notes = trimNotes(b.notes);
  save();
  res.status(201).json({ id: nid });
});

app.get("/hope", (_req, res) => {
  pruneHope();
  const out = {};
  for (const [id, p] of Object.entries(hopePosts)) {
    out[id] = { text: p.text, createdAt: p.createdAt, fromLabel: p.fromLabel || "A mom" };
  }
  res.json(out);
});

app.post("/hope", (req, res) => {
  const limited = checkRate(req, "post-hope");
  if (limited) {
    res.setHeader("Retry-After", String(limited.retryAfter));
    return res.status(429).json({ error: "rate" });
  }
  const textBody = String((req.body && req.body.text) || "")
    .trim()
    .slice(0, MAX_HOPE);
  if (!textBody) return res.status(400).json({ error: "empty" });
  const fromLabel =
    String((req.body && req.body.fromLabel) || "A mom")
      .trim()
      .slice(0, 40) || "A mom";
  if (contentBlocked(textBody) || contentBlocked(fromLabel)) {
    return res.status(400).json({ error: "blocked" });
  }
  const id = newId();
  hopePosts[id] = { text: textBody, createdAt: Date.now(), fromLabel };
  pruneHope();
  saveHope();
  res.status(201).json({ id });
});


app.post("/flags", (req, res) => {
  const limited = checkRate(req, "post-flags");
  if (limited) {
    res.setHeader("Retry-After", String(limited.retryAfter));
    return res.status(429).json({ ok: false, error: "rate" });
  }
  const body = req.body || {};
  const centerId = sanitizeCenterId(body.centerId);
  if (!centerId) return res.status(400).json({ ok: false, error: "centerId" });
  const name = String(body.name || "").trim().slice(0, MAX_FLAG_NAME);
  const city = String(body.city || "").trim().slice(0, MAX_FLAG_CITY);
  const state = String(body.state || "").trim().slice(0, MAX_FLAG_STATE);
  let reason = String(body.reason || "").trim().slice(0, MAX_FLAG_REASON);
  let note = String(body.note || "").trim().slice(0, MAX_FLAG_NOTE);
  let source = String(body.source || "").trim();
  if (source && !FLAG_SOURCES.has(source)) {
    return res.status(400).json({ ok: false, error: "source" });
  }
  if (name && contentBlocked(name)) return res.status(400).json({ ok: false, error: "blocked" });
  if (reason && contentBlocked(reason)) return res.status(400).json({ ok: false, error: "blocked" });
  if (note && contentBlocked(note)) return res.status(400).json({ ok: false, error: "blocked" });
  const id = newId();
  flagPosts[id] = {
    centerId,
    name,
    city,
    state,
    reason: reason || "abortion_provider",
    source,
    note,
    createdAt: Date.now(),
    ipHash: "local"
  };
  pruneFlags();
  saveFlags();
  res.status(201).json({ ok: true, id, queued: true });
});

app.get("/flags", (req, res) => {
  noStore(res);
  const admin = verifyHopeAdmin(req);
  if (admin.reason === "unset") return res.status(503).json({ error: "admin unset" });
  if (!admin.ok) return res.status(401).json({ error: "auth" });
  const flags = Object.entries(flagPosts).map(([id, row]) => ({
    id,
    centerId: row.centerId,
    name: row.name || "",
    city: row.city || "",
    state: row.state || "",
    reason: row.reason || "",
    source: row.source || "",
    note: row.note || "",
    createdAt: row.createdAt || 0
  }));
  flags.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  res.json({ flags, count: flags.length });
});

app.delete("/hope/:id", (req, res) => {
  noStore(res);
  const admin = verifyHopeAdmin(req);
  if (admin.reason === "unset") return res.status(503).json({ error: "admin unset" });
  if (!admin.ok) return res.status(401).json({ error: "auth" });
  const id = String(req.params.id || "");
  delete hopePosts[id];
  saveHope();
  res.json({ ok: true, id });
});

app.delete("/hope", (req, res) => {
  noStore(res);
  const admin = verifyHopeAdmin(req);
  if (admin.reason === "unset") return res.status(503).json({ error: "admin unset" });
  if (!admin.ok) return res.status(401).json({ error: "auth" });
  hopePosts = {};
  saveHope();
  res.json({ ok: true, cleared: true });
});

app.post("/admin/hope/clear", (req, res) => {
  noStore(res);
  const admin = verifyHopeAdmin(req);
  if (admin.reason === "unset") return res.status(503).json({ error: "admin unset" });
  if (!admin.ok) return res.status(401).json({ error: "auth" });
  hopePosts = {};
  saveHope();
  res.json({ ok: true, cleared: true });
});

app.post("/auth/signup", (req, res) => {
  noStore(res);
  const limited = checkRate(req, "signup");
  if (limited) {
    res.setHeader("Retry-After", String(limited.retryAfter));
    return res.status(429).json({ error: "rate" });
  }
  const email = normEmail(req.body && req.body.email);
  const password = String((req.body && req.body.password) || "");
  if (!validEmail(email)) return res.status(400).json({ error: "email" });
  if (!validPassword(password)) return res.status(400).json({ error: "password" });
  sleepSync(200);
  if (users[email]) return res.status(409).json({ error: "exists" });
  const { hash, salt } = hashPassword(password);
  const u = {
    id: newId(),
    email,
    passHash: hash,
    passSalt: salt,
    createdAt: Date.now(),
    tokenHash: null,
    tokenExp: 0,
    private: emptyPrivate()
  };
  users[email] = u;
  const token = issueToken(email, u);
  res.status(201).json({ token, user: publicUser(u), private: u.private });
});

app.post("/auth/login", (req, res) => {
  noStore(res);
  const limited = checkRate(req, "login");
  if (limited) {
    res.setHeader("Retry-After", String(limited.retryAfter));
    return res.status(429).json({ error: "rate" });
  }
  const email = normEmail(req.body && req.body.email);
  const password = String((req.body && req.body.password) || "");
  const u = users[email];
  if (!u || !verifyPassword(password, u.passSalt, u.passHash)) {
    return res.status(401).json({ error: "credentials" });
  }
  const token = issueToken(email, u);
  res.json({ token, user: publicUser(u), private: u.private || emptyPrivate() });
});

app.post("/auth/logout", (req, res) => {
  noStore(res);
  const u = findUserByToken(req);
  if (u) {
    if (u.tokenHash) delete tokenIndex[u.tokenHash];
    u.tokenHash = null;
    u.tokenExp = 0;
    delete u.token;
    saveUsers();
    saveTokens();
  }
  res.json({ ok: true });
});

app.get("/auth/me", (req, res) => {
  noStore(res);
  const u = findUserByToken(req);
  if (!u) return res.status(401).json({ error: "auth" });
  res.json({ user: publicUser(u), private: u.private || emptyPrivate() });
});

app.get("/me/sync", (req, res) => {
  noStore(res);
  const u = findUserByToken(req);
  if (!u) return res.status(401).json({ error: "auth" });
  res.json({ private: u.private || emptyPrivate() });
});

app.put("/me/sync", (req, res) => {
  noStore(res);
  const u = findUserByToken(req);
  if (!u) return res.status(401).json({ error: "auth" });
  const incoming = (req.body && req.body.private) || req.body || {};
  const sanitized = sanitizePrivateBlob(incoming);
  if (sanitized.error) return res.status(400).json({ error: sanitized.error });
  u.private = mergePrivate(u.private, sanitized.value);
  u.private.updatedAt = Date.now();
  if (JSON.stringify(u.private).length > MAX_PRIVATE_BYTES) {
    return res.status(400).json({ error: "too large" });
  }
  saveUsers();
  res.json({ private: u.private });
});

load();
setInterval(prune, 60 * 1000);

if (require.main === module) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log("heart-ember-api " + VERSION + " listening on " + PORT + (RATE_TEST ? " (RATE_TEST)" : ""));
  });
}

module.exports = app;
