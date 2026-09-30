/**
 * Mom tools: contraction timer, baby tracker, reminders, gentle sounds.
 * Personal data stays in localStorage — never on public beacon RTDB.
 */
(function () {
  "use strict";

  var LS_CONTRACTIONS = "heart_contractions_v1";
  var LS_BABY = "heart_baby_v1";
  var LS_REMINDERS = "heart_reminders_v1";
  var LS_MUTE = "heart_sounds_mute";

  function $(id) { return document.getElementById(id); }
  function load(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || "null") || fallback; } catch (e) { return fallback; }
  }
  function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

  /* ---------- Gentle sounds ---------- */
  var Sounds = {
    muted: localStorage.getItem(LS_MUTE) === "1",
    play: function (name) {
      if (Sounds.muted) return;
      var map = {
        chime: "audio/chime.ogg",
        lullaby: "audio/lullaby.ogg",
        ping: "audio/ping.ogg"
      };
      var src = map[name] || map.ping;
      try {
        var a = new Audio(src);
        a.volume = 0.55;
        a.play().catch(function () {});
      } catch (e) {}
    },
    setMuted: function (m) {
      Sounds.muted = !!m;
      localStorage.setItem(LS_MUTE, m ? "1" : "0");
      var t = $("sound-mute-toggle");
      if (t) t.checked = Sounds.muted;
    }
  };
  window.HeartSounds = Sounds;

  /* ---------- Contraction timer ---------- */
  var Contractions = {
    activeStart: null,
    tickTimer: null,
    data: function () { return load(LS_CONTRACTIONS, { log: [] }); },
    persist: function (d) { save(LS_CONTRACTIONS, d); },
    fmtDur: function (ms) {
      var s = Math.max(0, Math.round(ms / 1000));
      var m = Math.floor(s / 60);
      var r = s % 60;
      return m + ":" + (r < 10 ? "0" : "") + r;
    },
    fmtTime: function (ts) {
      try { return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); } catch (e) { return ""; }
    },
    render: function () {
      var d = Contractions.data();
      var list = $("contraction-list");
      var live = $("contraction-live");
      var guidance = $("contraction-guidance");
      var status = $("contraction-status");
      var toggle = $("contraction-toggle");
      var label = $("contraction-toggle-label");
      var sub = $("contraction-toggle-sub");
      var active = !!Contractions.activeStart;

      if (live) {
        if (active) {
          live.textContent = Contractions.fmtDur(Date.now() - Contractions.activeStart);
          live.hidden = false;
        } else {
          live.hidden = true;
        }
      }
      if (status) status.textContent = active ? "Contraction started" : "Ready";
      if (toggle) {
        toggle.classList.toggle("is-active", active);
        toggle.setAttribute("aria-pressed", active ? "true" : "false");
        toggle.setAttribute("aria-label", active ? "Stop contraction" : "Start contraction");
      }
      if (label) label.textContent = active ? "Stop" : "Start";
      if (sub) sub.textContent = active ? "Tap when it ends" : "Tap when it begins";

      /* Summary stats */
      var summary = $("contraction-summary");
      var recent = d.log.slice(-12);
      if (summary) {
        if (!recent.length) {
          summary.hidden = true;
        } else {
          summary.hidden = false;
          var avgDur = recent.reduce(function (a, c) { return a + (c.durationMs || 0); }, 0) / recent.length;
          var freqs = recent.map(function (c) { return c.intervalMs; }).filter(function (x) { return x != null && x > 0; });
          var avgFreq = freqs.length ? freqs.reduce(function (a, b) { return a + b; }, 0) / freqs.length : null;
          var elDur = $("cx-avg-dur");
          var elCount = $("cx-count");
          var elFreq = $("cx-avg-freq");
          if (elDur) elDur.textContent = Contractions.fmtDur(avgDur);
          if (elCount) elCount.textContent = String(d.log.length);
          if (elFreq) elFreq.textContent = avgFreq != null ? Contractions.fmtDur(avgFreq) : "—";
        }
      }

      if (list) {
        if (!d.log.length) {
          list.innerHTML = "<p class=\"hint cx-empty\">No contractions yet — tap Start when one begins.</p>";
        } else {
          var chrono = d.log.slice();
          var newestFirst = chrono.slice().reverse().slice(0, 40);
          var total = chrono.length;
          var html = '<ol class="cx-tl">';
          newestFirst.forEach(function (c, i) {
            var num = total - i;
            var interval = c.intervalMs != null ? Contractions.fmtDur(c.intervalMs) : null;
            var durSec = Math.max(1, Math.round((c.durationMs || 0) / 1000));
            var bar = Math.min(100, Math.round((durSec / 90) * 100));
            html += '<li class="cx-tl-item">' +
              '<div class="cx-tl-rail" aria-hidden="true"><span class="cx-tl-dot">' + num + '</span>' +
              (i < newestFirst.length - 1 ? '<span class="cx-tl-line"></span>' : '') +
              '</div>' +
              '<div class="cx-tl-card">' +
              '<div class="cx-tl-top"><strong>' + Contractions.fmtTime(c.start) + '</strong>' +
              '<span class="cx-tl-len">' + Contractions.fmtDur(c.durationMs) + '</span></div>' +
              '<div class="cx-tl-bar"><span style="width:' + bar + '%"></span></div>' +
              (interval ? '<p class="cx-tl-gap">' + interval + ' apart</p>' : '<p class="cx-tl-gap">First in log</p>') +
              '</div></li>';
          });
          html += '</ol>';
          list.innerHTML = html;
        }
      }

      /* Soft pattern hint — not medical advice */
      if (guidance) {
        var recent2 = d.log.filter(function (c) { return Date.now() - c.start < 2 * 3600 * 1000; });
        if (recent2.length >= 3) {
          var intervals = recent2.map(function (c) { return c.intervalMs; }).filter(Boolean);
          var avg = intervals.length ? intervals.reduce(function (a, b) { return a + b; }, 0) / intervals.length : null;
          if (avg && avg <= 6 * 60 * 1000) {
            guidance.textContent = "These look closer together. Not medical advice — check with your care team if you’re unsure. Danger: 911.";
          } else {
            guidance.textContent = "Keep tracking. Share this timeline if you call your care team. Not medical advice.";
          }
        } else {
          guidance.textContent = "Care teams often ask how long and how far apart. This app is not medical advice.";
        }
      }
    },
    toggle: function () {
      if (Contractions.activeStart) Contractions.stop();
      else Contractions.start();
    },
    start: function () {
      if (Contractions.activeStart) return;
      Contractions.activeStart = Date.now();
      Sounds.play("chime");
      Contractions.tickTimer = setInterval(Contractions.render, 250);
      Contractions.render();
    },
    stop: function () {
      if (!Contractions.activeStart) return;
      var start = Contractions.activeStart;
      var end = Date.now();
      var d = Contractions.data();
      var last = d.log.length ? d.log[d.log.length - 1] : null;
      var intervalMs = last ? start - last.start : null;
      d.log.push({ start: start, end: end, durationMs: end - start, intervalMs: intervalMs });
      if (d.log.length > 100) d.log = d.log.slice(-100);
      Contractions.persist(d);
      Contractions.activeStart = null;
      if (Contractions.tickTimer) { clearInterval(Contractions.tickTimer); Contractions.tickTimer = null; }
      Sounds.play("ping");
      Contractions.render();
      Reminders.maybeContractionNudge();
    },
    clear: function () {
      if (Contractions.activeStart) return;
      if (!confirm("Clear all contraction logs on this device?")) return;
      Contractions.persist({ log: [] });
      Contractions.render();
    }
  };

  /* ---------- Baby tracker ---------- */
  var Baby = {
    defaults: function () {
      return {
        lastFedAt: null,
        lastFedType: "",
        lastFedOz: "",
        diapersLeft: 40,
        diaperLowAt: 10,
        lastDiaperAt: null,
        lastSleepStart: null,
        lastSleepEnd: null,
        sleeping: false
      };
    },
    data: function () { return Object.assign(Baby.defaults(), load(LS_BABY, {})); },
    persist: function (d) { save(LS_BABY, d); },
    ago: function (ts) {
      if (!ts) return "Not yet";
      var m = Math.round((Date.now() - ts) / 60000);
      if (m < 1) return "Just now";
      if (m < 60) return m + " min ago";
      var h = Math.floor(m / 60);
      var r = m % 60;
      if (h < 24) return h + "h " + r + "m ago";
      return new Date(ts).toLocaleString();
    },
    render: function () {
      var d = Baby.data();
      var fed = $("baby-last-fed");
      if (fed) {
        var extra = d.lastFedType ? " · " + d.lastFedType : "";
        if (d.lastFedOz) extra += " · " + d.lastFedOz + " oz";
        fed.textContent = Baby.ago(d.lastFedAt) + extra;
      }
      var stock = $("baby-diaper-stock");
      if (stock) {
        stock.textContent = String(d.diapersLeft);
        stock.classList.toggle("is-low", d.diapersLeft <= (d.diaperLowAt || 10));
      }
      var low = $("baby-diaper-low");
      if (low) {
        low.hidden = d.diapersLeft > (d.diaperLowAt || 10);
        low.textContent = "Low stock — " + d.diapersLeft + " diapers left. Time to restock.";
      }
      var diaperAgo = $("baby-last-diaper");
      if (diaperAgo) diaperAgo.textContent = Baby.ago(d.lastDiaperAt);
      var sleepEl = $("baby-sleep-status");
      if (sleepEl) {
        if (d.sleeping && d.lastSleepStart) {
          sleepEl.textContent = "Sleeping since " + new Date(d.lastSleepStart).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        } else if (d.lastSleepEnd) {
          sleepEl.textContent = "Last nap ended " + Baby.ago(d.lastSleepEnd);
        } else {
          sleepEl.textContent = "No sleep logged yet";
        }
      }
      var sleepStart = $("baby-sleep-start");
      var sleepEnd = $("baby-sleep-end");
      if (sleepStart) sleepStart.hidden = !!d.sleeping;
      if (sleepEnd) sleepEnd.hidden = !d.sleeping;
      var lowInput = $("baby-low-threshold");
      if (lowInput && document.activeElement !== lowInput) lowInput.value = d.diaperLowAt || 10;
      var stockInput = $("baby-stock-input");
      if (stockInput && document.activeElement !== stockInput) stockInput.value = d.diapersLeft;
    },
    fed: function (type) {
      var d = Baby.data();
      d.lastFedAt = Date.now();
      d.lastFedType = type || ($("baby-feed-type") && $("baby-feed-type").value) || "";
      var oz = $("baby-feed-oz");
      d.lastFedOz = oz && oz.value ? oz.value : "";
      Baby.persist(d);
      Baby.render();
      Sounds.play("lullaby");
      Reminders.armFeed();
      toast("Fed logged");
    },
    useDiaper: function () {
      var d = Baby.data();
      d.diapersLeft = Math.max(0, (d.diapersLeft || 0) - 1);
      d.lastDiaperAt = Date.now();
      Baby.persist(d);
      Baby.render();
      Sounds.play("ping");
      if (d.diapersLeft <= (d.diaperLowAt || 10)) {
        notify("Diapers running low", d.diapersLeft + " left");
        Sounds.play("chime");
      }
      toast("Diaper logged · " + d.diapersLeft + " left");
    },
    setStock: function () {
      var d = Baby.data();
      var inp = $("baby-stock-input");
      var n = parseInt(inp && inp.value, 10);
      if (!isFinite(n) || n < 0) return;
      d.diapersLeft = n;
      Baby.persist(d);
      Baby.render();
    },
    setLow: function () {
      var d = Baby.data();
      var inp = $("baby-low-threshold");
      var n = parseInt(inp && inp.value, 10);
      if (!isFinite(n) || n < 0) return;
      d.diaperLowAt = n;
      Baby.persist(d);
      Baby.render();
    },
    sleepStart: function () {
      var d = Baby.data();
      d.sleeping = true;
      d.lastSleepStart = Date.now();
      Baby.persist(d);
      Baby.render();
      Sounds.play("lullaby");
    },
    sleepEnd: function () {
      var d = Baby.data();
      d.sleeping = false;
      d.lastSleepEnd = Date.now();
      Baby.persist(d);
      Baby.render();
      Sounds.play("ping");
    }
  };

  /* ---------- Reminders ---------- */
  var feedTimer = null;
  var Reminders = {
    data: function () {
      return Object.assign({
        feedEveryHours: 3,
        feedEnabled: false,
        diaperLowEnabled: true,
        contractionNudge: true,
        nextFeedAt: null
      }, load(LS_REMINDERS, {}));
    },
    persist: function (d) { save(LS_REMINDERS, d); },
    render: function () {
      var d = Reminders.data();
      var fe = $("remind-feed-enabled");
      var fh = $("remind-feed-hours");
      var dl = $("remind-diaper-enabled");
      var cn = $("remind-contraction-enabled");
      if (fe) fe.checked = !!d.feedEnabled;
      if (fh && document.activeElement !== fh) fh.value = d.feedEveryHours || 3;
      if (dl) dl.checked = d.diaperLowEnabled !== false;
      if (cn) cn.checked = d.contractionNudge !== false;
      var next = $("remind-next-feed");
      if (next) {
        if (d.feedEnabled && d.nextFeedAt) {
          next.textContent = "Next feed reminder: " + new Date(d.nextFeedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        } else {
          next.textContent = "Feed reminders off (or log a feed to arm the next one).";
        }
      }
      var mute = $("sound-mute-toggle");
      if (mute) mute.checked = Sounds.muted;
    },
    saveFromForm: function () {
      var d = Reminders.data();
      d.feedEnabled = !!($("remind-feed-enabled") && $("remind-feed-enabled").checked);
      d.feedEveryHours = parseFloat(($("remind-feed-hours") && $("remind-feed-hours").value) || 3) || 3;
      d.diaperLowEnabled = !!($("remind-diaper-enabled") && $("remind-diaper-enabled").checked);
      d.contractionNudge = !!($("remind-contraction-enabled") && $("remind-contraction-enabled").checked);
      Reminders.persist(d);
      if (d.feedEnabled) Reminders.armFeed(true);
      else {
        d.nextFeedAt = null;
        Reminders.persist(d);
        if (feedTimer) { clearTimeout(feedTimer); feedTimer = null; }
      }
      Reminders.render();
      toast("Reminders saved");
      requestNotifPermission();
    },
    armFeed: function (keepExisting) {
      var d = Reminders.data();
      if (!d.feedEnabled) return;
      var ms = (d.feedEveryHours || 3) * 3600 * 1000;
      if (!keepExisting || !d.nextFeedAt || d.nextFeedAt < Date.now()) {
        d.nextFeedAt = Date.now() + ms;
        Reminders.persist(d);
      }
      if (feedTimer) clearTimeout(feedTimer);
      var delay = Math.max(1000, d.nextFeedAt - Date.now());
      feedTimer = setTimeout(function () {
        notify("Feed reminder", "Gentle nudge — check on baby’s next feed when you’re ready.");
        Sounds.play("lullaby");
        toast("Feed reminder");
        var dd = Reminders.data();
        dd.nextFeedAt = Date.now() + (dd.feedEveryHours || 3) * 3600 * 1000;
        Reminders.persist(dd);
        Reminders.armFeed(true);
        Reminders.render();
      }, delay);
      Reminders.render();
    },
    maybeContractionNudge: function () {
      var d = Reminders.data();
      if (!d.contractionNudge) return;
      var c = Contractions.data().log;
      var recent = c.filter(function (x) { return Date.now() - x.start < 3600 * 1000; });
      if (recent.length < 4) return;
      var intervals = recent.slice(1).map(function (x) { return x.intervalMs; }).filter(Boolean);
      if (!intervals.length) return;
      var avg = intervals.reduce(function (a, b) { return a + b; }, 0) / intervals.length;
      if (avg <= 5 * 60 * 1000) {
        notify("Contraction pattern", "Contractions look closer. Not medical advice — consider calling your care team.");
        Sounds.play("chime");
      }
    }
  };

  function requestNotifPermission() {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") Notification.requestPermission().catch(function () {});
  }

  function notify(title, body) {
    try {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body: body, silent: true });
      }
    } catch (e) {}
  }

  function toast(msg) {
    var el = $("mom-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "mom-toast";
      el.className = "mom-toast";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.hidden = true; }, 2800);
  }

  function bind() {
    /* Contractions */
    var cs = $("contraction-start");
    var cp = $("contraction-stop");
    var cc = $("contraction-clear");
    var ct = $("contraction-toggle");
    if (cs) cs.addEventListener("click", Contractions.start);
    if (cp) cp.addEventListener("click", Contractions.stop);
    if (cc) cc.addEventListener("click", Contractions.clear);
    if (ct) ct.addEventListener("click", Contractions.toggle);

    /* Baby */
    var fedBtn = $("baby-log-fed");
    if (fedBtn) fedBtn.addEventListener("click", function () { Baby.fed(); });
    ["breast", "bottle"].forEach(function (t) {
      var b = $("baby-fed-" + t);
      if (b) b.addEventListener("click", function () { Baby.fed(t); });
    });
    var diaper = $("baby-use-diaper");
    if (diaper) diaper.addEventListener("click", Baby.useDiaper);
    var setStock = $("baby-set-stock");
    if (setStock) setStock.addEventListener("click", Baby.setStock);
    var setLow = $("baby-set-low");
    if (setLow) setLow.addEventListener("click", Baby.setLow);
    var ss = $("baby-sleep-start");
    var se = $("baby-sleep-end");
    if (ss) ss.addEventListener("click", Baby.sleepStart);
    if (se) se.addEventListener("click", Baby.sleepEnd);

    /* Reminders */
    var saveR = $("remind-save");
    if (saveR) saveR.addEventListener("click", Reminders.saveFromForm);
    var mute = $("sound-mute-toggle");
    if (mute) mute.addEventListener("change", function () { Sounds.setMuted(mute.checked); });
    var testSound = $("sound-test");
    if (testSound) testSound.addEventListener("click", function () { Sounds.play("chime"); });

    Contractions.render();
    Baby.render();
    Reminders.render();
    if (Reminders.data().feedEnabled) Reminders.armFeed(true);

    window.addEventListener("hashchange", function () {
      var h = location.hash || "";
      if (h === "#contractions") Contractions.render();
      if (h === "#baby") Baby.render();
      if (h === "#reminders") Reminders.render();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();

  window.HeartMomTools = { Contractions: Contractions, Baby: Baby, Reminders: Reminders };
})();
