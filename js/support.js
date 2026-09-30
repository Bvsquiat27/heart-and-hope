/**
 * Hearth & Hope — Support tools (crisis, ultrasound, 90 days, mentor,
 * goods, family invite, work, stories, resume + job emails).
 * Dignity-first. No AI mentor. No sham enrollment. localStorage only.
 */
(function () {
  "use strict";

  const NINETY_KEY = "hearthNinetyDays";
  const RESUME_KEY = "hearthResumeDraft";
  const CRISIS_KEY = "hearthCrisisDraft";

  function $(id) { return document.getElementById(id); }

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function goHelp(opts) {
    if (window.HearthHelp && typeof window.HearthHelp.applyHelpPrefill === "function") {
      window.HearthHelp.applyHelpPrefill(opts || {});
    } else {
      try { sessionStorage.setItem("hearthHelpPrefill", JSON.stringify(opts || {})); } catch (e) {}
      location.hash = "#help";
    }
  }

  function readZip() {
    try {
      return (localStorage.getItem("hearthLastZip") || "").trim();
    } catch (e) {
      return "";
    }
  }

  function rememberZip(z) {
    const zip = String(z || "").replace(/\D/g, "").slice(0, 5);
    if (zip.length === 5) {
      try { localStorage.setItem("hearthLastZip", zip); } catch (e) {}
    }
    return zip;
  }

  /* ---------- Crisis: Step 1–3 ---------- */
  function crisisState() {
    try { return JSON.parse(localStorage.getItem(CRISIS_KEY) || "{}") || {}; }
    catch (e) { return {}; }
  }
  function saveCrisis(s) {
    try { localStorage.setItem(CRISIS_KEY, JSON.stringify(s)); } catch (e) {}
  }

  function renderCrisis() {
    const root = $("crisis-flow");
    if (!root) return;
    const s = crisisState();
    const step = s.step || 1;

    if (step === 1) {
      root.innerHTML = `
        <p class="step-pill">Step 1 of 3</p>
        <h3 class="support-h3">Where are you in pregnancy?</h3>
        <p class="hint">Optional. Skip if you prefer.</p>
        <div class="choice-stack">
          <button type="button" class="btn btn-secondary btn-lg choice-btn" data-along="unsure">Not sure yet</button>
          <button type="button" class="btn btn-secondary btn-lg choice-btn" data-along="early">Early (about 1–12 weeks)</button>
          <button type="button" class="btn btn-secondary btn-lg choice-btn" data-along="mid">Middle (about 13–27 weeks)</button>
          <button type="button" class="btn btn-secondary btn-lg choice-btn" data-along="late">Later (28+ weeks)</button>
          <button type="button" class="btn btn-ghost btn-lg choice-btn" data-along="">Skip this</button>
        </div>`;
      root.querySelectorAll("[data-along]").forEach((btn) => {
        btn.addEventListener("click", () => {
          s.along = btn.getAttribute("data-along") || "";
          s.step = 2;
          saveCrisis(s);
          renderCrisis();
        });
      });
      return;
    }

    if (step === 2) {
      root.innerHTML = `
        <p class="step-pill">Step 2 of 3</p>
        <h3 class="support-h3">What do you need most right now?</h3>
        <p class="hint">Choose one need for now — you can return for others.</p>
        <div class="choice-stack">
          <button type="button" class="btn btn-secondary btn-lg choice-btn" data-need="housing">A safe place to stay</button>
          <button type="button" class="btn btn-secondary btn-lg choice-btn" data-need="food">Food help</button>
          <button type="button" class="btn btn-secondary btn-lg choice-btn" data-need="ultrasound">Ultrasound or appointment</button>
          <button type="button" class="btn btn-secondary btn-lg choice-btn" data-need="ride">A ride to care</button>
          <button type="button" class="btn btn-secondary btn-lg choice-btn" data-need="talk">Someone to talk to</button>
          <button type="button" class="btn btn-secondary btn-lg choice-btn" data-need="counseling">Pregnancy counseling</button>
          <button type="button" class="btn btn-secondary btn-lg choice-btn" data-need="mentor">A mentor mom</button>
        </div>
        <button type="button" class="btn btn-ghost" id="crisis-back">← Back</button>`;
      root.querySelectorAll("[data-need]").forEach((btn) => {
        btn.addEventListener("click", () => {
          s.need = btn.getAttribute("data-need");
          s.step = 3;
          saveCrisis(s);
          renderCrisis();
        });
      });
      $("crisis-back").onclick = () => { s.step = 1; saveCrisis(s); renderCrisis(); };
      return;
    }

    /* step 3 */
    const needMap = {
      housing: { needs: ["expecting", "housing"], label: "housing" },
      food: { needs: ["expecting", "food"], label: "food help" },
      ultrasound: { needs: ["expecting", "ultrasound"], label: "an ultrasound or appointment" },
      ride: { needs: ["expecting", "ride"], label: "a ride to an appointment" },
      talk: { needs: ["expecting", "talk"], label: "someone to talk to" },
      counseling: { needs: ["expecting", "counseling"], label: "pregnancy counseling" },
      mentor: { needs: ["expecting", "mentor"], label: "a mentor mom" }
    };
    const pack = needMap[s.need] || { needs: ["expecting", "talk"], label: "support" };
    const zip = readZip();
    root.innerHTML = `
      <p class="step-pill">Step 3 of 3</p>
      <h3 class="support-h3">Help is available</h3>
      <p>You asked for <strong>${escapeHtml(pack.label)}</strong>. Next, see nearby centers — or draft a message they can answer.</p>
      <div class="field" style="margin:1rem 0">
        <label class="field-label" for="crisis-zip">Your city or ZIP</label>
        <input type="text" id="crisis-zip" class="input input-lg" placeholder="Example: 77002" value="${escapeHtml(zip)}" />
      </div>
      <div class="choice-stack">
        <button type="button" class="btn btn-primary btn-lg" id="crisis-find">Find help near me</button>
        <button type="button" class="btn btn-secondary btn-lg" id="crisis-draft">Draft a message for centers</button>
      </div>
      <div class="faith-optional" id="crisis-faith-wrap">
        <p class="faith-line">Optional: “God, give me peace for today and people who will walk with me.”</p>
        <button type="button" class="btn btn-ghost" id="crisis-skip-faith">Hide this</button>
      </div>
      <button type="button" class="btn btn-ghost" id="crisis-back">← Back</button>
      <p class="hint" style="margin-top:0.75rem">In danger? Call <strong>911</strong>. For emotional crisis in the U.S., call or text <strong>988</strong>.</p>`;

    $("crisis-back").onclick = () => { s.step = 2; saveCrisis(s); renderCrisis(); };
    const skip = $("crisis-skip-faith");
    if (skip) skip.onclick = () => { const w = $("crisis-faith-wrap"); if (w) w.hidden = true; };
    $("crisis-find").onclick = () => {
      const z = rememberZip(($("crisis-zip") && $("crisis-zip").value) || "");
      const loc = $("loc-filter");
      if (loc && z) loc.value = z;
      location.hash = "#directory";
    };
    $("crisis-draft").onclick = () => {
      const z = rememberZip(($("crisis-zip") && $("crisis-zip").value) || "");
      const alongNote = s.along ? ` (about ${s.along} pregnancy)` : "";
      goHelp({
        location: z,
        needs: pack.needs,
        message: `Hi — I’m reaching out because I’m pregnant and scared${alongNote}. Right now I most need ${pack.label}. Please tell me what help you can offer. Thank you.`
      });
    };
  }

  /* ---------- Ultrasound ---------- */
  function renderUltrasound() {
    const root = $("ultrasound-body");
    if (!root) return;
    root.innerHTML = `
      <div class="form-panel support-panel">
        <h3 class="support-h3">What to expect</h3>
        <ul class="plain-list">
          <li>A confirmation visit checks pregnancy and answers first questions.</li>
          <li>An ultrasound uses sound waves to look at the baby. It is usually painless.</li>
          <li>You may be asked to drink water beforehand for some early scans.</li>
          <li>Ask anything — there are no “silly” questions.</li>
        </ul>
        <h3 class="support-h3">What to pack</h3>
        <ul class="plain-list">
          <li>ID and insurance card if you have them</li>
          <li>A list of medicines and questions</li>
          <li>A support person if you want one</li>
          <li>A snack and water</li>
        </ul>
        <h3 class="support-h3">Need a free or low-cost ultrasound?</h3>
        <p>Many pregnancy centers offer free or low-cost scans or can point you to one. We never list abortion clinics.</p>
        <div class="choice-stack" style="margin-top:1rem">
          <a class="btn btn-primary btn-lg" href="#directory" data-nav>Find nearby help</a>
          <button type="button" class="btn btn-secondary btn-lg" id="us-ask">Ask for ultrasound help</button>
          <button type="button" class="btn btn-ghost btn-lg" id="us-ride">I need a ride</button>
        </div>
      </div>`;
    $("us-ask").onclick = () => goHelp({
      location: readZip(),
      needs: ["expecting", "ultrasound"],
      message: "Hi — I need help with a free or low-cost ultrasound or confirmation appointment. Please tell me what you offer and how to schedule. Thank you."
    });
    $("us-ride").onclick = () => goHelp({
      location: readZip(),
      needs: ["expecting", "ride", "ultrasound"],
      message: "Hi — I need a ride to an ultrasound or prenatal appointment. Please tell me if you can help with transportation. Thank you."
    });
  }

  /* ---------- First 90 days ---------- */
  const NINETY_ITEMS = [
    { id: "wic", phase: "Weeks 1–2", title: "Learn about WIC", blurb: "WIC helps with healthy food for moms and kids. Ask a center how to start in your state — we don’t enroll you here." },
    { id: "snap", phase: "Weeks 1–2", title: "Learn about SNAP (food help)", blurb: "SNAP helps buy groceries. A center can often help you apply." },
    { id: "diapers", phase: "Weeks 1–2", title: "Find a diaper bank", blurb: "Ask Find help or a church about free diapers and wipes." },
    { id: "medicaid", phase: "Weeks 3–4", title: "Medicaid / CHIP pointers", blurb: "Ask about pregnancy Medicaid or CHIP for your child. Bring ID if you have it." },
    { id: "clinic", phase: "Weeks 3–4", title: "Prenatal or pediatric visit", blurb: "Book (or confirm) a care visit. Write questions beforehand." },
    { id: "birthcert", phase: "Month 2", title: "Birth certificate plan", blurb: "After birth, hospitals often start the form. Ask what you need for a copy." },
    { id: "pediatrician", phase: "Month 2", title: "Choose a pediatrician", blurb: "Ask your center or clinic for names that take your insurance or offer sliding scale." },
    { id: "childcare", phase: "Month 3", title: "Childcare options", blurb: "Ask about waiting lists, church nurseries, or trusted family help." },
    { id: "mentor90", phase: "Any time", title: "Ask for a mentor mom", blurb: "A peer who has been there can walk with you — real people, not a bot." },
    { id: "budget90", phase: "Any time", title: "Open your payday budget", blurb: "Plan this week’s money in the Budget tool — private on your phone." }
  ];

  function ninetyProgress() {
    try { return JSON.parse(localStorage.getItem(NINETY_KEY) || "{}") || {}; }
    catch (e) { return {}; }
  }
  function saveNinety(p) {
    try { localStorage.setItem(NINETY_KEY, JSON.stringify(p)); } catch (e) {}
  }

  function renderNinety() {
    const root = $("ninety-checklist");
    if (!root) return;
    const prog = ninetyProgress();
    const zipInput = $("ninety-zip");
    if (zipInput && !zipInput.value) zipInput.value = readZip();

    const done = NINETY_ITEMS.filter((i) => prog[i.id]).length;
    root.innerHTML = `
      <p class="hint">${done} of ${NINETY_ITEMS.length} checked · saved on this phone</p>
      ${NINETY_ITEMS.map((item) => `
        <label class="check-row">
          <input type="checkbox" data-ninety="${escapeHtml(item.id)}" ${prog[item.id] ? "checked" : ""} />
          <span>
            <span class="check-phase">${escapeHtml(item.phase)}</span>
            <strong>${escapeHtml(item.title)}</strong>
            <span class="check-blurb">${escapeHtml(item.blurb)}</span>
          </span>
        </label>`).join("")}
      <div class="choice-stack" style="margin-top:1.25rem">
        <button type="button" class="btn btn-primary btn-lg" id="ninety-apply">Ask a center to help me apply</button>
        <a class="btn btn-secondary btn-lg" href="#budget" data-nav>Open budget</a>
      </div>`;

    root.querySelectorAll("[data-ninety]").forEach((cb) => {
      cb.addEventListener("change", () => {
        const p = ninetyProgress();
        p[cb.getAttribute("data-ninety")] = cb.checked;
        saveNinety(p);
        renderNinety();
      });
    });
    const applyBtn = $("ninety-apply");
    if (applyBtn) {
      applyBtn.onclick = () => {
        const z = rememberZip((zipInput && zipInput.value) || "");
        goHelp({
          location: z,
          needs: ["new-mom", "apply", "supplies"],
          message: "Hi — I’m in my first months as a mom (or soon will be). Please help me apply for local aid like WIC, SNAP, or Medicaid/CHIP, and tell me about diaper or supply help. Thank you."
        });
      };
    }
    const find = $("ninety-find-help");
    if (find) {
      find.addEventListener("click", () => {
        const z = rememberZip((zipInput && zipInput.value) || "");
        const loc = $("loc-filter");
        if (loc && z) loc.value = z;
      });
    }
  }

  /* ---------- Mentor ---------- */
  function renderMentor() {
    const root = $("mentor-body");
    if (!root) return;
    root.innerHTML = `
      <div class="form-panel support-panel">
        <div class="alert alert-success" role="status">
          <strong>Human mentors only.</strong> We draft a message to nearby pregnancy centers. Volunteers and staff may connect you with a peer mom. There is no AI chat here.
        </div>
        <ul class="plain-list">
          <li>You choose what to share</li>
          <li>Nothing sends until you review it</li>
          <li>Faith talk is optional — say what you prefer</li>
        </ul>
        <div class="field" style="margin:1rem 0">
          <label class="field-label" for="mentor-zip">Your city or ZIP</label>
          <input type="text" id="mentor-zip" class="input input-lg" placeholder="Example: 77002" value="${escapeHtml(readZip())}" />
        </div>
        <button type="button" class="btn btn-primary btn-lg" id="mentor-go">Request a mentor mom</button>
      </div>`;
    $("mentor-go").onclick = () => {
      const z = rememberZip(($("mentor-zip") && $("mentor-zip").value) || "");
      goHelp({
        location: z,
        needs: ["mentor", "talk"],
        message: "Hi — please connect me with a mentor mom or peer volunteer if you have one. I’d like a real person to walk with me (not a chatbot). Thank you."
      });
    };
  }

  /* ---------- Goods ---------- */
  function renderGoods() {
    const root = $("goods-form");
    if (!root) return;
    const items = [
      { id: "diapers", label: "Diapers & wipes" },
      { id: "formula", label: "Formula" },
      { id: "clothes", label: "Baby clothes" },
      { id: "car-seat", label: "Car seat" },
      { id: "supplies", label: "Other baby supplies" }
    ];
    root.innerHTML = `
      <h3 class="support-h3">What do you need?</h3>
      <p class="hint">Select all that apply.</p>
      <div class="checkbox-group" id="goods-checks">
        ${items.map((i) => `<label><input type="checkbox" value="${i.id}" /> ${escapeHtml(i.label)}</label>`).join("")}
      </div>
      <div class="field" style="margin-top:1rem">
        <label class="field-label" for="goods-zip">Your city or ZIP</label>
        <input type="text" id="goods-zip" class="input input-lg" placeholder="Example: 77002" value="${escapeHtml(readZip())}" />
      </div>
      <div class="field" style="margin-top:1rem">
        <label class="field-label" for="goods-note">Optional note</label>
        <textarea id="goods-note" class="input" rows="2" placeholder="Sizes, ages, or anything helpful"></textarea>
      </div>
      <p class="hint">Tip: you can also track money needs in <a href="#budget" data-nav>Budget</a>.</p>
      <button type="button" class="btn btn-primary btn-lg" id="goods-go" style="margin-top:1rem">Draft message to centers</button>
      <p id="goods-err" class="alert alert-error" hidden style="margin-top:0.75rem"></p>`;
    $("goods-go").onclick = () => {
      const selected = [...root.querySelectorAll('#goods-checks input:checked')].map((c) => c.value);
      const err = $("goods-err");
      if (!selected.length) {
        err.hidden = false;
        err.textContent = "Please select at least one item.";
        return;
      }
      err.hidden = true;
      const z = rememberZip(($("goods-zip") && $("goods-zip").value) || "");
      const note = ($("goods-note") && $("goods-note").value.trim()) || "";
      const labels = selected.map((id) => (items.find((i) => i.id === id) || {}).label || id);
      goHelp({
        location: z,
        needs: ["supplies"].concat(selected.filter((x) => x !== "supplies")),
        message: `Hi — I need help with: ${labels.join(", ")}.${note ? " " + note : ""} Please tell me what you can offer. Thank you.`
      });
    };
  }

  /* ---------- Family invite ---------- */
  function inviteText() {
    const base = (location.href || "").split("#")[0];
    return `Hi —

I’m sharing a short note from Hearth & Hope about how you can support me during pregnancy / early parenting.

Ways that help a lot:
• Rides to appointments
• A meal or groceries
• Help with money for diapers or bills (only if you can)
• Coming with me to a visit
• Checking in by text — calm and kind, no pressure

I’m doing my best. Thank you for standing with me.

(App: ${base}#invite)`;
  }

  function renderInvite() {
    const root = $("invite-body");
    if (!root) return;
    root.innerHTML = `
      <div class="form-panel support-panel">
        <h3 class="support-h3">Share this with family or a co-parent</h3>
        <pre class="preview-box invite-preview" id="invite-preview">${escapeHtml(inviteText())}</pre>
        <div class="choice-stack" style="margin-top:1rem">
          <button type="button" class="btn btn-primary btn-lg" id="invite-copy">Copy message</button>
          <button type="button" class="btn btn-secondary btn-lg" id="invite-share">Share…</button>
          <button type="button" class="btn btn-ghost btn-lg" id="invite-sms">Open SMS draft</button>
        </div>
        <p id="invite-status" class="hint" style="margin-top:0.75rem" hidden></p>
      </div>`;
    const status = (msg) => {
      const el = $("invite-status");
      if (!el) return;
      el.hidden = false;
      el.textContent = msg;
    };
    $("invite-copy").onclick = async () => {
      try {
        await navigator.clipboard.writeText(inviteText());
        status("Copied. Paste into a text or email.");
      } catch (e) {
        status("Select the text above and copy it.");
      }
    };
    $("invite-share").onclick = async () => {
      const text = inviteText();
      if (navigator.share) {
        try {
          await navigator.share({ title: "How you can help", text });
          status("Shared.");
          return;
        } catch (e) {}
      }
      try {
        await navigator.clipboard.writeText(text);
        status("Share not available — message copied instead.");
      } catch (e) {
        status("Copy the message above to share.");
      }
    };
    $("invite-sms").onclick = () => {
      location.href = "sms:?&body=" + encodeURIComponent(inviteText());
    };
  }

  /* ---------- Work ---------- */
  function renderWork() {
    const root = $("work-body");
    if (!root) return;
    root.innerHTML = `
      <div class="form-panel support-panel">
        <h3 class="support-h3">Pregnancy and work (U.S. overview)</h3>
        <p class="hint"><strong>Not legal advice.</strong> Rules differ by state and employer.</p>
        <ul class="plain-list">
          <li>Many jobs must give reasonable accommodations for pregnancy (breaks, seating, lifting limits).</li>
          <li>You generally cannot be fired just for being pregnant.</li>
          <li>Leave may include sick leave, FMLA (if you qualify), or state programs.</li>
          <li>Ask HR in writing and keep copies.</li>
        </ul>
        <h3 class="support-h3">Shifts &amp; school tips</h3>
        <ul class="plain-list">
          <li>Tell one trusted supervisor early if safety is an issue.</li>
          <li>Ask about schedule swaps before big appointments.</li>
          <li>Students: campus health or a counselor can help with absences.</li>
        </ul>
        <p>A local pregnancy center can often help you find community resources. We never point to abortion providers.</p>
        <div class="choice-stack" style="margin-top:1rem">
          <a class="btn btn-primary btn-lg" href="#resume" data-nav>Build a resume</a>
          <a class="btn btn-secondary btn-lg" href="#directory" data-nav>Find local help</a>
          <button type="button" class="btn btn-ghost btn-lg" id="work-ask">Ask a center about work help</button>
        </div>
      </div>`;
    $("work-ask").onclick = () => goHelp({
      location: readZip(),
      needs: ["expecting", "talk"],
      message: "Hi — I need practical help with work or school while pregnant (schedule, rights questions, or local resources). Please tell me what support you can offer. Thank you."
    });
  }

  /* ---------- Stories of hope — live public board (real posts only) ---------- */
  const HOPE_NAME_KEY = "hearthHopeDisplayName";
  const HOPE_MAX = 400;
  /* Known audit/test posts on live 1.6.0 until HOPE KV is purged / Worker 1.7.1 DELETE ships */
  const KNOWN_FAKE_HOPE_IDS = {
    e70b300904644437: true, /* prior audit/test */
    "76e52e0f9ca747a1": true, /* 2026-09-23 ext audit clean sample */
    d03e359c39c04db4: true /* 2026-09-23 live 1.6.0 accepted blocked slur — hide until KV purge */
  };
  /* Hide client-supplied absurd future timestamps (e.g. year ~2026+ far ahead) */
  const HOPE_FUTURE_SLACK_MS = 7 * 24 * 60 * 60 * 1000;
  let hopePollTimer = null;

  function isFakeHopePost(id, post) {
    if (KNOWN_FAKE_HOPE_IDS[id]) return true;
    const t = Number(post && post.createdAt) || 0;
    if (t > Date.now() + HOPE_FUTURE_SLACK_MS) return true;
    return false;
  }

  function filterHopePosts(posts) {
    const out = {};
    const src = posts || {};
    Object.keys(src).forEach((id) => {
      const post = src[id];
      if (isFakeHopePost(id, post)) return;
      const check = filterHopeText(post && post.text);
      if (!check.ok) return; /* never show blocked content even if API accepted it */
      out[id] = post;
    });
    return out;
  }

  function hopeRestBase() {
    const c = window.HEARTH_FIREBASE;
    return (c && c.restBaseUrl) ? String(c.restBaseUrl).replace(/\/$/, "") : "";
  }

  /** Strip zero-width / format chars used to evade word filters (ZWSP, ZWNJ, soft hyphen, etc.). */
  function stripHopeNoise(s) {
    return String(s == null ? "" : s)
      .replace(/[\u200B-\u200D\uFEFF\u00AD\u2060\u180E]/g, "")
      .replace(/[\u202A-\u202E\u2066-\u2069]/g, "");
  }

  function filterHopeText(text) {
    /* Ember filterNote caps at 180 chars — only reuse its blocked patterns, not length. */
    const cleaned = stripHopeNoise(text);
    if (window.HearthBeacon && typeof HearthBeacon.filterNote === "function") {
      const sample = cleaned.trim().replace(/\s+/g, " ").slice(0, 180);
      const r = HearthBeacon.filterNote(sample);
      if (!r.ok && r.reason === "blocked") return { ok: false, reason: "blocked" };
    }
    let t = cleaned.trim().replace(/\s+/g, " ");
    if (!t) return { ok: false, reason: "empty" };
    if (t.length > HOPE_MAX) return { ok: false, reason: "long" };
    /* Compact form catches spaced / dotted / leetspeak fuck morphs: "f u c k", "f.u.c.k", "fvck" */
    const compact = t.toLowerCase().replace(/[\s.\-*_/\\|'"´`]+/g, "");
    if (/f[u*v]+c+k/.test(compact) || /phuck/.test(compact)) {
      return { ok: false, reason: "blocked" };
    }
    const BLOCK = [
      /\b(kill|murder|rape|suicide|kms|kys|die\s*bitch|hurt\s*you|stalk|bomb|shoot)\b/i,
      /\b(fuck\w*|shit|bitch|asshole|cunt|slut|whore|nigg|faggot|retard)\b/i,
      /\b(sex|sexy|nude|porn|onlyfans)\b/i,
      /\b(kill\s*yourself|hang\s*yourself|cut\s*yourself)\b/i,
      /\b(https?:\/\/|www\.|\.com\b|\.net\b|\.org\b)/i,
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
      /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/,
      /(?:^|\s)@[a-z0-9_]{3,}/i,
      /\b(snapchat|instagram|tiktok|discord|telegram|whatsapp|dm\s*me|text\s*me|call\s*me)\b/i
    ];
    for (let i = 0; i < BLOCK.length; i++) {
      if (BLOCK[i].test(t)) return { ok: false, reason: "blocked" };
    }
    return { ok: true, text: t };
  }

  function sanitizeHopeName(name) {
    let n = String(name || "").trim().replace(/\s+/g, " ").slice(0, 24);
    if (!n) return "A mom";
    const check = filterHopeText(n);
    if (!check.ok) return "A mom";
    /* first-name-ish only — no emails/handles */
    if (/[@./]/.test(n) || /\d{3}/.test(n)) return "A mom";
    return n;
  }

  function renderHopeList(posts) {
    const list = $("hope-list");
    if (!list) return;
    const items = Object.keys(posts || {}).map((k) => Object.assign({ id: k }, posts[k]));
    items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (!items.length) {
      list.innerHTML = `<p class="hint hope-empty">No stories yet — share yours when you’re ready.</p>`;
      return;
    }
    list.innerHTML = items.slice(0, 80).map((p) => {
      const when = p.createdAt ? new Date(p.createdAt).toLocaleString() : "";
      return `<article class="story-card hope-card">
        <p>${escapeHtml(p.text || "")}</p>
        <p class="meta">${escapeHtml(p.fromLabel || "A mom")}${when ? " · " + escapeHtml(when) : ""}</p>
      </article>`;
    }).join("");
  }

  function loadHopePosts() {
    const base = hopeRestBase();
    const list = $("hope-list");
    if (!base) {
      if (list) list.innerHTML = `<p class="hint">The hope board needs a live connection. Try again soon.</p>`;
      return;
    }
    fetch(base + "/hope")
      .then((r) => r.json())
      .then((val) => renderHopeList(filterHopePosts(val || {})))
      .catch(() => {
        if (list) list.innerHTML = `<p class="hint">Could not load the board right now.</p>`;
      });
  }

  function postHopeMessage() {
    const ta = $("hope-text");
    const nameEl = $("hope-name");
    const fb = $("hope-feedback");
    const checked = filterHopeText(ta ? ta.value : "");
    if (!checked.ok) {
      if (fb) fb.textContent = "That couldn’t be posted. Try a kind word instead.";
      return;
    }
    const fromLabel = sanitizeHopeName(nameEl ? nameEl.value : "");
    try {
      if (nameEl && nameEl.value.trim()) localStorage.setItem(HOPE_NAME_KEY, nameEl.value.trim().slice(0, 24));
    } catch (e) {}
    const base = hopeRestBase();
    if (!base) {
      if (fb) fb.textContent = "The hope board needs a live connection.";
      return;
    }
    const body = {
      text: checked.text,
      createdAt: Date.now(),
      fromLabel
    };
    fetch(base + "/hope", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
      .then((r) => {
        if (!r.ok) throw new Error("blocked");
        return r.json();
      })
      .then(() => {
        if (fb) fb.textContent = "Posted — thank you for sharing.";
        if (ta) ta.value = "";
        loadHopePosts();
      })
      .catch(() => {
        if (fb) fb.textContent = "That couldn’t be posted. Try a kind word instead.";
      });
  }

  function renderStories() {
    const root = $("stories-body");
    if (!root) return;
    let savedName = "";
    try { savedName = localStorage.getItem(HOPE_NAME_KEY) || ""; } catch (e) {}

    root.innerHTML = `
      <div class="form-panel support-panel hope-compose">
        <h3 class="support-h3">Share a real note of hope</h3>
        <p class="hint">Public board for moms. Be kind. No names required. No contact info, links, or threats.</p>
        <label class="field">
          <span>Display name (optional — default “A mom”)</span>
          <input type="text" id="hope-name" class="search-input" maxlength="24" placeholder="A mom" value="${escapeHtml(savedName)}" autocomplete="nickname" />
        </label>
        <label class="field">
          <span>Your message (max ${HOPE_MAX} characters)</span>
          <textarea id="hope-text" rows="4" maxlength="${HOPE_MAX}" placeholder="Something true that might help another mom…"></textarea>
        </label>
        <div class="btn-row">
          <button type="button" class="btn btn-primary" id="hope-post">Post to the board</button>
        </div>
        <p id="hope-feedback" class="hint" role="status"></p>
      </div>
      <h3 class="support-h3" style="margin-top:1.5rem">Recent messages</h3>
      <div id="hope-list" class="stories-list" aria-live="polite">
        <p class="hint">Loading…</p>
      </div>`;

    const postBtn = $("hope-post");
    if (postBtn) postBtn.onclick = postHopeMessage;
    loadHopePosts();
    if (hopePollTimer) clearInterval(hopePollTimer);
    hopePollTimer = setInterval(loadHopePosts, 8000);
  }

  /* ---------- Resume + job email templates ---------- */
  function defaultResume() {
    return {
      name: "",
      contact: "",
      summary: "",
      experience: "",
      skills: "",
      education: "",
      care: ""
    };
  }
  function loadResume() {
    try {
      return Object.assign(defaultResume(), JSON.parse(localStorage.getItem(RESUME_KEY) || "{}"));
    } catch (e) {
      return defaultResume();
    }
  }
  function saveResume(r) {
    try { localStorage.setItem(RESUME_KEY, JSON.stringify(r)); } catch (e) {}
  }

  function formatResume(r) {
    const lines = [];
    lines.push((r.name || "Your name").trim());
    if (r.contact) lines.push(r.contact.trim());
    lines.push("");
    if (r.summary) {
      lines.push("SUMMARY");
      lines.push(r.summary.trim());
      lines.push("");
    }
    if (r.care) {
      lines.push("CAREGIVING & SERVICE");
      lines.push(r.care.trim());
      lines.push("");
    }
    if (r.experience) {
      lines.push("EXPERIENCE");
      lines.push(r.experience.trim());
      lines.push("");
    }
    if (r.skills) {
      lines.push("SKILLS");
      lines.push(r.skills.trim());
      lines.push("");
    }
    if (r.education) {
      lines.push("EDUCATION");
      lines.push(r.education.trim());
    }
    return lines.join("\n").trim() + "\n";
  }

  const EMAIL_TEMPLATES = [
    {
      id: "first",
      title: "First job ask",
      subject: "Application for {{role}} at {{company}}",
      body: `Dear Hiring Manager,

My name is {{name}}. I’m applying for the {{role}} role at {{company}}.

I’m dependable, willing to learn, and ready to work hard. I’d be grateful for a chance to interview.

Thank you for your time,
{{name}}`
    },
    {
      id: "retail",
      title: "Retail / service",
      subject: "{{role}} application — {{name}}",
      body: `Hello,

I’m {{name}}, and I’d like to apply for {{role}} at {{company}}.

I bring a friendly attitude, reliability, and experience caring for others. I’m available for flexible shifts and happy to learn your systems quickly.

Thank you,
{{name}}`
    },
    {
      id: "office",
      title: "Office / remote",
      subject: "Interest in {{role}} — {{name}}",
      body: `Dear {{company}} team,

I’m {{name}}. I’m writing to apply for {{role}}.

I organize well, communicate clearly, and stay calm under pressure. I’m comfortable with basic computer tools and eager to grow.

I look forward to hearing from you,
{{name}}`
    },
    {
      id: "change",
      title: "Career change",
      subject: "Application for {{role}} at {{company}}",
      body: `Dear Hiring Manager,

I’m {{name}}. I’m excited to apply for {{role}} at {{company}} as I grow into a new chapter.

My background includes real responsibility — including caregiving and community work — which taught me patience, problem-solving, and follow-through. I’m ready to bring that same care to your team.

Thank you for considering me,
{{name}}`
    },
    {
      id: "follow",
      title: "Follow up after applying",
      subject: "Following up — {{role}} application",
      body: `Hello,

I’m {{name}}. I recently applied for {{role}} at {{company}} and wanted to kindly follow up.

I remain very interested and am happy to provide any other information.

Thank you,
{{name}}`
    }
  ];

  function fillTemplate(str, map) {
    return str.replace(/\{\{(\w+)\}\}/g, (_, k) => map[k] || ("[" + k + "]"));
  }

  function renderResume() {
    const root = $("resume-body");
    if (!root) return;
    const r = loadResume();
    root.innerHTML = `
      <div class="form-panel support-panel">
        <p class="step-pill">Resume</p>
        <p class="hint">Caregiving and volunteering count. Gaps are okay — no shame.</p>
        <div class="field"><label class="field-label" for="res-name">Full name</label>
          <input class="input input-lg" id="res-name" value="${escapeHtml(r.name)}" autocomplete="name" /></div>
        <div class="field"><label class="field-label" for="res-contact">Phone or email</label>
          <input class="input input-lg" id="res-contact" value="${escapeHtml(r.contact)}" placeholder="555-555-0100 · you@email.com" /></div>
        <div class="field"><label class="field-label" for="res-summary">Short summary</label>
          <textarea class="input" id="res-summary" rows="2" placeholder="Reliable mom looking for steady work…">${escapeHtml(r.summary)}</textarea></div>
        <div class="field"><label class="field-label" for="res-care">Caregiving &amp; volunteering</label>
          <textarea class="input" id="res-care" rows="3" placeholder="Full-time caregiver for infant · Church nursery volunteer…">${escapeHtml(r.care)}</textarea></div>
        <div class="field"><label class="field-label" for="res-exp">Work history</label>
          <textarea class="input" id="res-exp" rows="3" placeholder="Store Associate, 2022–2024 — cashier, stocking…">${escapeHtml(r.experience)}</textarea></div>
        <div class="field"><label class="field-label" for="res-skills">Skills</label>
          <input class="input input-lg" id="res-skills" value="${escapeHtml(r.skills)}" placeholder="Customer service, scheduling, bilingual…" /></div>
        <div class="field"><label class="field-label" for="res-edu">Education</label>
          <input class="input input-lg" id="res-edu" value="${escapeHtml(r.education)}" placeholder="High school diploma · Some college…" /></div>
        <div class="choice-stack" style="margin-top:1rem">
          <button type="button" class="btn btn-primary btn-lg" id="res-copy">Copy resume</button>
          <button type="button" class="btn btn-secondary btn-lg" id="res-download">Download .txt</button>
          <button type="button" class="btn btn-ghost btn-lg" id="res-print">Printable view</button>
        </div>
        <p id="res-status" class="hint" style="margin-top:0.5rem" hidden></p>
        <pre class="preview-box" id="res-preview" style="margin-top:1rem"></pre>
      </div>

      <div class="form-panel support-panel" style="margin-top:1.5rem">
        <p class="step-pill">Job email templates</p>
        <p class="hint">Fill a few blanks → Copy or Send email.</p>
        <div class="form-grid two">
          <div class="field"><label class="field-label" for="job-name">Your name</label>
            <input class="input input-lg" id="job-name" value="${escapeHtml(r.name)}" /></div>
          <div class="field"><label class="field-label" for="job-role">Job title</label>
            <input class="input input-lg" id="job-role" placeholder="Cashier" /></div>
        </div>
        <div class="field"><label class="field-label" for="job-company">Company</label>
          <input class="input input-lg" id="job-company" placeholder="Store or office name" /></div>
        <label class="field-label" for="job-tpl">Template</label>
        <select id="job-tpl" class="select-input input-lg">
          ${EMAIL_TEMPLATES.map((t) => `<option value="${t.id}">${escapeHtml(t.title)}</option>`).join("")}
        </select>
        <pre class="preview-box" id="job-preview" style="margin-top:1rem"></pre>
        <div class="choice-stack" style="margin-top:1rem">
          <button type="button" class="btn btn-primary btn-lg" id="job-copy">Copy email</button>
          <button type="button" class="btn btn-secondary btn-lg" id="job-mail">Send email</button>
        </div>
        <p id="job-status" class="hint" style="margin-top:0.5rem" hidden></p>
      </div>`;

    function gather() {
      return {
        name: $("res-name").value,
        contact: $("res-contact").value,
        summary: $("res-summary").value,
        care: $("res-care").value,
        experience: $("res-exp").value,
        skills: $("res-skills").value,
        education: $("res-edu").value
      };
    }
    function refreshPreview() {
      const data = gather();
      saveResume(data);
      $("res-preview").textContent = formatResume(data);
      if ($("job-name") && !$("job-name").dataset.touched) {
        /* keep in sync until user edits job name */
      }
      refreshJob();
    }
    function jobMap() {
      return {
        name: ($("job-name") && $("job-name").value.trim()) || ($("res-name") && $("res-name").value.trim()) || "Your name",
        role: ($("job-role") && $("job-role").value.trim()) || "the open role",
        company: ($("job-company") && $("job-company").value.trim()) || "your company"
      };
    }
    function currentTpl() {
      const id = $("job-tpl").value;
      return EMAIL_TEMPLATES.find((t) => t.id === id) || EMAIL_TEMPLATES[0];
    }
    function refreshJob() {
      const t = currentTpl();
      const m = jobMap();
      const subject = fillTemplate(t.subject, m);
      const body = fillTemplate(t.body, m);
      $("job-preview").textContent = "Subject: " + subject + "\n\n" + body;
      $("job-preview")._mail = { subject, body };
    }

    ["res-name", "res-contact", "res-summary", "res-care", "res-exp", "res-skills", "res-edu"].forEach((id) => {
      const el = $(id);
      if (el) el.addEventListener("input", refreshPreview);
    });
    ["job-name", "job-role", "job-company", "job-tpl"].forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener("input", refreshJob);
      el.addEventListener("change", refreshJob);
    });
    if ($("job-name")) {
      $("job-name").addEventListener("input", () => { $("job-name").dataset.touched = "1"; });
    }

    $("res-copy").onclick = async () => {
      const text = formatResume(gather());
      try {
        await navigator.clipboard.writeText(text);
        $("res-status").hidden = false;
        $("res-status").textContent = "Resume copied.";
      } catch (e) {
        $("res-status").hidden = false;
        $("res-status").textContent = "Select the preview and copy.";
      }
    };
    $("res-download").onclick = () => {
      const text = formatResume(gather());
      const blob = new Blob([text], { type: "text/plain" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "hearth-hope-resume.txt";
      a.click();
      URL.revokeObjectURL(a.href);
      $("res-status").hidden = false;
      $("res-status").textContent = "Download started.";
    };
    $("res-print").onclick = () => {
      const text = formatResume(gather());
      const w = window.open("", "_blank");
      if (!w) return;
      w.document.write(`<!DOCTYPE html><html><head><title>Resume</title>
        <style>body{font-family:Georgia,serif;max-width:40rem;margin:2rem auto;padding:1rem;white-space:pre-wrap;line-height:1.45}</style>
        </head><body>${escapeHtml(text)}</body></html>`);
      w.document.close();
      w.focus();
      w.print();
    };
    $("job-copy").onclick = async () => {
      const mail = $("job-preview")._mail;
      const text = "Subject: " + mail.subject + "\n\n" + mail.body;
      try {
        await navigator.clipboard.writeText(text);
        $("job-status").hidden = false;
        $("job-status").textContent = "Email copied.";
      } catch (e) {
        $("job-status").hidden = false;
        $("job-status").textContent = "Select the preview and copy.";
      }
    };
    $("job-mail").onclick = () => {
      const mail = $("job-preview")._mail;
      location.href = "mailto:?subject=" + encodeURIComponent(mail.subject) + "&body=" + encodeURIComponent(mail.body);
    };

    refreshPreview();
  }

  /* ---------- Route hook ---------- */
  const renderers = {
    crisis: renderCrisis,
    ultrasound: renderUltrasound,
    ninety: renderNinety,
    mentor: renderMentor,
    goods: renderGoods,
    invite: renderInvite,
    work: renderWork,
    stories: renderStories,
    resume: renderResume
  };

  function onRoute() {
    const id = (location.hash || "").replace(/^#/, "") || "home";
    if (renderers[id]) renderers[id]();
  }

  window.addEventListener("hashchange", onRoute);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onRoute);
  } else {
    onRoute();
  }

  window.HearthSupport = { renderCrisis, renderResume, goHelp, stories: renderStories };
})();
