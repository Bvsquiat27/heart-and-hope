/**
 * Cloudflare Worker — Hearth Ember API + Accounts (KV) v1.7.5
 * Public /beacons never include private account payloads, ownerHash, or notes.
 */
const VERSION = "1.7.5";
const MAX_NOTE = 200;
const MAX_HOURS = 48;
const MAX_HOPE = 400;
const MAX_HOPE_POSTS = 200;
const MAX_NOTES_PER_BEACON = 50;
const MAX_BODY = 64000;
const MAX_PRIVATE_BYTES = 48000;
const TOKEN_TTL_MS = 90 * 24 * 3600 * 1000;
const LEGACY_ALL = "all";
const IDX_BEACONS = "idx:beacons";
const IDX_HOPE = "idx:hope";
const IDX_FLAGS = "idx:flags";
const MAX_FLAGS = 2000;
const MAX_CENTER_ID = 80;
const MAX_FLAG_REASON = 200;

const ALLOWED_ORIGINS = [
  "https://bvsquiat27.github.io",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
  "null" /* Android WebView / file APK Ember — Origin header is the string "null" */
];

const RATE = {
  "post-beacons": { max: 5, window: 600 },
  "post-notes": { max: 20, window: 600 },
  "post-hope": { max: 10, window: 600 },
  "post-flags": { max: 15, window: 600 },
  signup: { max: 5, window: 3600 },
  login: { max: 20, window: 900 }
};

/* Hope/notes block — aligned with js/support.js filterHopeText + js/beacon.js filterNote.
 * fuck\w* covers fucking/etc. @handle is OUTSIDE \b (word-boundary never fires before @). */
const CONTENT_BLOCK = [
  /\b(kill|murder|rape|suicide|kms|kys|die\s*bitch|hurt\s*you|stalk|bomb|shoot)\b/i,
  /\bfuck\w*\b/i,
  /\b(shit|bitch|asshole|cunt|slut|whore|nigg\w*|faggot|retard)\b/i,
  /\b(sex|sexy|nude|porn|onlyfans)\b/i,
  /\b(kill\s*yourself|hang\s*yourself|cut\s*yourself)\b/i,
  /\b(https?:\/\/|www\.|\.com\b|\.net\b|\.org\b)/i,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/,
  /(?:^|[^\w])@[a-z0-9_]{3,}/i,
  /\b(snapchat|instagram|tiktok|discord|telegram|whatsapp|dm\s*me|text\s*me|call\s*me)\b/i
];

/** NFKC + strip Unicode Cf (zero-width / format) before CONTENT_BLOCK matching. */
function prepContent(text) {
  let t = String(text || "").normalize("NFKC");
  try {
    t = t.replace(/\p{Cf}/gu, "");
  } catch (_) {
    t = t.replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF\u180E]/g, "");
  }
  return t;
}

/** Modest leetspeak + spaced/punctuated letter collapse (f.u.c.k / f u c k).
 * Do NOT collapse ordinary spaces between multi-letter words — that glued
 * "say f.u.c.k now" -> "sayfucknow" and broke word-boundary matches (1.7.3). */
function normalizeForBlock(text) {
  let t = prepContent(text).toLowerCase();
  t = t
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/\$/g, "s")
    .replace(/!/g, "i");
  /* punct between letters only: f.u.c.k → fuck */
  t = t.replace(/([a-z])[._*\-"'`·]+(?=[a-z])/g, "$1");
  /* spaced single-letter runs: "f u c k" → "fuck" (keeps multi-letter words intact) */
  t = t.replace(/(^|[^a-z])((?:[a-z]\s+){1,}[a-z])(?=[^a-z]|$)/g, (_, pre, run) =>
    pre + run.replace(/\s+/g, "")
  );
  return t;
}

/** Compact morph after leet map — client filterHopeText parity (fvck/phuck)
 * plus digit-aware f0ck→fock. Does not re-glue multi-word phrases. */
function fuckMorphBlocked(collapsed) {
  const compact = String(collapsed || "").replace(/[\s.\-_/\\|'"´`·*]+/g, "");
  return /f[uov]+c+k/.test(compact) || /fc+k/.test(compact) || /phuck/.test(compact);
}

function contentBlocked(text) {
  const prepared = prepContent(text);
  const collapsed = normalizeForBlock(text);
  if (fuckMorphBlocked(collapsed)) return true;
  for (let i = 0; i < CONTENT_BLOCK.length; i++) {
    const re = CONTENT_BLOCK[i];
    if (re.test(prepared) || re.test(collapsed)) return true;
  }
  return false;
}

function corsHeaders(request, extra) {
  const origin = String(request.headers.get("Origin") || "");
  const h = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Hearth-Token, X-Hearth-Beacon, X-Hearth-Admin",
    "Content-Type": "application/json",
    "X-Content-Type-Options": "nosniff",
    Vary: "Origin"
  };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    h["Access-Control-Allow-Origin"] = origin;
  } else if (!origin) {
    h["Access-Control-Allow-Origin"] = ALLOWED_ORIGINS[0];
  }
  if (extra) Object.assign(h, extra);
  return h;
}

function json(request, data, status, extraHeaders) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: corsHeaders(request, extraHeaders)
  });
}

