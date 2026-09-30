/* Heart & Hope — Payday Budget
   Wednesday–Tuesday weeks (America/New_York). Persist localStorage.
   Empty starter template — no personal bills shipped.
*/
(function () {
  "use strict";

  const STORAGE_KEY = "heartHopeBudget_v1";
  const TZ = "America/New_York";
  const CATEGORIES = ["Rent", "Food", "Baby", "Bills", "Debt", "Other"];
  /* Map legacy categories into the simplified set */
  const CATEGORY_MAP = {
    Phone: "Bills",
    Transit: "Bills",
    Reserve: "Other",
    Cushion: "Other"
  };
  /* current + this many upcoming Wednesdays */
  const UPCOMING_COUNT = 6;

  const root = document.getElementById("view-budget");
  if (!root) return;

  let state = null;
  let dirty = false;
  let saveTimer = null;
  let activeTab = "current"; /* current | archived */
  let expandedWeekId = null;

  /* ---------- Time helpers (NY) ---------- */
  function nyParts(d) {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short"
    });
    const parts = {};
    fmt.formatToParts(d).forEach((p) => {
      if (p.type !== "literal") parts[p.type] = p.value;
    });
    return parts;
  }

  function toYmd(d) {
    const p = nyParts(d);
    return p.year + "-" + p.month + "-" + p.day;
  }

  function parseYmd(ymd) {
    /* Noon UTC avoids DST edge when interpreting calendar day */
    const [y, m, d] = ymd.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d, 16, 0, 0));
  }

  function addDaysYmd(ymd, days) {
    const dt = parseYmd(ymd);
    dt.setUTCDate(dt.getUTCDate() + days);
    return toYmd(dt);
  }

  function weekdayShort(ymd) {
    return nyParts(parseYmd(ymd)).weekday;
  }

  /** Most recent Wednesday on or before "today" in NY. */
  function currentWednesdayYmd(now) {
    let ymd = toYmd(now || new Date());
    for (let i = 0; i < 7; i++) {
      if (weekdayShort(ymd) === "Wed") return ymd;
      ymd = addDaysYmd(ymd, -1);
    }
    return ymd;
  }

  function formatWeekRange(startYmd) {
    const endYmd = addDaysYmd(startYmd, 6); /* Tue */
    const opts = { month: "short", day: "numeric", timeZone: TZ };
    const start = parseYmd(startYmd);
    const end = parseYmd(endYmd);
    const a = start.toLocaleDateString("en-US", opts);
    const b = end.toLocaleDateString("en-US", Object.assign({}, opts, { year: "numeric" }));
    return a + " – " + b;
  }

  function formatShortDate(ymd) {
    return parseYmd(ymd).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: TZ
    });
  }

  /* ---------- Money ---------- */
  function formatCents(cents) {
    const n = (Number(cents) || 0) / 100;
    return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
  }

  function dollarsToCents(raw) {
    const s = String(raw == null ? "" : raw).trim().replace(/[$,\s]/g, "");
    if (!s) return 0;
    const n = Number(s);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 100);
  }

  function centsToDollarInput(cents) {
    return ((Number(cents) || 0) / 100).toFixed(2);
  }

  function normalizeCategory(cat) {
    const raw = String(cat || "").trim();
    if (CATEGORIES.includes(raw)) return raw;
    if (CATEGORY_MAP[raw]) return CATEGORY_MAP[raw];
    return "Other";
  }

  /* ---------- State ---------- */
  function nextWeekId(weeks) {
    let max = -1;
    weeks.forEach((w) => {
      const n = parseInt(w.id, 10);
      if (Number.isFinite(n) && n > max) max = n;
    });
    return String(max + 1);
  }

  function nextItemId(week) {
    let max = -1;
    (week.items || []).forEach((it) => {
      const parts = String(it.id).split("-");
      const n = parseInt(parts[parts.length - 1], 10);
      if (Number.isFinite(n) && n > max) max = n;
    });
    return week.id + "-" + (max + 1);
  }

  function emptyState() {
    const start = currentWednesdayYmd(new Date());
    const weeks = [];
    for (let i = 0; i <= UPCOMING_COUNT; i++) {
      weeks.push({
        id: String(i),
        date: addDaysYmd(start, i * 7),
        income: null,
        items: [],
        archived: false
      });
    }
    return { pay: 0, opening: 0, weeks: weeks };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyState();
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.weeks)) return emptyState();
      parsed.pay = Number(parsed.pay) || 0;
      parsed.opening = Number(parsed.opening) || 0;
      parsed.weeks = parsed.weeks.map((w) => ({
        id: String(w.id),
        date: w.date,
        /* Keep field for compatibility; income overrides are ignored in math/UI */
        income: null,
        archived: !!w.archived,
        items: Array.isArray(w.items)
          ? w.items.map((it) => ({
              id: String(it.id),
              name: String(it.name || ""),
              amount: Number(it.amount) || 0,
              category: normalizeCategory(it.category),
              done: !!it.done,
              recurring: it.recurring !== false
            }))
          : []
      }));
      return parsed;
    } catch (e) {
      console.warn("Budget load failed, starting fresh", e);
      return emptyState();
    }
  }

  function persist(immediate) {
    function write() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        dirty = false;
        updateSaveUI();
      } catch (e) {
        console.warn("Budget save failed", e);
        setSaveStatus("Couldn’t save", true);
      }
    }
    dirty = true;
    updateSaveUI();
    if (saveTimer) clearTimeout(saveTimer);
    if (immediate) {
      write();
    } else {
      saveTimer = setTimeout(write, 400);
    }
  }

  /** Always weekly take-home — paycheck overrides removed from UI/math. */
  function weekIncome(_week) {
    return Number(state.pay) || 0;
  }

  function weekAllocated(week) {
    return (week.items || []).reduce((s, it) => s + (Number(it.amount) || 0), 0);
  }

  function weekLeftover(week) {
    return weekIncome(week) - weekAllocated(week);
  }

  function weekHandled(week) {
    const items = week.items || [];
    const done = items.filter((it) => it.done).length;
    return { done: done, total: items.length };
  }

  /** Archive past Wednesdays; ensure current + ~6 upcoming exist. */
  function syncWeeks() {
    const cur = currentWednesdayYmd(new Date());
    state.weeks.forEach((w) => {
      if (w.date < cur) w.archived = true;
      else w.archived = false;
      /* Normalize: never use per-week income override */
      w.income = null;
    });

    const byDate = new Map(state.weeks.map((w) => [w.date, w]));
    const needed = [];
    for (let i = 0; i <= UPCOMING_COUNT; i++) {
      needed.push(addDaysYmd(cur, i * 7));
    }

    needed.forEach((ymd) => {
      if (byDate.has(ymd)) return;
      const prevDate = addDaysYmd(ymd, -7);
      const prev = byDate.get(prevDate);
      const id = nextWeekId(state.weeks);
      const items = [];
      if (prev) {
        (prev.items || []).forEach((it) => {
          if (it.recurring === false) return;
          items.push({
            id: id + "-" + items.length,
            name: it.name,
            amount: it.amount,
            category: normalizeCategory(it.category),
            done: false,
            recurring: true
          });
        });
      }
      const week = { id: id, date: ymd, income: null, items: items, archived: false };
      state.weeks.push(week);
      byDate.set(ymd, week);
    });

    state.weeks.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }

  function visibleWeeks() {
    return state.weeks.filter((w) => !w.archived);
  }

  function archivedWeeks() {
    return state.weeks.filter((w) => w.archived).slice().reverse();
  }

  /* ---------- Save indicator ---------- */
  function setSaveStatus(text, isError) {
    const el = root.querySelector("[data-budget-save-status]");
    if (!el) return;
    el.textContent = text;
    el.classList.toggle("budget-save-error", !!isError);
  }

  function updateSaveUI() {
    if (dirty) {
      setSaveStatus("Saving…");
    } else {
      setSaveStatus("Saved");
    }
  }

  /* ---------- Render ---------- */
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function categoryOptions(selected) {
    return CATEGORIES.map(
      (c) =>
        `<option value="${escapeHtml(c)}"${c === selected ? " selected" : ""}>${escapeHtml(c)}</option>`
    ).join("");
  }

  function weekOptions(selectedId) {
    return visibleWeeks()
      .map((w) => {
        const label = formatShortDate(w.date) + " paycheck";
        return `<option value="${escapeHtml(w.id)}"${w.id === selectedId ? " selected" : ""}>${escapeHtml(label)}</option>`;
      })
      .join("");
  }

  function renderPaySettings() {
    return `
      <div class="budget-settings budget-paycheck form-panel">
        <h3>Your paycheck</h3>
        <div class="form-grid two">
          <div class="field">
            <label for="budget-pay">Weekly take-home ($)</label>
            <input class="input input-lg" type="number" inputmode="decimal" step="0.01" min="0" id="budget-pay" value="${centsToDollarInput(state.pay)}" />
          </div>
          <div class="field">
            <label for="budget-opening">Starting cash ($)</label>
            <input class="input input-lg" type="number" inputmode="decimal" step="0.01" min="0" id="budget-opening" value="${centsToDollarInput(state.opening)}" />
          </div>
        </div>
        <p class="hint" style="margin-top:0.65rem;margin-bottom:0">Applies to every Wednesday. Stays on this device.</p>
      </div>`;
  }

  function renderDashboard(weeks) {
    const paySum = weeks.reduce((s, w) => s + weekIncome(w), 0);
    const allocSum = weeks.reduce((s, w) => s + weekAllocated(w), 0);
    const left = (Number(state.opening) || 0) + paySum - allocSum;
    const payCount = weeks.length;
    return `
      <div class="budget-dash">
        <div class="budget-dash-main">
          <p class="budget-dash-label">Planned money left</p>
          <p class="budget-dash-value">${formatCents(left)}</p>
          <p class="budget-dash-sub">${state.opening ? "Includes starting cash." : "After your plan for these weeks."}</p>
        </div>
        <div class="budget-dash-side">
          <div class="budget-stat">
            <p class="budget-dash-label">Take-home</p>
            <p class="budget-stat-value">${formatCents(paySum)}</p>
            <p class="budget-dash-sub">${payCount} paycheck${payCount === 1 ? "" : "s"}</p>
          </div>
          <div class="budget-stat">
            <p class="budget-dash-label">Allocated</p>
            <p class="budget-stat-value">${formatCents(allocSum)}</p>
            <p class="budget-dash-sub">Bills &amp; essentials</p>
          </div>
        </div>
      </div>`;
  }

  function renderItemRow(week, item) {
    return `
      <li class="budget-item${item.done ? " is-done" : ""}" data-item-id="${escapeHtml(item.id)}">
        <label class="budget-check">
          <input type="checkbox" data-budget-toggle="${escapeHtml(week.id)}" data-item-id="${escapeHtml(item.id)}" ${item.done ? "checked" : ""} />
          <span class="budget-item-body">
            <button type="button" class="budget-item-name-btn" data-budget-edit-item="${escapeHtml(week.id)}" data-item-id="${escapeHtml(item.id)}">${escapeHtml(item.name || "Untitled")}</button>
            <span class="budget-item-meta">
              <span class="budget-cat">${escapeHtml(item.category || "Other")}</span>
              ${item.recurring === false ? '<span class="budget-once">One-time</span>' : ""}
            </span>
          </span>
        </label>
        <div class="budget-item-right">
          <span class="budget-item-amt">${formatCents(item.amount)}</span>
          <button type="button" class="budget-text-btn" data-budget-edit-item="${escapeHtml(week.id)}" data-item-id="${escapeHtml(item.id)}">Edit</button>
          <button type="button" class="budget-text-btn danger" data-budget-del-item="${escapeHtml(week.id)}" data-item-id="${escapeHtml(item.id)}">Remove</button>
        </div>
      </li>`;
  }

  function renderWeekCard(week, expanded) {
    const handled = weekHandled(week);
    const left = weekLeftover(week);
    const itemsHtml =
      (week.items || []).length === 0
        ? `<p class="budget-empty-hint">No bills yet. Tap <strong>+ Add bill</strong> to start.</p>`
        : `<ul class="budget-item-list">${(week.items || []).map((it) => renderItemRow(week, it)).join("")}</ul>`;

    return `
      <article class="budget-week${expanded ? " is-open" : ""}" data-week-id="${escapeHtml(week.id)}">
        <button type="button" class="budget-week-head" data-budget-expand="${escapeHtml(week.id)}" aria-expanded="${expanded ? "true" : "false"}">
          <div>
            <p class="budget-week-date">${escapeHtml(formatShortDate(week.date))}</p>
            <p class="budget-week-range">${escapeHtml(formatWeekRange(week.date))}</p>
          </div>
          <div class="budget-week-summary">
            <p class="budget-week-left">${formatCents(left)} <span>left</span></p>
            <p class="budget-week-handled">${handled.done}/${handled.total} paid</p>
          </div>
        </button>
        ${expanded ? `<div class="budget-week-body">${itemsHtml}</div>` : ""}
      </article>`;
  }

  function renderModal() {
    return `
      <div class="budget-modal" id="budget-modal" hidden>
        <div class="budget-modal-backdrop" data-budget-modal-close></div>
        <div class="budget-modal-panel" role="dialog" aria-modal="true" aria-labelledby="budget-modal-title">
          <h3 id="budget-modal-title">Add bill</h3>
          <form id="budget-item-form" class="budget-form" novalidate>
            <input type="hidden" name="editWeekId" value="" />
            <input type="hidden" name="editItemId" value="" />
            <div class="field">
              <label for="budget-item-name">Name</label>
              <input class="input input-lg" id="budget-item-name" name="name" required placeholder="e.g. Groceries" autocomplete="off" />
            </div>
            <div class="field">
              <label for="budget-item-amount">Amount (dollars)</label>
              <input class="input input-lg" id="budget-item-amount" name="amount" type="number" inputmode="decimal" step="0.01" min="0" required placeholder="0.00" />
            </div>
            <div class="field">
              <label for="budget-item-category">Category</label>
              <select class="select-input input-lg" id="budget-item-category" name="category">${categoryOptions("Other")}</select>
            </div>
            <div class="field">
              <label for="budget-item-week">Which week</label>
              <select class="select-input input-lg" id="budget-item-week" name="weekId"></select>
            </div>
            <label class="budget-check-row">
              <input type="checkbox" id="budget-item-recurring" name="recurring" checked />
              <span>Comes back each payday <span class="hint">(uncheck for one-time)</span></span>
            </label>
            <div class="form-actions" style="margin-top:1rem">
              <button type="submit" class="btn btn-primary btn-lg">Save</button>
              <button type="button" class="btn btn-ghost btn-lg" data-budget-modal-close>Cancel</button>
            </div>
          </form>
        </div>
      </div>`;
  }

  function render() {
    syncWeeks();
    const weeks = activeTab === "archived" ? archivedWeeks() : visibleWeeks();
    const archivedCount = archivedWeeks().length;

    if (!expandedWeekId && activeTab === "current" && weeks.length) {
      expandedWeekId = weeks[0].id;
    }
    if (expandedWeekId && !weeks.some((w) => w.id === expandedWeekId)) {
      expandedWeekId = weeks[0] ? weeks[0].id : null;
    }

    root.innerHTML = `
      <div class="section-head budget-head">
        <div>
          <p class="hero-eyebrow">Payday budget</p>
          <h2>Budget</h2>
          <p>Plan this week’s money. Mark bills paid. See what’s left.</p>
        </div>
        <div class="budget-save-row">
          <span class="budget-save-status" data-budget-save-status>Saved</span>
        </div>
      </div>

      ${activeTab === "current" ? renderPaySettings() : ""}

      <div class="budget-actions">
        <button type="button" class="btn btn-primary btn-lg" data-budget-add ${activeTab === "archived" ? "disabled" : ""}>+ Add bill</button>
      </div>

      <div class="budget-tabs" role="tablist" aria-label="Budget periods">
        <button type="button" role="tab" class="budget-tab${activeTab === "current" ? " active" : ""}" data-budget-tab="current" aria-selected="${activeTab === "current"}">This payday</button>
        <button type="button" role="tab" class="budget-tab${activeTab === "archived" ? " active" : ""}" data-budget-tab="archived" aria-selected="${activeTab === "archived"}">Past${archivedCount ? " (" + archivedCount + ")" : ""}</button>
      </div>

      ${activeTab === "current" ? renderDashboard(weeks) : ""}

      <div class="budget-week-list">
        ${
          weeks.length
            ? weeks.map((w) => renderWeekCard(w, w.id === expandedWeekId)).join("")
            : `<div class="empty-state">${activeTab === "archived" ? "No past weeks yet." : "Add your first bill."}</div>`
        }
      </div>

      ${renderModal()}
    `;

    updateSaveUI();
    wireDom();
  }

  function findWeek(id) {
    return state.weeks.find((w) => w.id === id);
  }

  function findItem(week, itemId) {
    return (week.items || []).find((it) => it.id === itemId);
  }

  function openModal(opts) {
    const modal = root.querySelector("#budget-modal");
    const form = root.querySelector("#budget-item-form");
    if (!modal || !form) return;
    const title = root.querySelector("#budget-modal-title");
    const weekSelect = form.querySelector('[name="weekId"]');
    const defaultWeek =
      opts.weekId ||
      expandedWeekId ||
      (visibleWeeks()[0] && visibleWeeks()[0].id) ||
      "";

    weekSelect.innerHTML = weekOptions(defaultWeek);
    form.name.value = opts.name || "";
    form.amount.value = opts.amount != null ? centsToDollarInput(opts.amount) : "";
    form.category.value = normalizeCategory(opts.category || "Food");
    form.recurring.checked = opts.recurring !== false;
    form.editWeekId.value = opts.editWeekId || "";
    form.editItemId.value = opts.editItemId || "";
    if (title) title.textContent = opts.editItemId ? "Edit bill" : "Add bill";

    if (!opts.editItemId && !opts.category) form.category.value = "Food";

    modal.hidden = false;
    form.name.focus();
  }

  function closeModal() {
    const modal = root.querySelector("#budget-modal");
    if (modal) modal.hidden = true;
  }

  function wireDom() {
    root.querySelectorAll("[data-budget-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeTab = btn.getAttribute("data-budget-tab");
        expandedWeekId = null;
        render();
      });
    });

    root.querySelector("[data-budget-add]")?.addEventListener("click", () => {
      openModal({ recurring: true });
    });

    root.querySelectorAll("[data-budget-modal-close]").forEach((el) => {
      el.addEventListener("click", closeModal);
    });

    root.querySelector("#budget-item-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const form = e.target;
      const name = (form.name.value || "").trim();
      const amount = dollarsToCents(form.amount.value);
      const category = normalizeCategory(form.category.value || "Other");
      const weekId = form.weekId.value;
      const recurring = !!form.recurring.checked;
      const editWeekId = form.editWeekId.value;
      const editItemId = form.editItemId.value;

      if (!name) {
        form.name.focus();
        return;
      }
      if (amount < 0) return;

      if (editWeekId && editItemId) {
        const oldWeek = findWeek(editWeekId);
        const item = oldWeek && findItem(oldWeek, editItemId);
        if (!item) return;
        if (weekId !== editWeekId) {
          oldWeek.items = oldWeek.items.filter((it) => it.id !== editItemId);
          const newWeek = findWeek(weekId);
          if (!newWeek) return;
          const moved = {
            id: nextItemId(newWeek),
            name: name,
            amount: amount,
            category: category,
            done: item.done,
            recurring: recurring
          };
          newWeek.items.push(moved);
          expandedWeekId = newWeek.id;
        } else {
          item.name = name;
          item.amount = amount;
          item.category = category;
          item.recurring = recurring;
          expandedWeekId = oldWeek.id;
        }
      } else {
        const week = findWeek(weekId);
        if (!week) return;
        week.items.push({
          id: nextItemId(week),
          name: name,
          amount: amount,
          category: category,
          done: false,
          recurring: recurring
        });
        expandedWeekId = week.id;
      }
      activeTab = "current";
      closeModal();
      persist(false);
      render();
    });

    root.querySelectorAll("[data-budget-expand]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-budget-expand");
        expandedWeekId = expandedWeekId === id ? null : id;
        render();
      });
    });

    root.querySelectorAll("[data-budget-toggle]").forEach((input) => {
      input.addEventListener("change", () => {
        const week = findWeek(input.getAttribute("data-budget-toggle"));
        const item = week && findItem(week, input.getAttribute("data-item-id"));
        if (!item) return;
        item.done = !!input.checked;
        persist(false);
        render();
      });
    });

    root.querySelectorAll("[data-budget-edit-item]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const weekId = btn.getAttribute("data-budget-edit-item");
        const week = findWeek(weekId);
        const item = week && findItem(week, btn.getAttribute("data-item-id"));
        if (!item) return;
        openModal({
          editWeekId: weekId,
          editItemId: item.id,
          weekId: weekId,
          name: item.name,
          amount: item.amount,
          category: item.category,
          recurring: item.recurring !== false
        });
      });
    });

    root.querySelectorAll("[data-budget-del-item]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const week = findWeek(btn.getAttribute("data-budget-del-item"));
        const itemId = btn.getAttribute("data-item-id");
        if (!week) return;
        const item = findItem(week, itemId);
        const label = item ? item.name : "this item";
        if (!window.confirm("Remove “" + label + "” from this week?")) return;
        week.items = week.items.filter((it) => it.id !== itemId);
        persist(false);
        render();
      });
    });

    const payInput = root.querySelector("#budget-pay");
    const openingInput = root.querySelector("#budget-opening");
    if (payInput) {
      payInput.addEventListener("change", () => {
        state.pay = dollarsToCents(payInput.value);
        persist(false);
        render();
      });
    }
    if (openingInput) {
      openingInput.addEventListener("change", () => {
        state.opening = dollarsToCents(openingInput.value);
        persist(false);
        render();
      });
    }
  }

  /* Re-sync when tab becomes visible (new Wednesday) */
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    if (!root.classList.contains("active") && root.hidden) return;
    syncWeeks();
    persist(false);
    render();
  });

  state = loadState();
  syncWeeks();
  /* Persist structure so empty starter weeks exist offline */
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (_) {}
  render();
})();
