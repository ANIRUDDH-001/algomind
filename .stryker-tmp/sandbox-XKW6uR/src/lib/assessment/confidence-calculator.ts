/**
 * @codesage
 * @file      src/lib/assessment/confidence-calculator.ts
 * @purpose   Calculates a confidence score for the generated assessment based on session signal
 * @tech      None
 * @connects  imports ConversationTurn from ./prompts
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1
 */
// @ts-nocheck
function stryNS_9fa48() {
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
import { ConversationTurn } from './prompts';
export interface AssessmentPartial {
  skills: Record<string, {
    evidence: string[];
  }>;
}
export function calculateConfidence(transcript: ConversationTurn[], assessment: AssessmentPartial): number {
  if (stryMutAct_9fa48("2162")) {
    {}
  } else {
    stryCov_9fa48("2162");
    const userContent = stryMutAct_9fa48("2163") ? transcript.map(t => t.content).join(' ') : (stryCov_9fa48("2163"), transcript.filter(stryMutAct_9fa48("2164") ? () => undefined : (stryCov_9fa48("2164"), t => stryMutAct_9fa48("2167") ? t.role !== 'user' : stryMutAct_9fa48("2166") ? false : stryMutAct_9fa48("2165") ? true : (stryCov_9fa48("2165", "2166", "2167"), t.role === (stryMutAct_9fa48("2168") ? "" : (stryCov_9fa48("2168"), 'user'))))).map(stryMutAct_9fa48("2169") ? () => undefined : (stryCov_9fa48("2169"), t => t.content)).join(stryMutAct_9fa48("2170") ? "" : (stryCov_9fa48("2170"), ' ')));

    // Factors for higher confidence:
    // 1. Transcript length (more signal)
    // 2. Number of user turns
    // 3. Presence of evidence in assessment

    const userTurnCount = stryMutAct_9fa48("2171") ? transcript.length : (stryCov_9fa48("2171"), transcript.filter(stryMutAct_9fa48("2172") ? () => undefined : (stryCov_9fa48("2172"), t => stryMutAct_9fa48("2175") ? t.role !== 'user' : stryMutAct_9fa48("2174") ? false : stryMutAct_9fa48("2173") ? true : (stryCov_9fa48("2173", "2174", "2175"), t.role === (stryMutAct_9fa48("2176") ? "" : (stryCov_9fa48("2176"), 'user'))))).length);
    const wordCount = userContent.split(stryMutAct_9fa48("2178") ? /\S+/ : stryMutAct_9fa48("2177") ? /\s/ : (stryCov_9fa48("2177", "2178"), /\s+/)).length;
    let evidencePoints = 0;
    Object.values(assessment.skills).forEach(s => {
      if (stryMutAct_9fa48("2179")) {
        {}
      } else {
        stryCov_9fa48("2179");
        if (stryMutAct_9fa48("2182") ? s.evidence || s.evidence.length > 0 : stryMutAct_9fa48("2181") ? false : stryMutAct_9fa48("2180") ? true : (stryCov_9fa48("2180", "2181", "2182"), s.evidence && (stryMutAct_9fa48("2185") ? s.evidence.length <= 0 : stryMutAct_9fa48("2184") ? s.evidence.length >= 0 : stryMutAct_9fa48("2183") ? true : (stryCov_9fa48("2183", "2184", "2185"), s.evidence.length > 0)))) stryMutAct_9fa48("2186") ? evidencePoints-- : (stryCov_9fa48("2186"), evidencePoints++);
      }
    });

    // Simple heuristic normalized to 0-1
    const turnScore = stryMutAct_9fa48("2187") ? Math.max(userTurnCount / 10, 0.4) : (stryCov_9fa48("2187"), Math.min(stryMutAct_9fa48("2188") ? userTurnCount * 10 : (stryCov_9fa48("2188"), userTurnCount / 10), 0.4)); // Max 0.4 for 10+ turns
    const wordScore = stryMutAct_9fa48("2189") ? Math.max(wordCount / 500, 0.3) : (stryCov_9fa48("2189"), Math.min(stryMutAct_9fa48("2190") ? wordCount * 500 : (stryCov_9fa48("2190"), wordCount / 500), 0.3)); // Max 0.3 for 500+ words
    const evidenceScore = stryMutAct_9fa48("2191") ? evidencePoints / 8 / 0.3 : (stryCov_9fa48("2191"), (stryMutAct_9fa48("2192") ? evidencePoints * 8 : (stryCov_9fa48("2192"), evidencePoints / 8)) * 0.3); // Max 0.3 if all skills have evidence

    const confidence = stryMutAct_9fa48("2193") ? turnScore + wordScore - evidenceScore : (stryCov_9fa48("2193"), (stryMutAct_9fa48("2194") ? turnScore - wordScore : (stryCov_9fa48("2194"), turnScore + wordScore)) + evidenceScore);
    return stryMutAct_9fa48("2195") ? Math.round(confidence * 100) * 100 : (stryCov_9fa48("2195"), Math.round(stryMutAct_9fa48("2196") ? confidence / 100 : (stryCov_9fa48("2196"), confidence * 100)) / 100);
  }
}