function newId() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

function b64(buf) {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function fromB64(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function newOwnerSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return b64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256B64(text) {
  const dig = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(String(text || ""))
  );
  return b64(dig);
}

async function sha256HexTrunc(text, n) {
  const dig = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(String(text || ""))
  );
  const bytes = new Uint8Array(dig);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0");
  return hex.slice(0, n || 32);
}

async function hashOwnerSecret(secret) {
  return sha256B64(secret);
}

function timingSafeEqualStr(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function extractBeaconSecret(req) {
  const h = String(req.headers.get("Authorization") || "");
  const m = h.match(/^Beacon\s+(.+)$/i);
  if (m) return m[1].trim();
  return String(req.headers.get("X-Hearth-Beacon") || "").trim();
}

async function verifyBeaconOwner(req, beacon) {
  if (!beacon || !beacon.ownerHash) return false;
  const secret = extractBeaconSecret(req);
  if (!secret) return false;
  const hash = await hashOwnerSecret(secret);
  return timingSafeEqualStr(hash, beacon.ownerHash);
}

function clientIp(req) {
  const cf = String(req.headers.get("CF-Connecting-IP") || "").trim();
  if (cf) return cf;
  const xff = String(req.headers.get("X-Forwarded-For") || "").split(",")[0].trim();
  if (xff) return xff;
  return "unknown";
}

async function checkRate(env, req, bucket) {
  const spec = RATE[bucket];
  if (!spec) return null;
  const ipHash = await sha256HexTrunc(clientIp(req), 24);
  const key = `rl:${bucket}:${ipHash}`;
  let n = 0;
  try {
    const raw = await env.BEACONS.get(key);
    n = raw ? Number(raw) || 0 : 0;
  } catch (_) {
    n = 0;
  }
  if (n >= spec.max) {
    return { limited: true, retryAfter: spec.window };
  }
  try {
    await env.BEACONS.put(key, String(n + 1), { expirationTtl: Math.max(60, spec.window) });
  } catch (_) {}
  return null;
}

function rateResponse(request, retryAfter) {
  return json(
    request,
    { error: "rate" },
    429,
    { "Retry-After": String(retryAfter || 60) }
  );
}

async function readJsonCapped(request, maxBytes) {
  const limit = maxBytes || MAX_BODY;
  const cl = request.headers.get("Content-Length");
  if (cl != null && cl !== "" && Number(cl) > limit) {
    return { tooLarge: true };
  }
  if (!request.body) return { value: {} };
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      try {
        await reader.cancel();
      } catch (_) {}
      return { tooLarge: true };
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    merged.set(c, off);
    off += c.byteLength;
  }
  if (total === 0) return { value: {} };
  try {
    const text = new TextDecoder().decode(merged);
    return { value: JSON.parse(text) };
  } catch {
    return { value: {} };
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/* ——— KV: beacons ——— */

async function migrateBeaconsOnce(kv) {
  const idxRaw = await kv.get(IDX_BEACONS, "json");
  if (Array.isArray(idxRaw)) return;
  const legacy = await kv.get(LEGACY_ALL, "json");
  if (!legacy || typeof legacy !== "object") {
    await kv.put(IDX_BEACONS, JSON.stringify([]));
    return;
  }
  const ids = [];
  const now = Date.now();
  for (const [id, b] of Object.entries(legacy)) {
    if (!b || typeof b !== "object") continue;
    if (!b.ownerHash) continue; /* H5: drop unsigned legacy lights */
    if (b.expiresAt && b.expiresAt < now) continue;
    await kv.put(`b:${id}`, JSON.stringify(b));
    ids.push(id);
  }
  await kv.put(IDX_BEACONS, JSON.stringify(ids));
  try {
    await kv.delete(LEGACY_ALL);
  } catch (_) {}
}

async function getBeaconIndex(kv) {
  await migrateBeaconsOnce(kv);
  const idx = await kv.get(IDX_BEACONS, "json");
  return Array.isArray(idx) ? idx : [];
}

async function setBeaconIndex(kv, ids) {
  await kv.put(IDX_BEACONS, JSON.stringify(ids));
}

async function loadBeacon(kv, id) {
  try {
    const b = await kv.get(`b:${id}`, "json");
    return b && typeof b === "object" ? b : null;
  } catch {
    return null;
  }
}

async function saveBeacon(kv, id, beacon) {
  await kv.put(`b:${id}`, JSON.stringify(beacon));
}

async function deleteBeacon(kv, id) {
  try {
    await kv.delete(`b:${id}`);
  } catch (_) {}
}

async function listBeaconsMap(kv) {
  let ids = await getBeaconIndex(kv);
  const now = Date.now();
  const out = {};
  const keep = [];
  let changed = false;
  for (const id of ids) {
    const b = await loadBeacon(kv, id);
    if (!b || (b.expiresAt && b.expiresAt < now) || !b.ownerHash) {
      await deleteBeacon(kv, id);
      changed = true;
      continue;
    }
    out[id] = b;
    keep.push(id);
  }
  if (changed || keep.length !== ids.length) await setBeaconIndex(kv, keep);
  return out;
}

/**
 * Best-effort KV index mutation with verify-and-retry merge (H3).
 * Workers KV has no CAS; we re-read after put and retry if our id was lost/overwritten.
 * Durable Object serialization remains the proper follow-up.
 */
async function mutateBeaconIndex(kv, mutator, verify) {
  const MAX = 8;
  for (let attempt = 0; attempt < MAX; attempt++) {
    const ids = await getBeaconIndex(kv);
    const next = mutator(ids.slice());
    await setBeaconIndex(kv, next);
    const after = await getBeaconIndex(kv);
    if (verify(after)) return after;
    await sleep(15 + attempt * 25);
  }
  const ids = await getBeaconIndex(kv);
  const next = mutator(ids.slice());
  await setBeaconIndex(kv, next);
  return next;
}

async function addBeaconId(kv, id) {
  await mutateBeaconIndex(
    kv,
    (ids) => {
      if (!ids.includes(id)) ids.push(id);
      return ids;
    },
    (after) => after.includes(id)
  );
}

async function dropBeaconId(kv, id) {
  await mutateBeaconIndex(
    kv,
    (ids) => ids.filter((x) => x !== id),
    (after) => !after.includes(id)
  );
}

/* ——— KV: hope ——— */

async function migrateHopeOnce(kv) {
  const idxRaw = await kv.get(IDX_HOPE, "json");
  if (Array.isArray(idxRaw)) return;
  const legacy = await kv.get(LEGACY_ALL, "json");
  if (!legacy || typeof legacy !== "object") {
    await kv.put(IDX_HOPE, JSON.stringify([]));
    return;
  }
  const ids = Object.keys(legacy);
  for (const id of ids) {
    await kv.put(`h:${id}`, JSON.stringify(legacy[id]));
  }
  await kv.put(IDX_HOPE, JSON.stringify(ids));
  try {
    await kv.delete(LEGACY_ALL);
  } catch (_) {}
}

async function getHopeIndex(kv) {
  await migrateHopeOnce(kv);
  const idx = await kv.get(IDX_HOPE, "json");
  return Array.isArray(idx) ? idx : [];
}

async function setHopeIndex(kv, ids) {
  await kv.put(IDX_HOPE, JSON.stringify(ids));
}

async function mutateHopeIndex(kv, mutator, verify) {
  const MAX = 8;
  for (let attempt = 0; attempt < MAX; attempt++) {
    const ids = await getHopeIndex(kv);
    const next = mutator(ids.slice());
    await setHopeIndex(kv, next);
    const after = await getHopeIndex(kv);
    if (verify(after)) return after;
    await sleep(15 + attempt * 25);
  }
  const ids = await getHopeIndex(kv);
  const next = mutator(ids.slice());
  await setHopeIndex(kv, next);
  return next;
}

async function addHopeId(kv, id) {
  return mutateHopeIndex(
    kv,
    (ids) => {
      const next = ids.slice();
      if (!next.includes(id)) next.push(id);
      while (next.length > MAX_HOPE_POSTS) {
        next.shift(); /* caller deletes pruned h: keys separately when possible */
      }
      return next;
    },
    (after) => after.includes(id)
  );
}



/* ——— KV: center flags (review queue; never auto-deletes listings) ——— */

async function getFlagIndex(kv) {
  const idx = await kv.get(IDX_FLAGS, "json");
  return Array.isArray(idx) ? idx : [];
}

async function setFlagIndex(kv, ids) {
  await kv.put(IDX_FLAGS, JSON.stringify(ids));
}

async function mutateFlagIndex(kv, mutator, verify) {
  const MAX = 8;
  for (let attempt = 0; attempt < MAX; attempt++) {
    const ids = await getFlagIndex(kv);
    const next = mutator(ids.slice());
    await setFlagIndex(kv, next);
    const after = await getFlagIndex(kv);
    if (verify(after)) return after;
    await sleep(15 + attempt * 25);
  }
  const ids = await getFlagIndex(kv);
  const next = mutator(ids.slice());
  await setFlagIndex(kv, next);
  return next;
}

async function addFlagId(kv, id) {
  return mutateFlagIndex(
    kv,
    (ids) => {
      const next = ids.slice();
      if (!next.includes(id)) next.push(id);
      while (next.length > MAX_FLAGS) next.shift();
      return next;
    },
    (after) => after.includes(id)
  );
}

function sanitizeCenterId(raw) {
  const id = String(raw || "").trim().slice(0, MAX_CENTER_ID);
  if (!id) return "";
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,79}$/.test(id)) return "";
  return id;
}

