/**
 * Assessment JWT secret helper.
 *
 * SECURITY NOTE: ASSESSMENT_JWT_SECRET must be a unique, high-entropy secret
 * that is NEVER the same value as SUPABASE_JWT_SECRET. Sharing the same secret
 * between Supabase auth tokens and assessment tokens allows cross-token forgery:
 * an attacker with their own valid Supabase JWT could forge an assessment token
 * using the same signing secret.
 *
 * Generate a suitable secret:
 *   openssl rand -hex 32
 *
 * Set it in your environment:
 *   ASSESSMENT_JWT_SECRET=<64-char hex string>
 */
// @ts-nocheck

// 


/**
 * Returns the raw assessment JWT secret string.
 * Throws at call time if ASSESSMENT_JWT_SECRET is not set.
 * Never falls back to SUPABASE_JWT_SECRET.
 */function stryNS_9fa48() {
  var g = typeof globalThis === 'object' && globalThis && globalThis.Math === Math && globalThis || new Function("return this")();
  var ns = g.__stryker__ || (g.__stryker__ = {});
  if (ns.activeMutant === undefined && g.process && g.process.env && g.process.env.__STRYKER_ACTIVE_MUTANT__) {
    ns.activeMutant = g.process.env.__STRYKER_ACTIVE_MUTANT__;
  }
  function retrieveNS() {
    return ns;
  }
  stryNS_9fa48 = retrieveNS;
  return retrieveNS();
}
stryNS_9fa48();
function stryCov_9fa48() {
  var ns = stryNS_9fa48();
  var cov = ns.mutantCoverage || (ns.mutantCoverage = {
    static: {},
    perTest: {}
  });
  function cover() {
    var c = cov.static;
    if (ns.currentTestId) {
      c = cov.perTest[ns.currentTestId] = cov.perTest[ns.currentTestId] || {};
    }
    var a = arguments;
    for (var i = 0; i < a.length; i++) {
      c[a[i]] = (c[a[i]] || 0) + 1;
    }
  }
  stryCov_9fa48 = cover;
  cover.apply(null, arguments);
}
function stryMutAct_9fa48(id) {
  var ns = stryNS_9fa48();
  function isActive(id) {
    if (ns.activeMutant === id) {
      if (ns.hitCount !== void 0 && ++ns.hitCount > ns.hitLimit) {
        throw new Error('Stryker: Hit count limit reached (' + ns.hitCount + ')');
      }
      return true;
    }
    return false;
  }
  stryMutAct_9fa48 = isActive;
  return isActive(id);
}
export function getAssessmentSecret(): string {
  if (stryMutAct_9fa48("1708")) {
    {}
  } else {
    stryCov_9fa48("1708");
    const secret = process.env.ASSESSMENT_JWT_SECRET;
    if (stryMutAct_9fa48("1711") ? false : stryMutAct_9fa48("1710") ? true : stryMutAct_9fa48("1709") ? secret : (stryCov_9fa48("1709", "1710", "1711"), !secret)) {
      if (stryMutAct_9fa48("1712")) {
        {}
      } else {
        stryCov_9fa48("1712");
        throw new Error((stryMutAct_9fa48("1713") ? "" : (stryCov_9fa48("1713"), '[Assessment JWT] ASSESSMENT_JWT_SECRET is not set. ')) + (stryMutAct_9fa48("1714") ? "" : (stryCov_9fa48("1714"), 'Add it to your environment variables. ')) + (stryMutAct_9fa48("1715") ? "" : (stryCov_9fa48("1715"), 'Generate one with: openssl rand -hex 32 \n')) + (stryMutAct_9fa48("1716") ? "" : (stryCov_9fa48("1716"), 'IMPORTANT: This must be a different value from SUPABASE_JWT_SECRET — ')) + (stryMutAct_9fa48("1717") ? "" : (stryCov_9fa48("1717"), 'sharing the same secret between Supabase auth tokens and assessment tokens ')) + (stryMutAct_9fa48("1718") ? "" : (stryCov_9fa48("1718"), 'enables cross-token forgery attacks.')));
      }
    }

    // Enforce minimum entropy — catch placeholder values like "secret" or "test"
    if (stryMutAct_9fa48("1722") ? secret.length >= 32 : stryMutAct_9fa48("1721") ? secret.length <= 32 : stryMutAct_9fa48("1720") ? false : stryMutAct_9fa48("1719") ? true : (stryCov_9fa48("1719", "1720", "1721", "1722"), secret.length < 32)) {
      if (stryMutAct_9fa48("1723")) {
        {}
      } else {
        stryCov_9fa48("1723");
        throw new Error((stryMutAct_9fa48("1724") ? `` : (stryCov_9fa48("1724"), `[Assessment JWT] ASSESSMENT_JWT_SECRET is too short (${secret.length} chars, minimum 32). `)) + (stryMutAct_9fa48("1725") ? "" : (stryCov_9fa48("1725"), 'Generate a suitable secret with: openssl rand -hex 32')));
      }
    }
    return secret;
  }
}

/**
 * Returns the assessment JWT secret encoded as Uint8Array for use with jose.
 */
export function encodeAssessmentSecret(): Uint8Array {
  if (stryMutAct_9fa48("1726")) {
    {}
  } else {
    stryCov_9fa48("1726");
    return new TextEncoder().encode(getAssessmentSecret());
  }
}

/**
 * Validates that ASSESSMENT_JWT_SECRET is not the same value as SUPABASE_JWT_SECRET.
 * Call this from validateEnv.ts during startup.
 */
export function assertAssessmentSecretIsUnique(): void {
  if (stryMutAct_9fa48("1727")) {
    {}
  } else {
    stryCov_9fa48("1727");
    const assessmentSecret = process.env.ASSESSMENT_JWT_SECRET;
    const supabaseSecret = process.env.SUPABASE_JWT_SECRET;
    if (stryMutAct_9fa48("1730") ? assessmentSecret && supabaseSecret || assessmentSecret === supabaseSecret : stryMutAct_9fa48("1729") ? false : stryMutAct_9fa48("1728") ? true : (stryCov_9fa48("1728", "1729", "1730"), (stryMutAct_9fa48("1732") ? assessmentSecret || supabaseSecret : stryMutAct_9fa48("1731") ? true : (stryCov_9fa48("1731", "1732"), assessmentSecret && supabaseSecret)) && (stryMutAct_9fa48("1734") ? assessmentSecret !== supabaseSecret : stryMutAct_9fa48("1733") ? true : (stryCov_9fa48("1733", "1734"), assessmentSecret === supabaseSecret)))) {
      if (stryMutAct_9fa48("1735")) {
        {}
      } else {
        stryCov_9fa48("1735");
        throw new Error((stryMutAct_9fa48("1736") ? "" : (stryCov_9fa48("1736"), '[Assessment JWT] FATAL: ASSESSMENT_JWT_SECRET and SUPABASE_JWT_SECRET ')) + (stryMutAct_9fa48("1737") ? "" : (stryCov_9fa48("1737"), 'are set to the same value. This enables cross-token forgery attacks. ')) + (stryMutAct_9fa48("1738") ? "" : (stryCov_9fa48("1738"), 'Generate a new ASSESSMENT_JWT_SECRET with: openssl rand -hex 32')));
      }
    }
  }
}