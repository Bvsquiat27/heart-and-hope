/**
 * Simple mom accounts — email + password.
 * Private sync only (baby / contractions / reminders / ember meta).
 * Never writes private data to public /beacons.
 */
(function () {
  "use strict";

  var LS_TOKEN = "hearth_account_token";
  var LS_EMAIL = "hearth_account_email";
  var LS_NUDGE = "hearth_account_nudge_at";

  function $(id) { return document.getElementById(id); }

  function restBase() {
    var c = window.HEARTH_FIREBASE;
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
      if (window.HearthMomTools && HearthMomTools.Baby) {
        baby = Object.assign({}, HearthMomTools.Baby.data(), { updatedAt: Date.now() });
      }
    } catch (e) {}
    try {
      if (window.HearthMomTools && HearthMomTools.Contractions) {
        contractions = Object.assign({}, HearthMomTools.Contractions.data(), { updatedAt: Date.now() });
      }
    } catch (e) {}
    try {
      if (window.HearthMomTools && HearthMomTools.Reminders) {
        reminders = Object.assign({}, HearthMomTools.Reminders.data(), { updatedAt: Date.now() });
      }
    } catch (e) {}
    try {
      var id = localStorage.getItem("hearth_beacon_id") || "";
      var meta = JSON.parse(localStorage.getItem("hearth_beacon_meta") || "null");
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
      if (priv.baby && window.HearthMomTools && HearthMomTools.Baby) {
        var cur = HearthMomTools.Baby.data();
        var merged = mergeByUpdated(cur, priv.baby);
        HearthMomTools.Baby.persist(merged);
        HearthMomTools.Baby.render();
      }
    } catch (e) {}
    try {
      if (priv.contractions && window.HearthMomTools && HearthMomTools.Contractions) {
        var c = HearthMomTools.Contractions.data();
        var cm = mergeByUpdated(c, priv.contractions);
        HearthMomTools.Contractions.persist(cm);
        HearthMomTools.Contractions.render();
      }
    } catch (e) {}
    try {
      if (priv.reminders && window.HearthMomTools && HearthMomTools.Reminders) {
        var r = HearthMomTools.Reminders.data();
        var rm = mergeByUpdated(r, priv.reminders);
        HearthMomTools.Reminders.persist(rm);
        HearthMomTools.Reminders.render();
      }
    } catch (e) {}
    try {
      if (priv.ember) {
        if (priv.ember.id) localStorage.setItem("hearth_beacon_id", String(priv.ember.id));
        var meta = {
          state: priv.ember.state || "",
          expiresAt: Number(priv.ember.expiresAt) || 0,
          hours: Number(priv.ember.hours) || 0
        };
        localStorage.setItem("hearth_beacon_meta", JSON.stringify(meta));
        if (window.HearthBeacon && HearthBeacon.onView) {
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

  function refreshUI() {
    var signed = !!token();
    var guest = $("account-guest");
    var pane = $("account-signed");
    if (guest) guest.hidden = signed;
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
    if (!em || pw.length < 6) return setStatus("Enter email and a password of at least 6 characters.", true);
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
          (e && e.message) === "password" ? "Password must be at least 6 characters." :
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

  function logout() {
    var base = restBase();
    var t = token();
    if (base && t) {
      fetch(base + "/auth/logout", { method: "POST", headers: authHeaders() }).catch(function () {});
    }
    setToken("");
    setEmail("");
    try { localStorage.removeItem("hearth_beacon_secrets"); } catch (e) {}
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
      var baby = window.HearthMomTools && HearthMomTools.Baby && HearthMomTools.Baby.data();
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
    if (su) su.addEventListener("click", signup);
    if (li) li.addEventListener("click", login);
    if (lo) lo.addEventListener("click", logout);
    if (sy) sy.addEventListener("click", syncNow);
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

  window.HearthAccount = {
    onView: onView,
    syncNow: syncNow,
    isSignedIn: function () { return !!token(); },
    collectPrivate: collectPrivate
  };
})();