async function listFlagsMap(kv) {
  const ids = await getFlagIndex(kv);
  const out = [];
  for (const id of ids) {
    try {
      const row = await kv.get(`flag:${id}`, "json");
      if (row && typeof row === "object" && row.centerId) {
        out.push({
          id,
          centerId: row.centerId,
          reason: row.reason || "",
          createdAt: row.createdAt || 0
        });
      }
    } catch (_) {}
  }
  return out;
}

function extractAdminSecret(req) {
  const h = String(req.headers.get("X-Hearth-Admin") || "").trim();
  if (h) return h;
  const auth = String(req.headers.get("Authorization") || "").trim();
  if (auth.toLowerCase().startsWith("admin ")) return auth.slice(6).trim();
  return "";
}

function verifyHopeAdmin(request, env) {
  const configured = String((env && env.HOPE_ADMIN_SECRET) || "").trim();
  if (!configured) return { ok: false, reason: "unset" };
  const provided = extractAdminSecret(request);
  if (!provided || !timingSafeEqualStr(provided, configured)) return { ok: false, reason: "auth" };
  return { ok: true };
}

async function deleteHopePost(kv, id) {
  try {
    await kv.delete(`h:${id}`);
  } catch (_) {}
  /* also clear legacy blob entry if still present */
  try {
    const legacy = await kv.get(LEGACY_ALL, "json");
    if (legacy && typeof legacy === "object" && id in legacy) {
      delete legacy[id];
      await kv.put(LEGACY_ALL, JSON.stringify(legacy));
    }
  } catch (_) {}
  await mutateHopeIndex(
    kv,
    (ids) => ids.filter((x) => x !== id),
    (after) => !after.includes(id)
  );
}

