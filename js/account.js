/**
 * Simple mom accounts — email + password.
 * Private sync only (baby / contractions / reminders / ember meta).
 * Never writes private data to public /beacons.
 */
(function () {
  "use strict";

  var LS_TOKEN = "heart_account_token";
  var LS_EMAIL = "heart_account_email";
  var LS_NUDGE = "heart_account_nudge_at";
  var PASSWORD_MIN = 10;
  var PASSWORD_MAX = 72;

  function $(id) { return document.getElementById(id); }

  function restBase() {
    var c = window.HEART_FIREBASE;
    return (c && c.restBaseUrl) ? String(c.restBaseUrl).replace(/\/$/, "") : "";
  }

  function token() { return localStorage.getItem(LS_TOKEN) || ""; }
  function setToken(t) {
    if (t) localStorage.setItem(LS_TOKEN, t);
    else localStorage.removeItem(LS_TOKEN);
  }
  function email() { return localStorage.getItem(LS_EMAIL) || ""; }
  function setEmail(e) {
    if (e) localStorage.setItem(LS_EMAIL, e);
    else localStorage.removeItem(LS_EMAIL);
  }

  function setStatus(msg, isError) {
    var el = $("account-status");
    if (!el) return;
    el.textContent = msg || "";
    el.classList.toggle("is-error", !!isError);
  }
  function setSyncStatus(msg, isError) {
    var el = $("account-sync-status");
    if (!el) return;
    el.textContent = msg || "";
    el.classList.toggle("is-error", !!isError);
  }

  function authHeaders() {
    var h = { "Content-Type": "application/json" };
    var t = token();
    if (t) h.Authorization = "Bearer " + t;
    return h;
  }

  function collectPrivate() {
    var baby = null, contractions = null, reminders = null, ember = null;
    try {
      if (window.HeartMomTools && HeartMomTools.Baby) {
        baby = Object.assign({}, HeartMomTools.Baby.data(), { updatedAt: Date.now() });
      }
    } catch (e) {}
    try {
      if (window.HeartMomTools && HeartMomTools.Contractions) {
        contractions = Object.assign({}, HeartMomTools.Contractions.data(), { updatedAt: Date.now() });
      }
    } catch (e) {}
    try {
      if (window.HeartMomTools && HeartMomTools.Reminders) {
        reminders = Object.assign({}, HeartMomTools.Reminders.data(), { updatedAt: Date.now() });
      }
    } catch (e) {}
    try {
      var id = localStorage.getItem("heart_beacon_id") || "";
      var meta = JSON.parse(localStorage.getItem("heart_beacon_meta") || "null");
      if (id || meta) {
        ember = {
          id: id,
          state: (meta && meta.state) || "",
          expiresAt: (meta && meta.expiresAt) || 0,
          hours: (meta && meta.hours) || 0,
          updatedAt: Date.now()
        };
      }
    } catch (e) {}
    return { baby: baby, contractions: contractions, reminders: reminders, ember: ember, updatedAt: Date.now() };
  }

  function applyPrivate(priv) {
    if (!priv || typeof priv !== "object") return;
    try {
      if (priv.baby && window.HeartMomTools && HeartMomTools.Baby) {
        var cur = HeartMomTools.Baby.data();
        var merged = mergeByUpdated(cur, priv.baby);
        HeartMomTools.Baby.persist(merged);
        HeartMomTools.Baby.render();
      }
    } catch (e) {}
    try {
      if (priv.contractions && window.HeartMomTools && HeartMomTools.Contractions) {
        var c = HeartMomTools.Contractions.data();
        var cm = mergeByUpdated(c, priv.contractions);
        HeartMomTools.Contractions.persist(cm);
        HeartMomTools.Contractions.render();
      }
    } catch (e) {}
    try {
      if (priv.reminders && window.HeartMomTools && HeartMomTools.Reminders) {
        var r = HeartMomTools.Reminders.data();
        var rm = mergeByUpdated(r, priv.reminders);
        HeartMomTools.Reminders.persist(rm);
        HeartMomTools.Reminders.render();
      }
    } catch (e) {}
    try {
      if (priv.ember) {
        if (priv.ember.id) localStorage.setItem("heart_beacon_id", String(priv.ember.id));
        var meta = {
          state: priv.ember.state || "",
          expiresAt: Number(priv.ember.expiresAt) || 0,
          hours: Number(priv.ember.hours) || 0
        };
        localStorage.setItem("heart_beacon_meta", JSON.stringify(meta));
        if (window.HeartBeacon && HeartBeacon.onView) {
          /* refresh ember UI if visible */
        }
      }
    } catch (e) {}
  }

  function mergeByUpdated(local, cloud) {
    local = local || {};
    cloud = cloud || {};
    var lt = Number(local.updatedAt) || 0;
    var ct = Number(cloud.updatedAt) || 0;
    if (ct >= lt) return Object.assign({}, local, cloud);
    return Object.assign({}, cloud, local);
  }

  function passwordOk(pw) {
    return pw.length >= PASSWORD_MIN && pw.length <= PASSWORD_MAX;
  }

  function passwordRuleMessage() {
    return "Password must be 10 to 72 characters.";
  }

  function refreshUI() {
    var signed = !!token();
    var code = ($("account-reset-code") || {}).value || "";
    var recovering = !!String(code).trim();
    var guest = $("account-guest");
    var pane = $("account-signed");
    if (guest) guest.hidden = signed && !recovering;
    if (pane) pane.hidden = !signed;
    var em = $("account-email-display");
    if (em) em.textContent = email() || "Signed in";
    var nudge = $("ember-account-nudge");
    if (nudge) nudge.hidden = signed;
  }

  function signup() {
    var base = restBase();
    if (!base) return setStatus("Server offline — try again soon.", true);
    var em = ($("account-email") || {}).value || "";
    var pw = ($("account-password") || {}).value || "";
    if (!em || !passwordOk(pw)) return setStatus("Enter email and a password of 10 to 72 characters.", true);
    setStatus("Creating your account…");
    fetch(base + "/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: em.trim(), password: pw })
    })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || "signup"); return j; }); })
      .then(function (j) {
        setToken(j.token);
        setEmail((j.user && j.user.email) || em.trim());
        refreshUI();
        setStatus("Account created. Syncing your private data…");
        return pushPull();
      })
      .then(function () { setStatus("You’re set. Baby tracking will stay with your account."); })
      .catch(function (e) {
        var msg = (e && e.message) === "exists" ? "That email already has an account — try Sign in." :
          (e && e.message) === "password" ? passwordRuleMessage() :
          (e && e.message) === "email" ? "Please use a real email address." :
          "Could not create account. Try again.";
        setStatus(msg, true);
      });
  }

  function login() {
    var base = restBase();
    if (!base) return setStatus("Server offline — try again soon.", true);
    var em = ($("account-email") || {}).value || "";
    var pw = ($("account-password") || {}).value || "";
    if (!em || !pw) return setStatus("Enter email and password.", true);
    setStatus("Signing in…");
    fetch(base + "/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: em.trim(), password: pw })
    })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || "login"); return j; }); })
      .then(function (j) {
        setToken(j.token);
        setEmail((j.user && j.user.email) || em.trim());
        if (j.private) applyPrivate(j.private);
        refreshUI();
        setStatus("Signed in. Syncing…");
        return pushPull();
      })
      .then(function () { setStatus("Welcome back — your private data is ready."); })
      .catch(function () { setStatus("Email or password didn’t match.", true); });
  }

  function forgot() {
    var base = restBase();
    if (!base) return setStatus("Server offline — try again soon. Nothing was sent.", true);
    var em = (($("account-email") || {}).value || "").trim();
    if (!em || em.indexOf("@") === -1) return setStatus("Enter the email on the account. Nothing was sent.", true);
    setStatus("Requesting a password reset…");
    fetch(base + "/auth/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: em })
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, status: r.status, body: j || {} };
        }, function () {
          return { ok: r.ok, status: r.status, body: {} };
        });
      })
      .then(function (res) {
        if (res.ok && res.body && res.body.ok === true) {
          setStatus("If that email has an account, a reset message was sent. Check your inbox for the link or code.");
          return;
        }
        var err = res.body && res.body.error;
        if (res.status === 429 || err === "rate") {
          setStatus("Too many reset requests. Nothing was sent. Try again later.", true);
          return;
        }
        if (err === "email") {
          setStatus("Enter a valid email address. Nothing was sent.", true);
          return;
        }
        setStatus("Password reset email is not set up, or it could not be sent. Nothing was sent.", true);
      })
      .catch(function () {
        setStatus("Could not reach the server. Nothing was sent.", true);
      });
  }

  function resetPassword() {
    var base = restBase();
    if (!base) return setStatus("Server offline — try again soon.", true);
    var code = String((($("account-reset-code") || {}).value || "")).trim();
    var pw = ($("account-new-password") || {}).value || "";
    if (!code) return setStatus("Enter the reset code from the email.", true);
    if (!passwordOk(pw)) return setStatus(passwordRuleMessage(), true);
    setStatus("Updating password…");
    fetch(base + "/auth/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: code, password: pw })
    })
      .then(function (r) {
        return r.json().then(function (j) {
          if (!r.ok) throw new Error((j && j.error) || "reset");
          return j;
        });
      })
      .then(function (j) {
        setToken(j.token);
        setEmail((j.user && j.user.email) || "");
        if (j.private) applyPrivate(j.private);
        var codeEl = $("account-reset-code");
        var pwEl = $("account-new-password");
        var oldEl = $("account-password");
        if (codeEl) codeEl.value = "";
        if (pwEl) pwEl.value = "";
        if (oldEl) oldEl.value = "";
        refreshUI();
        setStatus("Password updated. You are signed in to the same account.");
        return pushPull();
      })
      .catch(function (e) {
        var msg = (e && e.message) === "password" ? passwordRuleMessage() :
          (e && e.message) === "token" ? "That reset code is invalid or expired." :
          (e && e.message) === "rate" ? "Too many reset attempts. Try again later." :
          "Could not update the password.";
        setStatus(msg, true);
      });
  }

  function takeResetFromUrl() {
    var token = "";
    try {
      var params = new URLSearchParams(window.location.search);
      token = params.get("reset") || "";
      if (token) {
        params.delete("reset");
        var qs = params.toString();
        var next = window.location.pathname + (qs ? "?" + qs : "") + (window.location.hash || "");
        history.replaceState(null, "", next);
      }
    } catch (e) {}
    token = String(token || "").trim();
    if (!token) return;
    var codeEl = $("account-reset-code");
    if (codeEl) codeEl.value = token;
    refreshUI();
    if ((window.location.hash || "") !== "#account") {
      window.location.hash = "#account";
    }
    var pwEl = $("account-new-password");
    if (pwEl && pwEl.focus) pwEl.focus();
  }

  function logout() {
    var base = restBase();
    var t = token();
    if (base && t) {
      fetch(base + "/auth/logout", { method: "POST", headers: authHeaders() }).catch(function () {});
    }
    setToken("");
    setEmail("");
    try { localStorage.removeItem("heart_beacon_secrets"); } catch (e) {}
    refreshUI();
    setStatus("Signed out. Guest mode still works on this phone.");
    setSyncStatus("");
  }

  function pushPull() {
    var base = restBase();
    if (!base || !token()) return Promise.reject(new Error("auth"));
    var local = collectPrivate();
    return fetch(base + "/me/sync", {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ private: local })
    })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || "sync"); return j; }); })
      .then(function (j) {
        if (j.private) applyPrivate(j.private);
        setSyncStatus("Synced · " + new Date().toLocaleTimeString());
        return j;
      });
  }

  function syncNow() {
    setSyncStatus("Syncing…");
    pushPull()
      .then(function () { setSyncStatus("All set · " + new Date().toLocaleTimeString()); })
      .catch(function () { setSyncStatus("Sync failed — check connection.", true); });
  }

  function maybeNudge() {
    if (token()) return;
    var last = Number(localStorage.getItem(LS_NUDGE) || 0);
    if (Date.now() - last < 36e5) return; // once/hour max
    try {
      var baby = window.HeartMomTools && HeartMomTools.Baby && HeartMomTools.Baby.data();
      if (baby && (baby.lastFedAt || baby.lastDiaperAt || (baby.diapersLeft != null && baby.diapersLeft < 40))) {
        localStorage.setItem(LS_NUDGE, String(Date.now()));
        var n = $("ember-account-nudge");
        if (n) n.hidden = false;
      }
    } catch (e) {}
  }

  function onView() {
    refreshUI();
    maybeNudge();
  }

  function bind() {
    var su = $("account-signup");
    var li = $("account-login");
    var lo = $("account-logout");
    var sy = $("account-sync-now");
    var fg = $("account-forgot");
    var rs = $("account-reset-submit");
    if (su) su.addEventListener("click", signup);
    if (li) li.addEventListener("click", login);
    if (lo) lo.addEventListener("click", logout);
    if (sy) sy.addEventListener("click", syncNow);
    if (fg) fg.addEventListener("click", forgot);
    if (rs) rs.addEventListener("click", resetPassword);
    takeResetFromUrl();
    window.addEventListener("hashchange", function () {
      if ((location.hash || "") === "#account") onView();
    });
    if ((location.hash || "") === "#account") onView();
    refreshUI();
    /* auto-sync shortly after load if signed in */
    if (token() && restBase()) {
      setTimeout(function () { pushPull().catch(function () {}); }, 2500);
    }
    /* after baby actions, nudge */
    setInterval(maybeNudge, 120000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();

  window.HeartAccount = {
    onView: onView,
    syncNow: syncNow,
    isSignedIn: function () { return !!token(); },
    collectPrivate: collectPrivate
  };
})();
