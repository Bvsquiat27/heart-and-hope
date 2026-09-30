/**
 * Hearth & Hope — tiny haptic pulses (Android WebView / supported browsers).
 * Fails silently when vibrate is missing or blocked.
 */
(function () {
  "use strict";

  var PULSE_MS = 10;

  function pulse() {
    try {
      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate(PULSE_MS);
      }
    } catch (_) {
      /* ignore */
    }
  }

  function isNeedsToggle(el) {
    if (!el || !el.closest) return false;
    if (el.matches && el.matches('input[name="needs"]')) return true;
    var label = el.closest(".checkbox-group label");
    if (!label) return false;
    return !!label.querySelector('input[name="needs"]');
  }

  function shouldPulseClick(target) {
    if (!target || !target.closest) return false;
    if (target.closest(".btn-primary")) return true;
    if (target.closest("[data-bottom-nav]")) return true;
    if (target.closest("#use-my-location-dir, #use-my-location-help")) return true;
    if (target.closest("#help-primary-btn, #ninety-find-help")) return true;
    if (target.closest('a.btn[href="#directory"], a.hub-tile[href="#directory"]')) return true;
    if (target.closest('a.hub-tile[href="#postpartum"], a.btn[href="#postpartum"], .beacon-big, #beacon-light-btn')) return true;
    if (target.closest(".dir-need-chip")) return true;
    if (isNeedsToggle(target)) return true;
    return false;
  }

  document.addEventListener(
    "click",
    function (e) {
      if (shouldPulseClick(e.target)) pulse();
    },
    true
  );

  document.addEventListener(
    "change",
    function (e) {
      var t = e.target;
      if (t && t.matches && t.matches('input[name="needs"]')) pulse();
    },
    true
  );
})();