async function clearAllHope(kv) {
  const ids = await getHopeIndex(kv);
  for (const id of ids) {
    try {
      await kv.delete(`h:${id}`);
    } catch (_) {}
  }
  try {
    await kv.put(LEGACY_ALL, JSON.stringify({}));
  } catch (_) {}
  await setHopeIndex(kv, []);
}


async function listHopeMap(kv) {
  let ids = await getHopeIndex(kv);
  const out = {};
  for (const id of ids) {
    try {
      const p = await kv.get(`h:${id}`, "json");
      if (p && typeof p === "object") out[id] = p;
    } catch (_) {}
  }
  /* prune excess */
  const sorted = Object.keys(out).sort(
    (a, b) => (out[a].createdAt || 0) - (out[b].createdAt || 0)
  );
  if (sorted.length > MAX_HOPE_POSTS) {
    const drop = sorted.slice(0, sorted.length - MAX_HOPE_POSTS);
    for (const id of drop) {
      delete out[id];
      try {
        await kv.delete(`h:${id}`);
      } catch (_) {}
    }
    await setHopeIndex(kv, sorted.slice(sorted.length - MAX_HOPE_POSTS));
  }
  return out;
}

/* ——— KV: users + hashed tokens ——— */

async function migrateUsersOnce(kv) {
  const marker = await kv.get("idx:users-migrated");
  if (marker === "1") return;
  const legacy = await kv.get(LEGACY_ALL, "json");
  if (legacy && typeof legacy === "object") {
    for (const [email, u] of Object.entries(legacy)) {
      if (!u || typeof u !== "object") continue;
      const copy = { ...u };
      if (copy.token && !copy.tokenHash) {
        const th = await sha256B64(copy.token);
        copy.tokenHash = th;
        await kv.put(`tok:${th}`, email);
        delete copy.token;
      } else if (copy.tokenHash) {
        await kv.put(`tok:${copy.tokenHash}`, email);
        delete copy.token;
      } else {
        delete copy.token;
      }
      await kv.put(`u:${email}`, JSON.stringify(copy));
    }
    try {
      await kv.delete(LEGACY_ALL);
    } catch (_) {}
  }
  await kv.put("idx:users-migrated", "1");
}

async function loadUser(kv, email) {
  await migrateUsersOnce(kv);
  try {
    const u = await kv.get(`u:${email}`, "json");
    return u && typeof u === "object" ? u : null;
  } catch {
    return null;
  }
}

