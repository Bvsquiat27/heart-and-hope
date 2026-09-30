/* Heart & Hope — hard exclusion for abortion providers / Planned Parenthood.
 * Shared by Directory + Get Help via getCenters(). Abortion recovery / post-abortion
 * healing support is ALLOWED and must not trip these patterns.
 */
(function (global) {
  "use strict";

  /** Name / org patterns that mean abortion provider or Planned Parenthood. */
  var EXCLUDE_NAME = /planned\s*parenthood|\bppfa\b|abortion\s*clinic|abortuary|abortion\s*provider|whole\s*woman'?s?\s*health|abortion\s+services/i;

  /**
   * Service / blurb text that means they provide or refer for abortion.
   * Applied AFTER stripping recovery phrases.
   */
  var EXCLUDE_SERVICE = /\brefer\w*\s+for\s+abortion|\bprovide\w*\s+abortion|\boffer\w*\s+abortion|\babortion\s+on[- ]site|\babortion\s+(services|care|procedure|referrals?|clinic|pill|medication)\b|\bmedication\s+abortion\b|\bchemical\s+abortion\b|\baspire\s+abortion\b/i;

  /** Phrases that keep a center (recovery / pill reversal) — stripped before service test. */
  var RECOVERY_STRIP = /post[- ]?abortion\s+(healing|support|care|counsel(?:ing|ling)?)|abortion\s*recovery[^,]*|abortion\s*pill\s*reversal[^,]*|\bAPR\b|pill\s*reversal\s*(hotline|team|on\s*call)[^,]*/gi;

  function centerBlob(c) {
    if (!c || typeof c !== "object") return "";
    var parts = [
      c.name,
      c.blurb,
      c.type,
      c.faith,
      c.website,
      c.address,
      Array.isArray(c.services) ? c.services.join(" ") : c.services,
      Array.isArray(c.needs) ? c.needs.join(" ") : ""
    ];
    return parts.filter(Boolean).join(" ");
  }

  function isAbortionRecoveryOnlyHit(text) {
    if (!text) return false;
    var t = String(text);
    // If every abortion mention is in a recovery/healing context, allow.
    var withoutRecovery = t.replace(RECOVERY_STRIP, " ");
    return !/\babortion\b/i.test(withoutRecovery) && /\babortion\b/i.test(t);
  }

  function isExcludedCenter(c) {
    var blob = centerBlob(c);
    if (!blob) return false;
    if (EXCLUDE_NAME.test(blob)) return true;
    var cleaned = blob.replace(RECOVERY_STRIP, " ");
    if (EXCLUDE_SERVICE.test(cleaned)) return true;
    // Explicit website host checks
    var site = String((c && c.website) || "").toLowerCase();
    if (/plannedparenthood\.|ppfa\.org|abortionclinic|abortionservices/i.test(site)) return true;
    return false;
  }

  function filterLifeAffirming(list) {
    if (!Array.isArray(list)) return [];
    return list.filter(function (c) {
      return !isExcludedCenter(c);
    });
  }

  global.HeartCentersFilter = {
    EXCLUDE_NAME: EXCLUDE_NAME,
    EXCLUDE_SERVICE: EXCLUDE_SERVICE,
    isExcludedCenter: isExcludedCenter,
    filterLifeAffirming: filterLifeAffirming,
    isAbortionRecoveryOnlyHit: isAbortionRecoveryOnlyHit
  };
})(typeof window !== "undefined" ? window : globalThis);
