/**
 * Heart & Hope — notification presence.
 * When a notification fires: the heart in the top-left logo glows red
 * in the center, and the app plays its own soft chime.
 * Fails silently everywhere (no AudioContext, no permission, etc.).
 */
(function () {
  "use strict";

  var GLOW_MS = 6000;
  var glowTimer = null;
  var audioCtx = null;

  function logoMark() {
    try { return document.querySelector(".logo-mark"); }
    catch (_) { return null; }
  }

  function glowLogo() {
    try {
      var mark = logoMark();
      if (!mark) return;
      mark.classList.add("notif-glow");
      if (glowTimer) clearTimeout(glowTimer);
      glowTimer = setTimeout(function () {
        var m = logoMark();
        if (m) m.classList.remove("notif-glow");
        glowTimer = null;
      }, GLOW_MS);
    } catch (_) { /* ignore */ }
  }

  /* Tapping the logo acknowledges the notification and clears the glow. */
  document.addEventListener("click", function (e) {
    try {
      if (e.target && e.target.closest && e.target.closest(".logo")) {
        var mark = logoMark();
        if (mark) mark.classList.remove("notif-glow");
        if (glowTimer) { clearTimeout(glowTimer); glowTimer = null; }
      }
    } catch (_) { /* ignore */ }
  }, true);

  function ensureCtx() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      if (!audioCtx) audioCtx = new AC();
      if (audioCtx.state === "suspended") {
        try { audioCtx.resume().catch(function () {}); } catch (_) {}
      }
      return audioCtx.state === "running" ? audioCtx : null;
    } catch (_) { return null; }
  }

  /* Unlock audio on the first user gesture so later chimes can play. */
  function unlock() {
    ensureCtx();
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  }
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);

  function tone(ctx, freq, startAt, dur) {
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.18, startAt + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startAt);
    osc.stop(startAt + dur + 0.05);
  }

  /* The app's own notification sound: a soft warm fifth (E5 -> B5). */
  function chime() {
    try {
      var ctx = ensureCtx();
      if (!ctx) return;
      var t = ctx.currentTime + 0.02;
      tone(ctx, 659.25, t, 0.5);
      tone(ctx, 987.77, t + 0.16, 0.7);
    } catch (_) { /* ignore */ }
  }

  window.HeartNotify = {
    announce: function () { glowLogo(); chime(); },
    glow: glowLogo,
    chime: chime
  };
})();