async function saveUser(kv, email, user) {
  const copy = { ...user };
  delete copy.token; /* never persist plaintext */
  await kv.put(`u:${email}`, JSON.stringify(copy));
}

async function findByToken(kv, req) {
  await migrateUsersOnce(kv);
  const h = String(req.headers.get("Authorization") || "");
  const m = h.match(/^Bearer\s+(.+)$/i);
  const token = m ? m[1].trim() : String(req.headers.get("X-Hearth-Token") || "").trim();
  if (!token) return null;
  const th = await sha256B64(token);
  let email = null;
  try {
    email = await kv.get(`tok:${th}`);
  } catch (_) {}
  if (!email) return null;
  const u = await loadUser(kv, email);
  if (!u || !u.tokenExp || u.tokenExp <= Date.now()) return null;
  if (u.tokenHash && !timingSafeEqualStr(u.tokenHash, th)) return null;
  return { user: u, email, tokenHash: th };
}

async function issueToken(kv, email, user) {
  /* revoke old */
  if (user.tokenHash) {
    try {
      await kv.delete(`tok:${user.tokenHash}`);
    } catch (_) {}
  }
  const token = newId() + newId();
  const th = await sha256B64(token);
  user.tokenHash = th;
  user.tokenExp = Date.now() + TOKEN_TTL_MS;
  delete user.token;
  await kv.put(`tok:${th}`, email);
  await saveUser(kv, email, user);
  return token;
}

async function revokeToken(kv, email, user) {
  if (user.tokenHash) {
    try {
      await kv.delete(`tok:${user.tokenHash}`);
    } catch (_) {}
  }
  user.tokenHash = null;
  user.tokenExp = 0;
  delete user.token;
  await saveUser(kv, email, user);
}

function sanitizeBeacon(body, existing) {
  const now = Date.now();
  let lat = Number(body && body.lat);
  let lng = Number(body && body.lng);
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
  let expiresAt = Number(body && body.expiresAt);
  if (!Number.isFinite(expiresAt)) expiresAt = now + 24 * 3600 * 1000;
  const maxExp = now + MAX_HOURS * 3600 * 1000;
  if (expiresAt > maxExp) expiresAt = maxExp;
  if (expiresAt <= now) return { error: "expired" };
  const createdAt =
    existing && existing.createdAt ? existing.createdAt : now; /* L5 server-ish for create path */
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
    coarseZip: b.coarseZip || "",
    state: b.state || ""
  };
}

function publicBeacons(beacons) {
  const out = {};
  for (const [id, b] of Object.entries(beacons)) out[id] = publicBeacon(b);
  return out;
}

function emptyPrivate() {
  return { baby: null, contractions: null, reminders: null, ember: null, updatedAt: 0 };
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
  /* 1.7.2: min 10 (was 6). Existing shorter accounts still login; only new signups enforced. */
  return s.length >= 10 && s.length <= 72;
}

async function hashPassword(password, saltB64) {
  const enc = new TextEncoder();
  const salt = saltB64 ? fromB64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return { hash: b64(bits), salt: b64(salt) };
}

async function verifyPassword(password, saltB64, hashB64) {
  const { hash } = await hashPassword(password, saltB64);
  return timingSafeEqualStr(hash, String(hashB64 || ""));
}

function publicUser(u) {
  return { id: u.id, email: u.email, createdAt: u.createdAt };
}

function capArray(arr, max) {
  if (!Array.isArray(arr)) return arr;
  return arr.length > max ? arr.slice(-max) : arr;
}

