/**
 * Heart & Hope — tiny haptic pulses (Android WebView / supported browsers).
 * Fails silently when vibrate is missing or blocked.
 */
(function () {
  "use strict";

  var PULSE_MS = 10;

  function pulse(ms) {
    try {
      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate(Math.max(8, Math.min(20, ms || PULSE_MS)));
      }
    } catch (_) {
      /* ignore */
    }
  }

  window.HeartHaptics = {
    tap: function (ms) { pulse(ms); }
  };

  function shouldPulseClick(target) {
    if (!target || !target.closest) return false;
    // Every tappable thing gets a light pulse — links, buttons, inputs,
    // chips, toggles, summaries. Keyboard activation fires click too,
    // so this covers both touch and keyboard.
    return !!target.closest(
      'a, button, [role="button"], input, select, textarea, summary, label, [data-haptic]'
    );
  }

  document.addEventListener(
    "click",
    function (e) {
      if (shouldPulseClick(e.target)) pulse();
    },
    true
  );
})();
