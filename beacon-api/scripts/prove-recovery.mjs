/**
 * Local proof for password recovery and the 10–72 character rule.
 * Does not call the live Worker and does not print reset secrets.
 *
 * Express is proven against a local HTTP mail sink.
 * The Worker module is loaded in-process with a memory KV and either
 * an email binding or the same kind of sink.
 */
import http from "http";
import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO = path.resolve(ROOT, "..");
const OLD_PW = "correcthorse";
const NEW_PW = "correcthorse2";
const results = [];

function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail: detail || "" });
  console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : ""));
}

function scrubEnv(extra) {
  const env = Object.assign({}, process.env, extra || {});
  for (const key of [
    "RESEND_API_KEY",
    "SENDGRID_API_KEY",
    "MAILGUN_API_KEY",
    "MAILGUN_DOMAIN",
    "MAIL_FROM",
    "MAIL_SINK_URL",
    "EMAIL"
  ]) {
    if (!extra || !Object.prototype.hasOwnProperty.call(extra, key)) delete env[key];
  }
  return env;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const s = http.createServer();
    s.listen(0, "127.0.0.1", () => {
      const port = s.address().port;
      s.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function startSink() {
  const messages = [];
  const server = http.createServer(async (req, res) => {
    const raw = await readBody(req);
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
    messages.push(parsed || { unparsed: true, bytes: raw.length });
    res.writeHead(204);
    res.end();
  });
  const port = await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
  return {
    messages,
    url: "http://127.0.0.1:" + port + "/sink",
    close: () => new Promise((resolve) => server.close(() => resolve()))
  };
}

async function api(base, pathname, opts) {
  const res = await fetch(base + pathname, {
    method: (opts && opts.method) || "GET",
    headers: Object.assign(
      { "Content-Type": "application/json", Origin: "http://localhost:3000" },
      (opts && opts.headers) || {}
    ),
    body: opts && opts.body ? JSON.stringify(opts.body) : undefined
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  return { status: res.status, body, text };
}

function waitHealth(base, child) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = async () => {
      if (child.exitCode != null) {
        reject(new Error("server exited " + child.exitCode));
        return;
      }
      try {
        const res = await fetch(base + "/health");
        if (res.ok) {
          resolve();
          return;
        }
      } catch {
        /* retry */
      }
      if (Date.now() - start > 8000) {
        reject(new Error("health timeout"));
        return;
      }
      setTimeout(tick, 80);
    };
    tick();
  });
}

function startExpress(port, extraEnv) {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), "heart-recover-"));
  const child = spawn(process.execPath, ["server.js"], {
    cwd: ROOT,
    env: scrubEnv(
      Object.assign(
        {
          PORT: String(port),
          DATA_DIR: data,
          DATA_FILE: path.join(data, "beacons.json"),
          HOPE_FILE: path.join(data, "hope.json"),
          USERS_FILE: path.join(data, "users.json"),
          TOKENS_FILE: path.join(data, "tokens.json"),
          RESETS_FILE: path.join(data, "resets.json"),
          FLAGS_FILE: path.join(data, "flags.json")
        },
        extraEnv || {}
      )
    ),
    stdio: ["ignore", "pipe", "pipe"]
  });
  let log = "";
  child.stdout.on("data", (b) => {
    log += b.toString();
  });
  child.stderr.on("data", (b) => {
    log += b.toString();
  });
  child.log = () => log;
  child.dataDir = data;
  return child;
}

function stopChild(child) {
  return new Promise((resolve) => {
    if (!child || child.exitCode != null) return resolve();
    child.once("exit", () => resolve());
    child.kill("SIGTERM");
    setTimeout(() => {
      if (child.exitCode == null) child.kill("SIGKILL");
    }, 1500);
  });
}

