/**
 * Heart & Hope — Healing After Loss.
 * A comforting message first, then continuing support so no woman feels
 * forgotten: a gentle check-in journey, remembrance, legal reassurance,
 * what to expect, resources, and a private journal. localStorage only.
 */
(function () {
  "use strict";

  var KEY = "heartLoss";

  var STAGES = [
    { day: 0, label: "Today",
      msg: "You don’t have to be okay today. Just breathe, drink some water, and let yourself be held — by someone you trust, or by this quiet page.",
      action: "Small step: drink a full glass of water.",
      nudge: "You don’t have to be okay today. We’re here." },
    { day: 3, label: "Day 3 · the quiet days",
      msg: "The world keeps moving and it can feel wrong. It’s okay to cancel plans. It’s okay to cry in the grocery store. There is no performing grief correctly.",
      action: "Small step: step outside for five minutes of air.",
      nudge: "The quiet days are the hardest. We’re still here." },
    { day: 7, label: "One week",
      msg: "Grief comes in waves — numbness, then tears, then numbness again. All of it is normal. You are not “too sad” and you are not “taking too long.”",
      action: "Small step: write one sentence about your baby, anywhere.",
      nudge: "One week. There is no timeline for this." },
    { day: 14, label: "Two weeks",
      msg: "People may have stopped asking how you are. We haven’t. How are you, really? There is no wrong answer.",
      action: "Small step: tell one person how you’re really doing.",
      nudge: "Two weeks. We haven’t stopped thinking of you." },
    { day: 30, label: "One month",
      msg: "One month of missing someone the world never got to meet. Be as gentle with yourself as you would be with your dearest friend.",
      action: "Small step: do one kind thing for your body — a warm bath, an early night, a real meal.",
      nudge: "One month. Be gentle with yourself today." },
    { day: 60, label: "Two months",
      msg: "Healing is not forgetting. Loving your baby and living your life are not opposites — they can grow side by side.",
      action: "Small step: visit your candle below, if you lit one.",
      nudge: "Two months. Healing is not forgetting." },
    { day: 90, label: "Three months",
      msg: "Some days will feel almost normal, and then grief will visit again out of nowhere. That’s not going backwards. That’s love, still there.",
      action: "Small step: when a wave comes, name it — “this is grief, and it’s okay.”",
      nudge: "Three months. Waves are normal. You’re doing fine." },
    { day: 180, label: "Six months",
      msg: "Half a year. Your love hasn’t gone anywhere — and neither have we.",
      action: "Small step: write your baby a letter below.",
      nudge: "Six months. We’re still walking with you." },
    { day: 365, label: "One year",
      msg: "A year of loving someone you never got to hold. Mark this day however feels right — quietly, loudly, or not at all. All of it counts.",
      action: "Small step: light your candle again.",
      nudge: "One year. Your baby mattered. You matter." }
  ];

  function $(id) { return document.getElementById(id); }

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function state() {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; }
    catch (e) { return {}; }
  }
  function save(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
  }

  function daysSince(iso) {
    var t = new Date(iso + "T12:00:00").getTime();
    if (isNaN(t)) return null;
    return Math.floor((Date.now() - t) / 86400000);
  }

  function stageIndexFor(days) {
    var idx = 0;
    for (var i = 0; i < STAGES.length; i++) {
      if (days >= STAGES[i].day) idx = i;
    }
    return idx;
  }

  function gentleNotify(stage) {
    try {
      if (window.HeartNotify && typeof window.HeartNotify.announce === "function") {
        window.HeartNotify.announce();
      }
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("We’re still here ♥", {
          body: stage.label + ". " + stage.nudge,
          tag: "heart-loss",
          silent: true
        });
      }
    } catch (e) {}
  }

  function fmtDate(iso) {
    try {
      return new Date(iso + "T12:00:00").toLocaleDateString([], {
        month: "long", day: "numeric", year: "numeric"
      });
    } catch (e) { return iso; }
  }

  function render() {
    var root = $("loss-body");
    if (!root) return;
    var st = state();
    var days = st.lossDate ? daysSince(st.lossDate) : null;
    var cur = (days == null || days < 0) ? -1 : stageIndexFor(days);

    /* Milestone reached since last visit → gentle notification. */
    if (cur >= 0) {
      if (typeof st.lastSeenStage === "number" && cur > st.lastSeenStage) {
        gentleNotify(STAGES[cur]);
      }
      if (st.lastSeenStage !== cur) { st.lastSeenStage = cur; save(st); }
    }

    var h = "";
    var legalPanel = "";

    /* Legal button panel — built up top so it renders right under the comfort card. */
    var legalHtml = "";
    legalHtml += "<h3>Your loss is not a crime</h3>";
    legalHtml += "<p><strong>Breathe.</strong> In every U.S. state, having a miscarriage is <strong>not</strong> a crime. Abortion laws are written about providers and procedures — they do not punish a woman for losing a pregnancy. A miscarriage is a pregnancy ending on its own; the law treats that as a medical event, not a crime.</p>";
    legalHtml += "<p>Why we tell you this: the news can make it all sound confusing, and a few grieving women have been questioned by people who misunderstood the law. Knowing your rights takes that fear away:</p>";
    legalHtml += "<ul class=\"loss-list\">";
    legalHtml += "<li>You do <strong>not</strong> have to report a miscarriage to anyone.</li>";
    legalHtml += "<li>Your medical care is private — between you and your doctor.</li>";
    legalHtml += "<li>If anyone who isn’t your doctor questions you about your loss, you can stay silent and ask for a lawyer. You never have to explain your grief to anyone.</li>";
    legalHtml += "<li>You deserve timely, compassionate medical care. If a hospital ever delays your miscarriage care, you can ask for a patient advocate or go to another provider.</li>";
    legalHtml += "</ul>";
    legalHtml += "<p><strong>Free, confidential legal help</strong> if you ever want real answers for your state:</p>";
    legalHtml += "<ul class=\"loss-list\">";
    legalHtml += '<li>Repro Legal Helpline — <a href="tel:8448682812">844-868-2812</a> (free, confidential)</li>';
    legalHtml += '<li>Pregnancy Justice — <a href="tel:2122559252">212-255-9252</a></li>';
    legalHtml += "</ul>";
    legalHtml += '<p class="hint">General information, not legal advice — but those helplines give real answers for your state, for free.</p>';

    legalPanel += '<div class="form-panel support-panel loss-panel">';
    legalPanel += "<h3>Worried about the law?</h3>";
    legalPanel += "<p>If you have questions — or you’re scared your miscarriage could be treated as something it isn’t — tap below. What’s there will comfort you: <strong>you are safe.</strong></p>";
    legalPanel += '<button type="button" class="btn btn-secondary" id="loss-legal-toggle" aria-expanded="false" aria-controls="loss-legal-body">My questions about the law, answered ♥</button>';
    legalPanel += '<div id="loss-legal-body" class="loss-legal-body" hidden>' + legalHtml + "</div>";
    legalPanel += "</div>";


    /* 1 — The comforting message, first. */
    h += '<div class="loss-comfort" role="note" aria-label="A message for you">';
    h += "<h3>We are so sorry.</h3>";
    h += "<p>If you are reading this through tears, please hear this first:</p>";
    h += "<p><strong>Your baby mattered. Your grief matters. You are not forgotten here.</strong></p>";
    h += "<p>Nothing about this is your fault — not the coffee, not the exercise, not the stress, not anything you did or didn’t do. Most miscarriages happen because something wasn’t right in the earliest days of development, long before you could have known or changed anything.</p>";
    h += "<p>You don’t have to be strong right now. You don’t have to “move on.” Grief is love with nowhere to go, and you are allowed to feel all of it.</p>";
    h += "<p><strong>We are not going anywhere.</strong> This page will be here in a week, in a month, in a year — still holding space for you and your baby.</p>";
    h += "</div>";

    /* Legal button sits right at the top — just in case she has questions. */
    h += legalPanel;

    /* 1b — You are not suffering alone: real human connection. */
    h += '<div class="form-panel support-panel loss-panel loss-notalone">';
    h += "<h3>You are not suffering alone</h3>";
    h += "<p>About <strong>1 in 5</strong> known pregnancies ends in miscarriage. That means millions of women know exactly this grief — and many of them are here, ready to sit with you in it.</p>";
    h += '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin:0.75rem 0">';
    h += '<a class="btn btn-primary" href="#mentor">Talk to a mentor mom</a>';
    h += '<a class="btn btn-secondary" href="#stories">Notes from moms who’ve been here</a>';
    h += "</div>";
    h += '<p class="hint">Real people, never bots. Mentor moms are volunteers — women who chose to be here for exactly this.</p>';
    h += "</div>";

    /* 2 — Continuing support journey. */
    h += '<div class="form-panel support-panel loss-panel">';
    h += "<h3>You are not forgotten</h3>";
    h += "<p>Grief doesn’t end when the world stops asking about it. If you’d like, share the date — <strong>privately, on this phone only</strong> — and we’ll keep gentle company with you through the days ahead.</p>";
    h += '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;margin:0.75rem 0">';
    h += '<input type="date" id="loss-date" class="input" value="' + escapeHtml(st.lossDate || "") + '" aria-label="Date of your loss" />';
    h += '<button type="button" class="btn btn-primary" id="loss-save-date">Walk with me</button>';
    if (st.lossDate) {
      h += '<button type="button" class="btn btn-secondary" id="loss-clear-date">Remove date</button>';
    }
    h += "</div>";
    if (days != null && days >= 0) {
      h += '<p class="hint">Day ' + days + " of loving your baby.</p>";
    }
    h += '<div class="loss-timeline">';
    for (var i = 0; i < STAGES.length; i++) {
      var sg = STAGES[i];
      var cls = "loss-stage";
      var tag = "";
      if (cur >= 0) {
        if (i < cur) { cls += " is-past"; tag = '<span class="loss-chip">behind you</span>'; }
        else if (i === cur) { cls += " is-current"; tag = '<span class="loss-chip loss-chip-now">you are here</span>'; }
        else { tag = '<span class="loss-chip">ahead</span>'; }
      }
      var held = st.held && st.held[i];
      h += '<div class="' + cls + '">';
      h += '<div class="loss-stage-head"><strong>' + escapeHtml(sg.label) + "</strong>" + tag + "</div>";
      h += "<p>" + escapeHtml(sg.msg) + "</p>";
      h += '<p class="loss-action">' + escapeHtml(sg.action) + "</p>";
      if (held) {
        h += '<p class="loss-held">Held ♥ ' + escapeHtml(held) + "</p>";
      } else {
        h += '<button type="button" class="btn btn-secondary loss-held-btn" data-stage="' + i + '">This held me today ♥</button>';
      }
      h += "</div>";
    }
    h += "</div>";
    if (cur < 0) {
      h += '<p class="hint">Add the date above and we’ll walk it with you, one gentle step at a time.</p>';
    }
    h += "</div>";

    /* 3 — Remembrance. */
    h += '<div class="form-panel support-panel loss-panel">';
    h += "<h3>Your baby will always be part of your story</h3>";
    h += '<div class="loss-candle-wrap">';
    if (st.candleLit) {
      h += '<div class="loss-candle lit" aria-hidden="true">🕯️</div>';
      h += "<p>Lit " + escapeHtml(st.candleLit) + (st.babyName ? " for <strong>" + escapeHtml(st.babyName) + "</strong>" : "") + ".</p>";
      h += '<button type="button" class="btn btn-secondary" id="loss-candle">Light it again</button>';
    } else {
      h += '<div class="loss-candle" aria-hidden="true">🕯️</div>';
      h += "<p>Light a candle for your baby. It stays lit here, for as long as you need it.</p>";
      h += '<button type="button" class="btn btn-primary" id="loss-candle">Light a candle</button>';
    }
    h += "</div>";
    h += '<label class="field-label" for="loss-name">If you gave your baby a name — or a nickname only you know — keep it here</label>';
    h += '<div style="display:flex;gap:0.5rem;flex-wrap:wrap">';
    h += '<input type="text" id="loss-name" class="input" style="flex:1 1 160px" maxlength="60" placeholder="Baby’s name (optional)" value="' + escapeHtml(st.babyName || "") + '" />';
    h += '<button type="button" class="btn btn-secondary" id="loss-save-name">Save</button>';
    h += "</div>";
    h += '<label class="field-label" for="loss-letter" style="margin-top:0.75rem">Write to your baby</label>';
    h += '<textarea id="loss-letter" class="input" rows="4" placeholder="Dear baby…">' + escapeHtml(st.letter || "") + "</textarea>";
    h += '<div style="margin-top:0.5rem"><button type="button" class="btn btn-secondary" id="loss-save-letter">Save letter</button></div>';
    h += "</div>";

    /* 5 — What to expect. */
    h += '<div class="form-panel support-panel loss-panel">';
    h += "<h3>Gentle truths for the days ahead</h3>";
    h += "<p><strong>Your body:</strong> expect bleeding and cramping like a heavy period — often for several days, sometimes up to two weeks. Rest as much as you can. Your doctor will tell you when it’s okay to use tampons or be intimate again; until then, pads and patience.</p>";
    h += "<p><strong>Your heart:</strong> numbness, tears out of nowhere, anger, jealousy, guilt — all common, all normal. Grief has no timeline and no stages you must pass in order.</p>";
    h += "<p><strong>Call your doctor right away</strong> if: you soak through 2 or more pads an hour for 2 hours · pain isn’t eased by pain reliever · fever over 100.4°F · bad-smelling discharge · dizziness or fainting.</p>";
    h += '<p class="hint">This isn’t medical advice — your care team knows your situation. When in doubt, call them. That’s what they’re there for.</p>';
    h += "</div>";

    /* 6 — For loved ones. */
    h += '<div class="form-panel support-panel loss-panel">';
    h += "<h3>If someone you love is grieving</h3>";
    h += "<p><strong>What helps:</strong> say “I’m so sorry.” Show up — with food, with company, with silence. Say the baby’s name if they shared one. Remember the due date. Keep checking in after the first two weeks, when everyone else goes quiet.</p>";
    h += "<p><strong>What hurts:</strong> “At least you can try again.” “Everything happens for a reason.” “It wasn’t really a baby yet.” Rushing her to “move on.” Disappearing.</p>";
    h += "</div>";

    /* 7 — Support resources. */
    h += '<div class="form-panel support-panel loss-panel">';
    h += "<h3>You don’t have to carry this alone</h3>";
    h += "<p>If grief ever feels like more than you can carry, please reach out:</p>";
    h += "<ul class=\"loss-list\">";
    h += '<li><strong>988</strong> Suicide &amp; Crisis Lifeline — call or text <a href="tel:988">988</a></li>';
    h += '<li>Postpartum Support International — <a href="tel:18009444773">1-800-944-4773</a> (they support loss too)</li>';
    h += '<li>Share Pregnancy &amp; Infant Loss Support — nationalshare.org</li>';
    h += '<li>M+A Hotline — <a href="tel:18332462632">1-833-246-2632</a> (support during and after miscarriage)</li>';
    h += "</ul>";
    h += "</div>";

    /* 8 — Journal. */
    h += '<div class="form-panel support-panel loss-panel">';
    h += "<h3>Your private journal</h3>";
    h += '<p class="hint">Everything you write stays on this phone.</p>';
    h += '<textarea id="loss-journal" class="input" rows="5" placeholder="Today I feel…">' + escapeHtml(st.journal || "") + "</textarea>";
    h += '<div style="margin-top:0.5rem"><button type="button" class="btn btn-secondary" id="loss-save-journal">Save entry</button></div>';
    h += "</div>";

    root.innerHTML = h;
    bind();
  }

  function savedFlash(msg) {
    var el = $("loss-saved");
    if (!el) {
      el = document.createElement("p");
      el.id = "loss-saved";
      el.className = "loss-saved";
      el.setAttribute("role", "status");
      var root = $("loss-body");
      if (root && root.firstChild) root.insertBefore(el, root.firstChild);
      else if (root) root.appendChild(el);
    }
    el.textContent = msg || "Saved ♥";
    el.hidden = false;
    clearTimeout(savedFlash._t);
    savedFlash._t = setTimeout(function () { el.hidden = true; }, 2500);
  }

  function bind() {
    var st = state();

    var saveDate = $("loss-save-date");
    if (saveDate) saveDate.addEventListener("click", function () {
      var v = ($("loss-date") || {}).value || "";
      st = state();
      if (v) { st.lossDate = v; delete st.lastSeenStage; }
      save(st);
      try {
        if (window.HeartNotify && typeof window.HeartNotify.announce === "function") {
          window.HeartNotify.announce();
        }
      } catch (e) {}
      render();
      savedFlash("We’ll walk with you ♥");
    });

    var clearDate = $("loss-clear-date");
    if (clearDate) clearDate.addEventListener("click", function () {
      st = state();
      delete st.lossDate; delete st.lastSeenStage;
      save(st); render();
    });

    var heldBtns = document.querySelectorAll(".loss-held-btn");
    Array.prototype.forEach.call(heldBtns, function (b) {
      b.addEventListener("click", function () {
        var i = parseInt(b.getAttribute("data-stage"), 10);
        st = state();
        st.held = st.held || {};
        try {
          st.held[i] = new Date().toLocaleDateString([], { month: "short", day: "numeric" });
        } catch (e) { st.held[i] = "today"; }
        save(st); render();
      });
    });

    var candle = $("loss-candle");
    if (candle) candle.addEventListener("click", function () {
      st = state();
      try {
        st.candleLit = new Date().toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });
      } catch (e) { st.candleLit = "today"; }
      save(st);
      try {
        if (window.HeartNotify && typeof window.HeartNotify.announce === "function") {
          window.HeartNotify.announce();
        }
      } catch (e) {}
      render();
    });

    var saveName = $("loss-save-name");
    if (saveName) saveName.addEventListener("click", function () {
      st = state();
      st.babyName = (($("loss-name") || {}).value || "").trim().slice(0, 60);
      save(st); savedFlash("Saved ♥");
    });

    var saveLetter = $("loss-save-letter");
    if (saveLetter) saveLetter.addEventListener("click", function () {
      st = state();
      st.letter = ($("loss-letter") || {}).value || "";
      save(st); savedFlash("Letter saved ♥");
    });

    var saveJournal = $("loss-save-journal");
    if (saveJournal) saveJournal.addEventListener("click", function () {
      st = state();
      st.journal = ($("loss-journal") || {}).value || "";
      save(st); savedFlash("Journal saved ♥");
    });

    var legalToggle = $("loss-legal-toggle");
    var legalBody = $("loss-legal-body");
    if (legalToggle && legalBody) legalToggle.addEventListener("click", function () {
      var open = legalBody.hidden;
      legalBody.hidden = !open;
      legalToggle.setAttribute("aria-expanded", open ? "true" : "false");
      legalToggle.textContent = open ? "Close ♥" : "My questions about the law, answered ♥";
    });
  }

  window.HeartLoss = { render: render };
})();