function sanitizePrivateBlob(incoming) {
  const src = incoming && typeof incoming === "object" ? incoming : {};
  /* strip secrets / unknown top-level keys */
  const safe = {
    baby: src.baby != null ? src.baby : null,
    contractions: src.contractions != null ? src.contractions : null,
    reminders: src.reminders != null ? src.reminders : null,
    ember: src.ember != null ? src.ember : null,
    updatedAt: Date.now()
  };
  if (safe.contractions && typeof safe.contractions === "object") {
    const c = { ...safe.contractions };
    if (Array.isArray(c.events)) c.events = capArray(c.events, 200);
    if (Array.isArray(c.history)) c.history = capArray(c.history, 200);
    safe.contractions = c;
  }
  if (safe.baby && typeof safe.baby === "object") {
    const b = { ...safe.baby };
    if (Array.isArray(b.feeds)) b.feeds = capArray(b.feeds, 500);
    if (Array.isArray(b.diapers)) b.diapers = capArray(b.diapers, 500);
    if (Array.isArray(b.events)) b.events = capArray(b.events, 500);
    safe.baby = b;
  }
  if (safe.reminders && typeof safe.reminders === "object") {
    const r = { ...safe.reminders };
    if (Array.isArray(r.items)) r.items = capArray(r.items, 50);
    if (Array.isArray(r.list)) r.list = capArray(r.list, 50);
    if (Array.isArray(r)) {
      safe.reminders = capArray(safe.reminders, 50);
    } else {
      safe.reminders = r;
    }
  } else if (Array.isArray(safe.reminders)) {
    safe.reminders = capArray(safe.reminders, 50);
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
  const serialized = JSON.stringify(safe);
  if (serialized.length > MAX_PRIVATE_BYTES) {
    return { error: "too large" };
  }
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

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }
    const url = new URL(request.url);
    const p = url.pathname.replace(/\/$/, "") || "/";
    const noStore = { "Cache-Control": "no-store" };

    if (p === "/" || p === "/health") {
      const beacons = await listBeaconsMap(env.BEACONS);
      if (p === "/health") {
        return json(request, {
          ok: true,
          lights: Object.keys(beacons).length,
          version: VERSION
        });
      }
      return json(request, {
        ok: true,
        service: "hearth-ember-api",
        version: VERSION,
        host: "cloudflare-workers-kv",
        endpoints: [
          "/beacons",
          "/beacons/:id",
          "/beacons/:id/notes",
          "/hope",
          "/hope/:id",
          "/admin/hope/clear",
          "/flags",
          "/health",
          "/auth/signup",
          "/auth/login",
          "/auth/logout",
          "/auth/me",
          "/me/sync"
        ]
      });
    }

    /* ——— Embers ——— */
    if (p === "/beacons" && request.method === "GET") {
      const beacons = await listBeaconsMap(env.BEACONS);
      return json(request, publicBeacons(beacons));
    }

    if (p === "/beacons" && request.method === "POST") {
      const limited = await checkRate(env, request, "post-beacons");
      if (limited) return rateResponse(request, limited.retryAfter);
      const parsed = await readJsonCapped(request);
      if (parsed.tooLarge) return json(request, { error: "too large" }, 413);
      const body = parsed.value || {};
      const { value, error } = sanitizeBeacon(body, null);
      if (error) return json(request, { error }, 400);
      const id = newId();
      const ownerSecret = newOwnerSecret();
      value.ownerHash = await hashOwnerSecret(ownerSecret);
      value.createdAt = Date.now();
      await saveBeacon(env.BEACONS, id, value);
      await addBeaconId(env.BEACONS, id);
      return json(request, { id, ownerSecret, beacon: publicBeacon(value) }, 201);
    }

    const beaconPut = p.match(/^\/beacons\/([^/]+)$/);
    if (beaconPut && request.method === "PUT") {
      const id = beaconPut[1];
      const existing = await loadBeacon(env.BEACONS, id);
      if (!existing || !existing.ownerHash) {
        if (existing && !existing.ownerHash) {
          await deleteBeacon(env.BEACONS, id);
          await dropBeaconId(env.BEACONS, id);
        }
        return json(request, { error: "not found" }, 404);
      }
      if (!(await verifyBeaconOwner(request, existing))) {
        return json(request, { error: "auth" }, 401, noStore);
      }
      const parsed = await readJsonCapped(request);
      if (parsed.tooLarge) return json(request, { error: "too large" }, 413);
      const { value, error } = sanitizeBeacon(parsed.value || {}, existing);
      if (error) return json(request, { error }, 400);
      await saveBeacon(env.BEACONS, id, value);
      return json(request, { id });
    }

    if (beaconPut && request.method === "DELETE") {
      const id = beaconPut[1];
      const existing = await loadBeacon(env.BEACONS, id);
      if (!existing || !existing.ownerHash) {
        if (existing && !existing.ownerHash) {
          await deleteBeacon(env.BEACONS, id);
          await dropBeaconId(env.BEACONS, id);
        }
        return json(request, { error: "not found" }, 404);
      }
      if (!(await verifyBeaconOwner(request, existing))) {
        return json(request, { error: "auth" }, 401, noStore);
      }
      await deleteBeacon(env.BEACONS, id);
      await dropBeaconId(env.BEACONS, id);
      return json(request, { ok: true });
    }

    const notesMatch = p.match(/^\/beacons\/([^/]+)\/notes$/);
    if (notesMatch && request.method === "GET") {
      const b = await loadBeacon(env.BEACONS, notesMatch[1]);
      if (!b || !b.ownerHash) return json(request, { error: "not found" }, 404);
      if (!(await verifyBeaconOwner(request, b))) {
        return json(request, { error: "auth" }, 401, noStore);
      }
      return json(request, b.notes || {}, 200, noStore);
    }

    if (notesMatch && request.method === "POST") {
      const limited = await checkRate(env, request, "post-notes");
      if (limited) return rateResponse(request, limited.retryAfter);
      const b = await loadBeacon(env.BEACONS, notesMatch[1]);
      if (!b || !b.ownerHash) return json(request, { error: "not found" }, 404);
      const parsed = await readJsonCapped(request);
      if (parsed.tooLarge) return json(request, { error: "too large" }, 413);
      const body = parsed.value || {};
      const text = String((body && body.text) || "")
        .trim()
        .slice(0, MAX_NOTE);
      if (!text) return json(request, { error: "empty" }, 400);
      if (contentBlocked(text)) return json(request, { error: "blocked" }, 400);
      const nid = newId();
      if (!b.notes) b.notes = {};
      b.notes[nid] = {
        text,
        createdAt: Date.now(), /* L5: ignore client */
        fromLabel: String((body && body.fromLabel) || "A mom nearby").slice(0, 40)
      };
      b.notes = trimNotes(b.notes);
      await saveBeacon(env.BEACONS, notesMatch[1], b);
      return json(request, { id: nid }, 201);
    }

    if (p === "/hope" && request.method === "GET") {
      const hopePosts = await listHopeMap(env.HOPE);
      const out = {};
      for (const [id, post] of Object.entries(hopePosts)) {
        out[id] = {
          text: post.text,
          createdAt: post.createdAt,
          fromLabel: post.fromLabel || "A mom"
        };
      }
      return json(request, out);
    }

    if (p === "/hope" && request.method === "POST") {
      const limited = await checkRate(env, request, "post-hope");
      if (limited) return rateResponse(request, limited.retryAfter);
      const parsed = await readJsonCapped(request);
      if (parsed.tooLarge) return json(request, { error: "too large" }, 413);
      const body = parsed.value || {};
      const textBody = String((body && body.text) || "")
        .trim()
        .slice(0, MAX_HOPE);
      if (!textBody) return json(request, { error: "empty" }, 400);
      const fromLabel =
        String((body && body.fromLabel) || "A mom")
          .trim()
          .slice(0, 40) || "A mom";
      if (contentBlocked(textBody)) return json(request, { error: "blocked" }, 400);
      const id = newId();
      const post = { text: textBody, createdAt: Date.now(), fromLabel };
      await env.HOPE.put(`h:${id}`, JSON.stringify(post));
      const before = await getHopeIndex(env.HOPE);
      const after = await addHopeId(env.HOPE, id);
      /* delete keys pruned by index cap (best-effort) */
      const keep = new Set(after);
      for (const old of before) {
        if (!keep.has(old) && old !== id) {
          try {
            await env.HOPE.delete(`h:${old}`);
          } catch (_) {}
        }
      }
      if (after.length > MAX_HOPE_POSTS) {
        const trimmed = after.slice(after.length - MAX_HOPE_POSTS);
        const drop = after.slice(0, after.length - MAX_HOPE_POSTS);
        await setHopeIndex(env.HOPE, trimmed);
        for (const old of drop) {
          try {
            await env.HOPE.delete(`h:${old}`);
          } catch (_) {}
        }
      }
      return json(request, { id }, 201);
    }

    const hopeDel = p.match(/^\/hope\/([^/]+)$/);
    if (hopeDel && request.method === "DELETE") {
      const admin = verifyHopeAdmin(request, env);
      if (admin.reason === "unset") return json(request, { error: "admin unset" }, 503, noStore);
      if (!admin.ok) return json(request, { error: "auth" }, 401, noStore);
      const id = hopeDel[1];
      await deleteHopePost(env.HOPE, id);
      return json(request, { ok: true, id }, 200, noStore);
    }

    if (
      (p === "/hope" && request.method === "DELETE") ||
      (p === "/admin/hope/clear" && (request.method === "POST" || request.method === "DELETE"))
    ) {
      const admin = verifyHopeAdmin(request, env);
      if (admin.reason === "unset") return json(request, { error: "admin unset" }, 503, noStore);
      if (!admin.ok) return json(request, { error: "auth" }, 401, noStore);
      await clearAllHope(env.HOPE);
      return json(request, { ok: true, cleared: true }, 200, noStore);
    }


    /* ——— Center flags (moderated review queue) ——— */
    if (p === "/flags" && request.method === "POST") {
      const limited = await checkRate(env, request, "post-flags");
      if (limited) return rateResponse(request, limited.retryAfter);
      const parsed = await readJsonCapped(request);
      if (parsed.tooLarge) return json(request, { error: "too large" }, 413);
      const body = parsed.value || {};
      const centerId = sanitizeCenterId(body.centerId);
      if (!centerId) return json(request, { error: "centerId" }, 400);
      let reason = String((body && body.reason) || "").trim().slice(0, MAX_FLAG_REASON);
      if (reason && contentBlocked(reason)) return json(request, { error: "blocked" }, 400);
      const id = newId();
      const ipHash = await sha256HexTrunc(clientIp(request), 16);
      const row = {
        centerId,
        reason: reason || "",
        createdAt: Date.now(),
        ipHash
      };
      await env.HOPE.put(`flag:${id}`, JSON.stringify(row));
      const before = await getFlagIndex(env.HOPE);
      const after = await addFlagId(env.HOPE, id);
      const keep = new Set(after);
      for (const old of before) {
        if (!keep.has(old) && old !== id) {
          try {
            await env.HOPE.delete(`flag:${old}`);
          } catch (_) {}
        }
      }
      /* Queued for review — does NOT remove live listings automatically. */
      return json(request, { id, ok: true, queued: true }, 201);
    }

    if (p === "/flags" && request.method === "GET") {
      const admin = verifyHopeAdmin(request, env);
      if (admin.reason === "unset") return json(request, { error: "admin unset" }, 503, noStore);
      if (!admin.ok) return json(request, { error: "auth" }, 401, noStore);
      const flags = await listFlagsMap(env.HOPE);
      return json(request, { flags, count: flags.length }, 200, noStore);
    }

    /* ——— Accounts ——— */
    if (p === "/auth/signup" && request.method === "POST") {
      const limited = await checkRate(env, request, "signup");
      if (limited) return rateResponse(request, limited.retryAfter);
      const parsed = await readJsonCapped(request);
      if (parsed.tooLarge) return json(request, { error: "too large" }, 413, noStore);
      const body = parsed.value || {};
      const email = normEmail(body.email);
      const password = String(body.password || "");
      if (!validEmail(email)) return json(request, { error: "email" }, 400, noStore);
      if (!validPassword(password)) return json(request, { error: "password" }, 400, noStore);
      const existing = await loadUser(env.USERS, email);
      await sleep(200); /* M1: blunt timing leak */
      if (existing) return json(request, { error: "exists" }, 409, noStore);
      const { hash, salt } = await hashPassword(password);
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
      const token = await issueToken(env.USERS, email, u);
      return json(
        request,
        { token, user: publicUser(u), private: u.private },
        201,
        noStore
      );
    }

    if (p === "/auth/login" && request.method === "POST") {
      const limited = await checkRate(env, request, "login");
      if (limited) return rateResponse(request, limited.retryAfter);
      const parsed = await readJsonCapped(request);
      if (parsed.tooLarge) return json(request, { error: "too large" }, 413, noStore);
      const body = parsed.value || {};
      const email = normEmail(body.email);
      const password = String(body.password || "");
      const u = await loadUser(env.USERS, email);
      if (!u || !(await verifyPassword(password, u.passSalt, u.passHash))) {
        return json(request, { error: "credentials" }, 401, noStore);
      }
      const token = await issueToken(env.USERS, email, u);
      return json(
        request,
        { token, user: publicUser(u), private: u.private || emptyPrivate() },
        200,
        noStore
      );
    }

    if (p === "/auth/logout" && request.method === "POST") {
      const found = await findByToken(env.USERS, request);
      if (found) await revokeToken(env.USERS, found.email, found.user);
      return json(request, { ok: true }, 200, noStore);
    }

    if (p === "/auth/me" && request.method === "GET") {
      const found = await findByToken(env.USERS, request);
      if (!found) return json(request, { error: "auth" }, 401, noStore);
      return json(
        request,
        { user: publicUser(found.user), private: found.user.private || emptyPrivate() },
        200,
        noStore
      );
    }

    if (p === "/me/sync" && request.method === "GET") {
      const found = await findByToken(env.USERS, request);
      if (!found) return json(request, { error: "auth" }, 401, noStore);
      return json(
        request,
        { private: found.user.private || emptyPrivate() },
        200,
        noStore
      );
    }

    if (p === "/me/sync" && request.method === "PUT") {
      const found = await findByToken(env.USERS, request);
      if (!found) return json(request, { error: "auth" }, 401, noStore);
      const parsed = await readJsonCapped(request);
      if (parsed.tooLarge) return json(request, { error: "too large" }, 413, noStore);
      const body = parsed.value || {};
      const incoming = (body && body.private) || body || {};
      const sanitized = sanitizePrivateBlob(incoming);
      if (sanitized.error) return json(request, { error: sanitized.error }, 400, noStore);
      found.user.private = mergePrivate(found.user.private, sanitized.value);
      found.user.private.updatedAt = Date.now();
      const check = JSON.stringify(found.user.private);
      if (check.length > MAX_PRIVATE_BYTES) {
        return json(request, { error: "too large" }, 400, noStore);
      }
      await saveUser(env.USERS, found.email, found.user);
      return json(request, { private: found.user.private }, 200, noStore);
    }

    return json(request, { error: "not found" }, 404);
  }
};
