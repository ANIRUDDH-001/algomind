/**
 * @codesage
 * @file      src/lib/assessment/score-validator.ts
 * @purpose   Mechanically enforces strict scoring rules via AI validation pass
 * @tech      AI Client
 * @connects  imports getAIClient from '@/lib/ai/client'
 * @apis      None directly
 * @db        None
 * @state     None
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 

/**
 * score-validator.ts
 *
 * Two-pass validation: after the AI produces initial scores, this runs
 * a correction pass that enforces the strictness protocol mechanically.
 *
 * Rules enforced:
 *   score > 4 requires non-vague, specific answer in evidence
 *   score > 6 requires unprompted demonstration (not just correct response)
 *   score > 8 requires proactive behaviour beyond what was asked
 *
 * Returns correctedScores: Record<dimension, correctedScore | null>
 * null = no change needed
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
import { getAIClient } from '@/lib/ai/client';
export interface ParsedSkillScore {
  score: number;
  subCriteria: Record<string, number>;
  evidence: string[];
  strengths: string[];
  improvements: string[];
}
export interface ValidationResult {
  correctedScores: Record<string, number | null>;
  inflationDetected: boolean;
  validationNotes: string;
}
const VALIDATION_PROMPT = stryMutAct_9fa48("2197") ? `` : (stryCov_9fa48("2197"), `You are a scoring calibrator for technical interviews. Apply these rules STRICTLY:

RULE 1: score > 4 requires the evidence to contain a specific, non-vague answer 
        (not "candidate seemed to understand" or "mentioned the concept")
RULE 2: score > 6 requires evidence showing UNPROMPTED correct behaviour 
        (deduct 2 points if candidate only did it after direct questioning)
RULE 3: score > 8 requires evidence of PROACTIVE behaviour beyond what was asked
        (deduct to 8 max if candidate only met expectations, not exceeded them)
RULE 4: If evidence array is empty or contains generic statements → cap at 3

For each dimension, compare score vs evidence and return corrected score if inflation detected.
Return null for a dimension if the score is justified.

Return ONLY this JSON:
{
  "correctedScores": {
    "problemDecomposition": <number|null>,
    "patternRecognition": <number|null>,
    "algorithmicThinking": <number|null>,
    "complexityAnalysis": <number|null>,
    "communicationClarity": <number|null>,
    "edgeCaseAwareness": <number|null>,
    "optimizationMindset": <number|null>,
    "debuggingApproach": <number|null>
  },
  "inflationDetected": <boolean>,
  "validationNotes": "<1 sentence summary of corrections>"
}`);
export async function validateAndCorrectScores(initialScores: Record<string, ParsedSkillScore>, conversationLength: number): Promise<ValidationResult> {
  if (stryMutAct_9fa48("2198")) {
    {}
  } else {
    stryCov_9fa48("2198");
    // B1: Graduated short-session cap instead of flat boolean
    // 2-3 turns → cap 5, 4-5 turns → cap 6, 6+ → no cap
    const shortSessionCap: number | null = (stryMutAct_9fa48("2202") ? conversationLength > 3 : stryMutAct_9fa48("2201") ? conversationLength < 3 : stryMutAct_9fa48("2200") ? false : stryMutAct_9fa48("2199") ? true : (stryCov_9fa48("2199", "2200", "2201", "2202"), conversationLength <= 3)) ? 5 : (stryMutAct_9fa48("2206") ? conversationLength > 5 : stryMutAct_9fa48("2205") ? conversationLength < 5 : stryMutAct_9fa48("2204") ? false : stryMutAct_9fa48("2203") ? true : (stryCov_9fa48("2203", "2204", "2205", "2206"), conversationLength <= 5)) ? 6 : null;
    const isShortSession = stryMutAct_9fa48("2209") ? shortSessionCap === null : stryMutAct_9fa48("2208") ? false : stryMutAct_9fa48("2207") ? true : (stryCov_9fa48("2207", "2208", "2209"), shortSessionCap !== null);
    const scoresSummary = Object.entries(initialScores).map(stryMutAct_9fa48("2210") ? () => undefined : (stryCov_9fa48("2210"), ([dim, s]) => stryMutAct_9fa48("2211") ? `` : (stryCov_9fa48("2211"), `${dim}: score=${s.score}, evidence="${stryMutAct_9fa48("2213") ? (s.evidence || []).join('; ').substring(0, 150) : stryMutAct_9fa48("2212") ? (s.evidence || []).slice(0, 2).join('; ') : (stryCov_9fa48("2212", "2213"), (stryMutAct_9fa48("2216") ? s.evidence && [] : stryMutAct_9fa48("2215") ? false : stryMutAct_9fa48("2214") ? true : (stryCov_9fa48("2214", "2215", "2216"), s.evidence || (stryMutAct_9fa48("2217") ? ["Stryker was here"] : (stryCov_9fa48("2217"), [])))).slice(0, 2).join(stryMutAct_9fa48("2218") ? "" : (stryCov_9fa48("2218"), '; ')).substring(0, 150))}"`))).join(stryMutAct_9fa48("2219") ? "" : (stryCov_9fa48("2219"), '\n'));
    try {
      if (stryMutAct_9fa48("2220")) {
        {}
      } else {
        stryCov_9fa48("2220");
        const client = getAIClient();
        const result = await client.generateCompletion(stryMutAct_9fa48("2221") ? [] : (stryCov_9fa48("2221"), [stryMutAct_9fa48("2222") ? {} : (stryCov_9fa48("2222"), {
          role: stryMutAct_9fa48("2223") ? "" : (stryCov_9fa48("2223"), 'user'),
          content: stryMutAct_9fa48("2224") ? `` : (stryCov_9fa48("2224"), `Session length: ${conversationLength} turns. Short session: ${isShortSession}.\n\nInitial scores with evidence:\n${scoresSummary}\n\n${VALIDATION_PROMPT}`)
        })]), stryMutAct_9fa48("2225") ? {} : (stryCov_9fa48("2225"), {
          maxTokens: 400,
          category: stryMutAct_9fa48("2226") ? "" : (stryCov_9fa48("2226"), 'analysis'),
          systemPrompt: stryMutAct_9fa48("2227") ? "" : (stryCov_9fa48("2227"), 'You are a strict scoring calibrator. Return only valid JSON.')
        }));
        if (stryMutAct_9fa48("2230") ? !result.success && !result.response : stryMutAct_9fa48("2229") ? false : stryMutAct_9fa48("2228") ? true : (stryCov_9fa48("2228", "2229", "2230"), (stryMutAct_9fa48("2231") ? result.success : (stryCov_9fa48("2231"), !result.success)) || (stryMutAct_9fa48("2232") ? result.response : (stryCov_9fa48("2232"), !result.response)))) {
          if (stryMutAct_9fa48("2233")) {
            {}
          } else {
            stryCov_9fa48("2233");
            return stryMutAct_9fa48("2234") ? {} : (stryCov_9fa48("2234"), {
              correctedScores: {},
              inflationDetected: stryMutAct_9fa48("2235") ? true : (stryCov_9fa48("2235"), false),
              validationNotes: stryMutAct_9fa48("2236") ? "" : (stryCov_9fa48("2236"), 'Validation skipped.')
            });
          }
        }
        const clean = stryMutAct_9fa48("2237") ? result.response.replace(/```json|```/gi, '') : (stryCov_9fa48("2237"), result.response.replace(/```json|```/gi, stryMutAct_9fa48("2238") ? "Stryker was here!" : (stryCov_9fa48("2238"), '')).trim());
        const parsed = JSON.parse(clean);

        // Map camelCase dimension names to dash-case skill IDs for lookup
        const camelToDash: Record<string, string> = stryMutAct_9fa48("2239") ? {} : (stryCov_9fa48("2239"), {
          problemDecomposition: stryMutAct_9fa48("2240") ? "" : (stryCov_9fa48("2240"), 'problem-decomposition'),
          patternRecognition: stryMutAct_9fa48("2241") ? "" : (stryCov_9fa48("2241"), 'pattern-recognition'),
          algorithmicThinking: stryMutAct_9fa48("2242") ? "" : (stryCov_9fa48("2242"), 'algorithmic-thinking'),
          complexityAnalysis: stryMutAct_9fa48("2243") ? "" : (stryCov_9fa48("2243"), 'complexity-analysis'),
          communicationClarity: stryMutAct_9fa48("2244") ? "" : (stryCov_9fa48("2244"), 'communication-clarity'),
          edgeCaseAwareness: stryMutAct_9fa48("2245") ? "" : (stryCov_9fa48("2245"), 'edge-case-awareness'),
          optimizationMindset: stryMutAct_9fa48("2246") ? "" : (stryCov_9fa48("2246"), 'optimization-mindset'),
          debuggingApproach: stryMutAct_9fa48("2247") ? "" : (stryCov_9fa48("2247"), 'debugging-approach')
        });

        // Apply graduated hard caps for short sessions
        if (stryMutAct_9fa48("2250") ? shortSessionCap === null : stryMutAct_9fa48("2249") ? false : stryMutAct_9fa48("2248") ? true : (stryCov_9fa48("2248", "2249", "2250"), shortSessionCap !== null)) {
          if (stryMutAct_9fa48("2251")) {
            {}
          } else {
            stryCov_9fa48("2251");
            Object.keys(parsed.correctedScores).forEach(dim => {
              if (stryMutAct_9fa48("2252")) {
                {}
              } else {
                stryCov_9fa48("2252");
                const dashKey = stryMutAct_9fa48("2255") ? camelToDash[dim] && dim : stryMutAct_9fa48("2254") ? false : stryMutAct_9fa48("2253") ? true : (stryCov_9fa48("2253", "2254", "2255"), camelToDash[dim] || dim);
                const current = stryMutAct_9fa48("2258") ? initialScores[dashKey]?.score && 0 : stryMutAct_9fa48("2257") ? false : stryMutAct_9fa48("2256") ? true : (stryCov_9fa48("2256", "2257", "2258"), (stryMutAct_9fa48("2259") ? initialScores[dashKey].score : (stryCov_9fa48("2259"), initialScores[dashKey]?.score)) || 0);
                if (stryMutAct_9fa48("2263") ? current <= shortSessionCap : stryMutAct_9fa48("2262") ? current >= shortSessionCap : stryMutAct_9fa48("2261") ? false : stryMutAct_9fa48("2260") ? true : (stryCov_9fa48("2260", "2261", "2262", "2263"), current > shortSessionCap)) {
                  if (stryMutAct_9fa48("2264")) {
                    {}
                  } else {
                    stryCov_9fa48("2264");
                    parsed.correctedScores[dim] = stryMutAct_9fa48("2265") ? Math.max(parsed.correctedScores[dim] ?? current, shortSessionCap) : (stryCov_9fa48("2265"), Math.min(stryMutAct_9fa48("2266") ? parsed.correctedScores[dim] && current : (stryCov_9fa48("2266"), parsed.correctedScores[dim] ?? current), shortSessionCap));
                    parsed.inflationDetected = stryMutAct_9fa48("2267") ? false : (stryCov_9fa48("2267"), true);
                  }
                }
              }
            });
          }
        }
        return parsed as ValidationResult;
      }
    } catch (e) {
      if (stryMutAct_9fa48("2268")) {
        {}
      } else {
        stryCov_9fa48("2268");
        console.error(stryMutAct_9fa48("2269") ? "" : (stryCov_9fa48("2269"), '[ScoreValidator] Validation crashed — raw scores will pass through uncorrected:'), e);
        return stryMutAct_9fa48("2270") ? {} : (stryCov_9fa48("2270"), {
          correctedScores: {},
          inflationDetected: stryMutAct_9fa48("2271") ? true : (stryCov_9fa48("2271"), false),
          validationNotes: stryMutAct_9fa48("2272") ? "" : (stryCov_9fa48("2272"), 'Validation error.')
        });
      }
    }
  }
}

/**
 * Apply corrections to the initial parsed assessment response.
 * Returns a new skills object with corrected scores.
 */