function secretsFromMail(text) {
  const raw = String(text || "");
  const link = raw.match(/[?&]reset=([^&\s#]+)/);
  const fromLink = link ? decodeURIComponent(link[1]) : "";
  const lines = raw.split(/\n/);
  const idx = lines.findIndex((line) => line.indexOf("paste this code") !== -1);
  const fromLine = idx >= 0 ? String(lines[idx + 1] || "").trim() : "";
  return { fromLink, fromLine };
}

function leaked(text, secret) {
  if (!secret) return false;
  return String(text || "").indexOf(secret) !== -1;
}

async function proveExpressUnconfigured() {
  const port = await freePort();
  const child = startExpress(port, {});
  const base = "http://127.0.0.1:" + port;
  try {
    await waitHealth(base, child);
    const health = await api(base, "/health");
    check("express.unconfigured.version", health.body && health.body.version === "1.7.8", String(health.body && health.body.version));
    const email = "unconfigured-proof@example.com";
    const created = await api(base, "/auth/signup", {
      method: "POST",
      body: { email, password: OLD_PW }
    });
    check("express.unconfigured.signup", created.status === 201, String(created.status));
    const forgot = await api(base, "/auth/forgot", { method: "POST", body: { email } });
    check("express.unconfigured.forgot.status", forgot.status === 503, String(forgot.status));
    check(
      "express.unconfigured.forgot.body",
      forgot.body && forgot.body.error === "unavailable" && forgot.body.ok !== true,
      JSON.stringify(forgot.body)
    );
    check("express.unconfigured.response.has_no_token_field", forgot.text.indexOf("token") === -1, "");
    const unknown = await api(base, "/auth/forgot", {
      method: "POST",
      body: { email: "nobody-unconfigured@example.com" }
    });
    check(
      "express.unconfigured.unknown.same_status",
      unknown.status === forgot.status && unknown.text === forgot.text,
      unknown.status + " " + unknown.text
    );
  } catch (err) {
    check("express.unconfigured.run", false, err.message);
    console.error(child.log());
  } finally {
    await stopChild(child);
  }
}

async function proveExpressSink(sink) {
  const port = await freePort();
  const before = sink.messages.length;
  const child = startExpress(port, {
    MAIL_SINK_URL: sink.url,
    MAIL_FROM: "Heart and Hope <noreply@example.com>",
    APP_PUBLIC_URL: "https://bvsquiat27.github.io/heart-and-hope"
  });
  const base = "http://127.0.0.1:" + port;
  try {
    await waitHealth(base, child);
    const root = await api(base, "/");
    const endpoints = (root.body && root.body.endpoints) || [];
    check("express.root.lists_forgot", endpoints.indexOf("/auth/forgot") !== -1, "");
    check("express.root.lists_reset", endpoints.indexOf("/auth/reset") !== -1, "");

    const short = await api(base, "/auth/signup", {
      method: "POST",
      body: { email: "short-proof@example.com", password: "shortpw" }
    });
    check("express.signup.6", short.status === 400 && short.body && short.body.error === "password", JSON.stringify(short.body));
    const nine = await api(base, "/auth/signup", {
      method: "POST",
      body: { email: "nine-proof@example.com", password: "ninechars" }
    });
    check("express.signup.9", nine.status === 400 && nine.body && nine.body.error === "password", JSON.stringify(nine.body));
    const huge = await api(base, "/auth/signup", {
      method: "POST",
      body: { email: "huge-proof@example.com", password: "x".repeat(73) }
    });
    check("express.signup.73", huge.status === 400 && huge.body && huge.body.error === "password", String(huge.status));

    const email = "Proof.User@Example.com";
    const created = await api(base, "/auth/signup", {
      method: "POST",
      body: { email, password: OLD_PW }
    });
    check("express.signup.10plus", created.status === 201 && created.body && created.body.token, String(created.status));
    const userId = created.body && created.body.user && created.body.user.id;
    const session = created.body && created.body.token;
    const synced = await api(base, "/me/sync", {
      method: "PUT",
      headers: { Authorization: "Bearer " + session },
      body: { private: { baby: { note: "kept-through-reset", updatedAt: 111 }, updatedAt: 111 } }
    });
    check("express.sync.put", synced.status === 200 && synced.body && synced.body.private && synced.body.private.baby && synced.body.private.baby.note === "kept-through-reset", String(synced.status));

    const loggedOut = await api(base, "/auth/logout", {
      method: "POST",
      headers: { Authorization: "Bearer " + session }
    });
    check("express.logout", loggedOut.status === 200 && loggedOut.body && loggedOut.body.ok === true, String(loggedOut.status));
    const meAfter = await api(base, "/auth/me", { headers: { Authorization: "Bearer " + session } });
    check("express.logout.revokes", meAfter.status === 401, String(meAfter.status));

    const wrong = await api(base, "/auth/login", {
      method: "POST",
      body: { email, password: "not-the-password" }
    });
    check("express.login.wrong", wrong.status === 401, String(wrong.status));
    const oldLogin = await api(base, "/auth/login", {
      method: "POST",
      body: { email: email.toLowerCase(), password: OLD_PW }
    });
    check("express.login.old_before_reset", oldLogin.status === 200, String(oldLogin.status));

    const forgotKnown = await api(base, "/auth/forgot", { method: "POST", body: { email } });
    const forgotUnknown = await api(base, "/auth/forgot", {
      method: "POST",
      body: { email: "missing-proof@example.com" }
    });
    check("express.forgot.known.status", forgotKnown.status === 200, String(forgotKnown.status));
    check("express.forgot.unknown.same_body", forgotUnknown.status === 200 && forgotUnknown.text === forgotKnown.text, forgotUnknown.text);
    check("express.forgot.body_is_ok_only", forgotKnown.text === '{"ok":true}', forgotKnown.text);

    const mine = sink.messages.slice(before);
    check("express.sink.count", mine.length === 1, String(mine.length));
    const mail = mine[0] || {};
    check("express.sink.to", String(mail.to || "").toLowerCase() === email.toLowerCase(), "");
    check("express.sink.subject", mail.subject === "Reset your Heart and Hope password", String(mail.subject || ""));
    const secrets = secretsFromMail(mail.text);
    check("express.sink.link_and_code_match", !!secrets.fromLink && secrets.fromLink === secrets.fromLine, "len=" + secrets.fromLink.length);
    check("express.forgot.response_omits_secret", !leaked(forgotKnown.text, secrets.fromLink) && !leaked(forgotUnknown.text, secrets.fromLink), "");
    const usersRaw = fs.readFileSync(path.join(child.dataDir, "users.json"), "utf8");
    check("express.store_omits_plaintext_secret", !leaked(usersRaw, secrets.fromLink), "");
    check("express.store_has_reset_hash", usersRaw.indexOf("resetHash") !== -1, "");

    const weakReset = await api(base, "/auth/reset", {
      method: "POST",
      body: { token: secrets.fromLink, password: "shortpw" }
    });
    check("express.reset.rejects_6", weakReset.status === 400 && weakReset.body && weakReset.body.error === "password", JSON.stringify(weakReset.body));
    check("express.reset.weak_response_omits_secret", !leaked(weakReset.text, secrets.fromLink), "");
    const stillOld = await api(base, "/auth/login", {
      method: "POST",
      body: { email, password: OLD_PW }
    });
    check("express.login.old_still_works_after_weak_reset", stillOld.status === 200, String(stillOld.status));

    const reset = await api(base, "/auth/reset", {
      method: "POST",
      body: { token: secrets.fromLink, password: NEW_PW }
    });
    check("express.reset.status", reset.status === 200 && reset.body && reset.body.token, String(reset.status));
    check("express.reset.response_omits_secret", !leaked(reset.text, secrets.fromLink), "");
    check("express.reset.same_user", reset.body && reset.body.user && reset.body.user.id === userId, "");
    check(
      "express.reset.keeps_private",
      reset.body && reset.body.private && reset.body.private.baby && reset.body.private.baby.note === "kept-through-reset",
      ""
    );
    const me = await api(base, "/auth/me", {
      headers: { Authorization: "Bearer " + (reset.body && reset.body.token) }
    });
    check("express.reset.session_works", me.status === 200 && me.body && me.body.user && me.body.user.email === email.toLowerCase(), String(me.status));

    const oldAfter = await api(base, "/auth/login", {
      method: "POST",
      body: { email, password: OLD_PW }
    });
    const neu = await api(base, "/auth/login", {
      method: "POST",
      body: { email, password: NEW_PW }
    });
    check("express.login.old_after_reset", oldAfter.status === 401, String(oldAfter.status));
    check("express.login.new_after_reset", neu.status === 200 && neu.body && neu.body.user && neu.body.user.id === userId, String(neu.status));
    check(
      "express.login.new_private",
      neu.body && neu.body.private && neu.body.private.baby && neu.body.private.baby.note === "kept-through-reset",
      ""
    );
    const reuse = await api(base, "/auth/reset", {
      method: "POST",
      body: { token: secrets.fromLink, password: "anothergood1" }
    });
    check("express.reset.reuse_rejected", reuse.status === 400 && reuse.body && reuse.body.error === "token", JSON.stringify(reuse.body));
    const usersAfter = fs.readFileSync(path.join(child.dataDir, "users.json"), "utf8");
    check("express.store_drops_secret_after_reset", !leaked(usersAfter, secrets.fromLink), "");
  } catch (err) {
    check("express.sink.run", false, err.message);
    console.error(child.log());
  } finally {
    await stopChild(child);
  }
}

function memoryKv() {
  const map = new Map();
  return {
    map,
    async get(key, type) {
      if (!map.has(key)) return null;
      const value = map.get(key);
      if (type === "json") {
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      }
      return value;
    },
    async put(key, value) {
      map.set(key, String(value));
    },
    async delete(key) {
      map.delete(key);
    }
  };
}

async function callWorker(worker, env, pathname, opts) {
  const headers = Object.assign(
    { Origin: "http://localhost:3000", "Content-Type": "application/json" },
    (opts && opts.headers) || {}
  );
  const res = await worker.fetch(
    new Request("https://worker.test" + pathname, {
      method: (opts && opts.method) || "GET",
      headers,
      body: opts && opts.body ? JSON.stringify(opts.body) : undefined
    }),
    env
  );
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  return { status: res.status, body, text };
}

async function proveWorker(worker, sink) {
  const bare = {
    BEACONS: memoryKv(),
    HOPE: memoryKv(),
    USERS: memoryKv()
  };
  const health = await callWorker(worker, bare, "/health");
  check("worker.version", health.body && health.body.version === "1.7.8", String(health.body && health.body.version));
  const email = "worker-proof@example.com";
  const created = await callWorker(worker, bare, "/auth/signup", {
    method: "POST",
    body: { email, password: OLD_PW }
  });
  check("worker.unconfigured.signup", created.status === 201, String(created.status));
  const forgot = await callWorker(worker, bare, "/auth/forgot", {
    method: "POST",
    body: { email }
  });
  check("worker.unconfigured.forgot", forgot.status === 503 && forgot.body && forgot.body.error === "unavailable", forgot.text);
  const rstKeys = [...bare.USERS.map.keys()].filter((k) => k.startsWith("rst:"));
  check("worker.unconfigured.no_reset_row", rstKeys.length === 0, String(rstKeys.length));

  const failedMail = [];
  const failEnv = {
    BEACONS: memoryKv(),
    HOPE: memoryKv(),
    USERS: memoryKv(),
    MAIL_FROM: "Heart and Hope <noreply@example.com>",
    EMAIL: {
      async send(msg) {
        failedMail.push(msg);
        throw new Error("provider rejected");
      }
    }
  };
  const failUser = await callWorker(worker, failEnv, "/auth/signup", {
    method: "POST",
    body: { email: "fail-send@example.com", password: OLD_PW }
  });
  check("worker.fail_send.signup", failUser.status === 201, String(failUser.status));
  const failForgot = await callWorker(worker, failEnv, "/auth/forgot", {
    method: "POST",
    body: { email: "fail-send@example.com" }
  });
  check("worker.fail_send.status", failForgot.status === 503 && failForgot.body && failForgot.body.error === "unavailable", failForgot.text);
  check("worker.fail_send.invoked_sender", failedMail.length === 1, String(failedMail.length));
  const failedSecret = secretsFromMail(failedMail[0] && failedMail[0].text);
  check("worker.fail_send.response_omits_secret", !leaked(failForgot.text, failedSecret.fromLink), "");
  const failReset = await callWorker(worker, failEnv, "/auth/reset", {
    method: "POST",
    body: { token: failedSecret.fromLink, password: NEW_PW }
  });
  check("worker.fail_send.secret_not_usable", failReset.status === 400 && failReset.body && failReset.body.error === "token", String(failReset.status));

  const sent = [];
  const env = {
    BEACONS: memoryKv(),
    HOPE: memoryKv(),
    USERS: memoryKv(),
    MAIL_FROM: "Heart and Hope <noreply@example.com>",
    APP_PUBLIC_URL: "https://bvsquiat27.github.io/heart-and-hope",
    EMAIL: {
      async send(msg) {
        sent.push(msg);
      }
    }
  };
  const short = await callWorker(worker, env, "/auth/signup", {
    method: "POST",
    body: { email: "wshort@example.com", password: "shortpw" }
  });
  check("worker.signup.6", short.status === 400 && short.body && short.body.error === "password", JSON.stringify(short.body));
  const nine = await callWorker(worker, env, "/auth/signup", {
    method: "POST",
    body: { email: "wnine@example.com", password: "ninechars" }
  });
  check("worker.signup.9", nine.status === 400 && nine.body && nine.body.error === "password", String(nine.status));
  const accountEmail = "Worker.User@Example.com";
  const account = await callWorker(worker, env, "/auth/signup", {
    method: "POST",
    body: { email: accountEmail, password: OLD_PW }
  });
  check("worker.signup.10plus", account.status === 201, String(account.status));
  const userId = account.body && account.body.user && account.body.user.id;
  const session = account.body && account.body.token;
  const synced = await callWorker(worker, env, "/me/sync", {
    method: "PUT",
    headers: { Authorization: "Bearer " + session },
    body: { private: { baby: { note: "worker-kept", updatedAt: 222 }, updatedAt: 222 } }
  });
  check("worker.sync.put", synced.status === 200, String(synced.status));
  const loggedOut = await callWorker(worker, env, "/auth/logout", {
    method: "POST",
    headers: { Authorization: "Bearer " + session }
  });
  check("worker.logout", loggedOut.status === 200, String(loggedOut.status));
  const revoked = await callWorker(worker, env, "/auth/me", {
    headers: { Authorization: "Bearer " + session }
  });
  check("worker.logout.revokes", revoked.status === 401, String(revoked.status));

  const known = await callWorker(worker, env, "/auth/forgot", {
    method: "POST",
    body: { email: accountEmail }
  });
  const unknown = await callWorker(worker, env, "/auth/forgot", {
    method: "POST",
    body: { email: "missing-worker@example.com" }
  });
  check("worker.forgot.known", known.status === 200 && known.text === '{"ok":true}', known.text);
  check("worker.forgot.unknown_same", unknown.status === 200 && unknown.text === known.text, unknown.text);
  check("worker.email_binding.count", sent.length === 1, String(sent.length));
  const secret = secretsFromMail(sent[0] && sent[0].text);
  check("worker.email_binding.link_and_code", !!secret.fromLink && secret.fromLink === secret.fromLine, "len=" + secret.fromLink.length);
  check("worker.forgot.response_omits_secret", !leaked(known.text, secret.fromLink), "");
  const stored = [...env.USERS.map.values()].join("\n");
  check("worker.store_omits_plaintext_secret", !leaked(stored, secret.fromLink), "");

  const reset = await callWorker(worker, env, "/auth/reset", {
    method: "POST",
    body: { token: secret.fromLink, password: NEW_PW }
  });
  check("worker.reset.status", reset.status === 200, String(reset.status));
  check("worker.reset.response_omits_secret", !leaked(reset.text, secret.fromLink), "");
  check("worker.reset.same_user", reset.body && reset.body.user && reset.body.user.id === userId, "");
  check(
    "worker.reset.keeps_private",
    reset.body && reset.body.private && reset.body.private.baby && reset.body.private.baby.note === "worker-kept",
    ""
  );
  const oldAfter = await callWorker(worker, env, "/auth/login", {
    method: "POST",
    body: { email: accountEmail, password: OLD_PW }
  });
  const neu = await callWorker(worker, env, "/auth/login", {
    method: "POST",
    body: { email: accountEmail, password: NEW_PW }
  });
  check("worker.login.old_after_reset", oldAfter.status === 401, String(oldAfter.status));
  check("worker.login.new_after_reset", neu.status === 200 && neu.body && neu.body.user && neu.body.user.id === userId, String(neu.status));
  const reuse = await callWorker(worker, env, "/auth/reset", {
    method: "POST",
    body: { token: secret.fromLink, password: "anothergood1" }
  });
  check("worker.reset.reuse_rejected", reuse.status === 400, String(reuse.status));

  const sinkBefore = sink.messages.length;
  const sinkEnv = {
    BEACONS: memoryKv(),
    HOPE: memoryKv(),
    USERS: memoryKv(),
    MAIL_SINK_URL: sink.url,
    APP_PUBLIC_URL: "https://bvsquiat27.github.io/heart-and-hope"
  };
  const sinkUser = await callWorker(worker, sinkEnv, "/auth/signup", {
    method: "POST",
    body: { email: "sink-worker@example.com", password: OLD_PW }
  });
  check("worker.sink.signup", sinkUser.status === 201, String(sinkUser.status));
  const sinkForgot = await callWorker(worker, sinkEnv, "/auth/forgot", {
    method: "POST",
    body: { email: "sink-worker@example.com" }
  });
  check("worker.sink.forgot", sinkForgot.status === 200 && sinkForgot.text === '{"ok":true}', sinkForgot.text);
  const delivered = sink.messages.slice(sinkBefore);
  check("worker.sink.delivered", delivered.length === 1, String(delivered.length));
  const sinkSecret = secretsFromMail(delivered[0] && delivered[0].text);
  check("worker.sink.response_omits_secret", !leaked(sinkForgot.text, sinkSecret.fromLink), "");
  const sinkReset = await callWorker(worker, sinkEnv, "/auth/reset", {
    method: "POST",
    body: { code: sinkSecret.fromLine, password: NEW_PW }
  });
  check("worker.sink.reset_with_code", sinkReset.status === 200, String(sinkReset.status));
  const sinkOld = await callWorker(worker, sinkEnv, "/auth/login", {
    method: "POST",
    body: { email: "sink-worker@example.com", password: OLD_PW }
  });
  const sinkNew = await callWorker(worker, sinkEnv, "/auth/login", {
    method: "POST",
    body: { email: "sink-worker@example.com", password: NEW_PW }
  });
  check("worker.sink.old_password", sinkOld.status === 401, String(sinkOld.status));
  check("worker.sink.new_password", sinkNew.status === 200, String(sinkNew.status));
}

function proveCopy() {
  const index = fs.readFileSync(path.join(REPO, "index.html"), "utf8");
  const account = fs.readFileSync(path.join(REPO, "js", "account.js"), "utf8");
  const androidIndex = fs.readFileSync(path.join(REPO, "android-wrapper/src/main/assets/index.html"), "utf8");
  const androidAccount = fs.readFileSync(path.join(REPO, "android-wrapper/src/main/assets/js/account.js"), "utf8");
  const config = fs.readFileSync(path.join(REPO, "js/firebase-beacon-config.js"), "utf8");
  check("copy.password_rule", index.indexOf("10 to 72 characters") !== -1 && index.indexOf("at least 6") === -1, "");
  check("copy.forgot_control", index.indexOf('id="account-forgot"') !== -1 && index.indexOf(">Forgot password<") !== -1, "");
  check("copy.account_js_rule", account.indexOf("10 to 72 characters") !== -1 && account.indexOf("at least 6") === -1, "");
  check("copy.account_js_forgot", account.indexOf("/auth/forgot") !== -1 && account.indexOf("/auth/reset") !== -1, "");
  check("copy.no_sent_claim_on_failure_path", account.indexOf("Nothing was sent.") !== -1, "");
  check("copy.android_matches", index.indexOf('id="account-forgot"') !== -1 && androidIndex.indexOf('id="account-forgot"') !== -1 && androidAccount === account, "");
  check("copy.footer_mary", index.indexOf("Dedicated to the Mother Mary") !== -1, "");
  check("copy.name", index.indexOf("Heart and Hope") !== -1, "");
  check("copy.api_host", config.indexOf("hearth-ember-api.hearthandhope.workers.dev") !== -1, "");
}

async function main() {
  proveCopy();
  const sink = await startSink();
  try {
    await proveExpressUnconfigured();
    await proveExpressSink(sink);
    const tmp = path.join(os.tmpdir(), "heart-worker-proof-" + process.pid + ".mjs");
    fs.copyFileSync(path.join(ROOT, "worker.js"), tmp);
    const mod = await import(pathToFileURL(tmp).href);
    await proveWorker(mod.default, sink);
  } finally {
    await sink.close();
  }
  const failed = results.filter((r) => !r.ok);
  console.log("PASS=" + (results.length - failed.length) + " FAIL=" + failed.length);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