export function applyValidation(skills: Record<string, ParsedSkillScore>, validation: ValidationResult): Record<string, ParsedSkillScore> {
  if (stryMutAct_9fa48("2273")) {
    {}
  } else {
    stryCov_9fa48("2273");
    const corrected = stryMutAct_9fa48("2274") ? {} : (stryCov_9fa48("2274"), {
      ...skills
    });

    // Map camelCase dimension names to dash-case skill IDs
    const camelToDash: Record<string, string> = stryMutAct_9fa48("2275") ? {} : (stryCov_9fa48("2275"), {
      problemDecomposition: stryMutAct_9fa48("2276") ? "" : (stryCov_9fa48("2276"), 'problem-decomposition'),
      patternRecognition: stryMutAct_9fa48("2277") ? "" : (stryCov_9fa48("2277"), 'pattern-recognition'),
      algorithmicThinking: stryMutAct_9fa48("2278") ? "" : (stryCov_9fa48("2278"), 'algorithmic-thinking'),
      complexityAnalysis: stryMutAct_9fa48("2279") ? "" : (stryCov_9fa48("2279"), 'complexity-analysis'),
      communicationClarity: stryMutAct_9fa48("2280") ? "" : (stryCov_9fa48("2280"), 'communication-clarity'),
      edgeCaseAwareness: stryMutAct_9fa48("2281") ? "" : (stryCov_9fa48("2281"), 'edge-case-awareness'),
      optimizationMindset: stryMutAct_9fa48("2282") ? "" : (stryCov_9fa48("2282"), 'optimization-mindset'),
      debuggingApproach: stryMutAct_9fa48("2283") ? "" : (stryCov_9fa48("2283"), 'debugging-approach')
    });
    Object.entries(validation.correctedScores).forEach(([camelDim, correctedScore]) => {
      if (stryMutAct_9fa48("2284")) {
        {}
      } else {
        stryCov_9fa48("2284");
        if (stryMutAct_9fa48("2287") ? correctedScore !== null : stryMutAct_9fa48("2286") ? false : stryMutAct_9fa48("2285") ? true : (stryCov_9fa48("2285", "2286", "2287"), correctedScore === null)) return;
        const dashId = camelToDash[camelDim];
        if (stryMutAct_9fa48("2290") ? dashId || corrected[dashId] : stryMutAct_9fa48("2289") ? false : stryMutAct_9fa48("2288") ? true : (stryCov_9fa48("2288", "2289", "2290"), dashId && corrected[dashId])) {
          if (stryMutAct_9fa48("2291")) {
            {}
          } else {
            stryCov_9fa48("2291");
            corrected[dashId] = stryMutAct_9fa48("2292") ? {} : (stryCov_9fa48("2292"), {
              ...corrected[dashId],
              score: correctedScore,
              improvements: stryMutAct_9fa48("2293") ? [] : (stryCov_9fa48("2293"), [...(stryMutAct_9fa48("2296") ? corrected[dashId].improvements && [] : stryMutAct_9fa48("2295") ? false : stryMutAct_9fa48("2294") ? true : (stryCov_9fa48("2294", "2295", "2296"), corrected[dashId].improvements || (stryMutAct_9fa48("2297") ? ["Stryker was here"] : (stryCov_9fa48("2297"), [])))), stryMutAct_9fa48("2298") ? `` : (stryCov_9fa48("2298"), `Score adjusted by validator: ${validation.validationNotes}`)])
            });
          }
        }
      }
    });
    return corrected;
  }
}