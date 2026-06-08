/**
 * @codesage
 * @file      src/lib/assessment/analyzer.ts
 * @purpose   Core LLM-based analysis engine to score and evaluate a candidate's interview transcript
 * @tech      AI Client (Gemini)
 * @connects  imports SKILL_DEFINITIONS, generateAssessmentPrompt, calculateConfidence, validateAndCorrectScores, MODE_ASSESSMENT_CONFIGS, getAIClient
 * @apis      None directly (uses getAIClient)
 * @db        None
 * @state     None
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 
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
import { CognitiveSkill } from '@/types/assessment';
import type { DifficultyMode } from '../interview/interview-config';
import { SKILL_DEFINITIONS } from './skill-registry';
import { ConversationTurn, generateAssessmentPrompt } from './prompts';
import { calculateConfidence } from './confidence-calculator';
import { validateAndCorrectScores, applyValidation } from './score-validator';
import { MODE_ASSESSMENT_CONFIGS } from '../interview/mode-assessment-config';
export interface CodeQualityScore {
  score: number | null;
  correctness: string;
  clarity: string;
  consistency: string;
  issues: string[];
}
export interface SkillScore {
  score: number;
  subCriteria: Record<string, number>;
  evidence: string[];
  strengths: string[];
  improvements: string[];
  confidence: number;
}
export type HireDecision = 'STRONG_HIRE' | 'HIRE' | 'BORDERLINE' | 'NO_HIRE' | 'STRONG_NO_HIRE';
export interface AssessmentResult {
  sessionId: string;
  timestamp: Date;
  problem: {
    title: string;
    description: string;
    difficulty: string;
  };
  skills: Record<CognitiveSkill, SkillScore>;
  overallScore: number;
  rawScore: number;
  adjustedScore: number;
  overallFeedback: string;
  nextSteps: string[];
  knowledgeGaps?: string[];
  codeQuality?: null | CodeQualityScore;
  modelUsed?: string;
  analysisFailure?: 'user_fault' | 'system_fault';
  validationPassDone?: boolean;
  hireDecision?: HireDecision | null;
  isLimitedEvidence?: boolean;
  keyMoments?: any[];
  improvementExamples?: any[];
}
function computeWeightedScore(subCriteriaScores: Record<string, number>, skillId: CognitiveSkill): number {
  if (stryMutAct_9fa48("1739")) {
    {}
  } else {
    stryCov_9fa48("1739");
    const def = SKILL_DEFINITIONS[skillId];
    if (stryMutAct_9fa48("1742") ? !def && !def.subCriteria : stryMutAct_9fa48("1741") ? false : stryMutAct_9fa48("1740") ? true : (stryCov_9fa48("1740", "1741", "1742"), (stryMutAct_9fa48("1743") ? def : (stryCov_9fa48("1743"), !def)) || (stryMutAct_9fa48("1744") ? def.subCriteria : (stryCov_9fa48("1744"), !def.subCriteria)))) return 5;
    let total = 0;
    for (const sc of def.subCriteria) {
      if (stryMutAct_9fa48("1745")) {
        {}
      } else {
        stryCov_9fa48("1745");
        stryMutAct_9fa48("1746") ? total -= (subCriteriaScores[sc.id] ?? 5) * sc.weight : (stryCov_9fa48("1746"), total += stryMutAct_9fa48("1747") ? (subCriteriaScores[sc.id] ?? 5) / sc.weight : (stryCov_9fa48("1747"), (stryMutAct_9fa48("1748") ? subCriteriaScores[sc.id] && 5 : (stryCov_9fa48("1748"), subCriteriaScores[sc.id] ?? 5)) * sc.weight));
      }
    }
    return stryMutAct_9fa48("1749") ? Math.round(total * 10) * 10 : (stryCov_9fa48("1749"), Math.round(stryMutAct_9fa48("1750") ? total / 10 : (stryCov_9fa48("1750"), total * 10)) / 10);
  }
}
function computeOverallScore(skills: Record<string, SkillScore>): number {
  if (stryMutAct_9fa48("1751")) {
    {}
  } else {
    stryCov_9fa48("1751");
    let totalWeight = 0;
    let weightedSum = 0;
    Object.keys(skills).forEach(skillId => {
      if (stryMutAct_9fa48("1752")) {
        {}
      } else {
        stryCov_9fa48("1752");
        const def = SKILL_DEFINITIONS[skillId as CognitiveSkill];
        if (stryMutAct_9fa48("1754") ? false : stryMutAct_9fa48("1753") ? true : (stryCov_9fa48("1753", "1754"), def)) {
          if (stryMutAct_9fa48("1755")) {
            {}
          } else {
            stryCov_9fa48("1755");
            stryMutAct_9fa48("1756") ? totalWeight -= def.weight : (stryCov_9fa48("1756"), totalWeight += def.weight);
            stryMutAct_9fa48("1757") ? weightedSum -= skills[skillId].score * def.weight : (stryCov_9fa48("1757"), weightedSum += stryMutAct_9fa48("1758") ? skills[skillId].score / def.weight : (stryCov_9fa48("1758"), skills[skillId].score * def.weight));
          }
        }
      }
    });
    return (stryMutAct_9fa48("1762") ? totalWeight <= 0 : stryMutAct_9fa48("1761") ? totalWeight >= 0 : stryMutAct_9fa48("1760") ? false : stryMutAct_9fa48("1759") ? true : (stryCov_9fa48("1759", "1760", "1761", "1762"), totalWeight > 0)) ? stryMutAct_9fa48("1763") ? Math.round(weightedSum / totalWeight * 10) * 10 : (stryCov_9fa48("1763"), Math.round(stryMutAct_9fa48("1764") ? weightedSum / totalWeight / 10 : (stryCov_9fa48("1764"), (stryMutAct_9fa48("1765") ? weightedSum * totalWeight : (stryCov_9fa48("1765"), weightedSum / totalWeight)) * 10)) / 10) : 5;
  }
}

/**
 * Computes overall score including mode-specific bonus dimensions.
 * Bonus dimensions (timeEfficiency for crunch, contextSwitching for sprint)
 * contribute 10% weight. Standard dimensions scaled to 90%.
 */
export function computeOverallScoreWithBonus(skills: Record<string, SkillScore>, bonusDimensionScore?: number | null): number {
  if (stryMutAct_9fa48("1766")) {
    {}
  } else {
    stryCov_9fa48("1766");
    const base = computeOverallScore(skills);
    if (stryMutAct_9fa48("1769") ? !bonusDimensionScore && bonusDimensionScore <= 0 : stryMutAct_9fa48("1768") ? false : stryMutAct_9fa48("1767") ? true : (stryCov_9fa48("1767", "1768", "1769"), (stryMutAct_9fa48("1770") ? bonusDimensionScore : (stryCov_9fa48("1770"), !bonusDimensionScore)) || (stryMutAct_9fa48("1773") ? bonusDimensionScore > 0 : stryMutAct_9fa48("1772") ? bonusDimensionScore < 0 : stryMutAct_9fa48("1771") ? false : (stryCov_9fa48("1771", "1772", "1773"), bonusDimensionScore <= 0)))) return base;
    return stryMutAct_9fa48("1774") ? Math.round((base * 0.9 + bonusDimensionScore * 0.1) * 10) * 10 : (stryCov_9fa48("1774"), Math.round(stryMutAct_9fa48("1775") ? (base * 0.9 + bonusDimensionScore * 0.1) / 10 : (stryCov_9fa48("1775"), (stryMutAct_9fa48("1776") ? base * 0.9 - bonusDimensionScore * 0.1 : (stryCov_9fa48("1776"), (stryMutAct_9fa48("1777") ? base / 0.9 : (stryCov_9fa48("1777"), base * 0.9)) + (stryMutAct_9fa48("1778") ? bonusDimensionScore / 0.1 : (stryCov_9fa48("1778"), bonusDimensionScore * 0.1)))) * 10)) / 10);
  }
}
interface ParsedAssessmentResponse {
  skills: Record<string, {
    score: number;
    subCriteria: Record<string, number>;
    evidence: string[];
    strengths: string[];
    improvements: string[];
  }>;
  codeQuality?: CodeQualityScore | null;
  overallFeedback: string;
  nextSteps: string[];
  knowledgeGaps?: string[];
  hireDecision?: string;
  keyMoments?: any[];
  improvementExamples?: any[];
}
export class CognitiveAnalyzer {
  private maxRetries = 3;
  private retryDelayMs = 1000;

  /**
   * Main entry point for analyzing an interview session
   * Implements retry logic to handle model fallback
   */
  async analyze(sessionId: string, problem: {
    title: string;
    description: string;
    difficulty: string;
    difficultyMode?: DifficultyMode | 'employer';
  }, transcript: ConversationTurn[]): Promise<AssessmentResult> {
    if (stryMutAct_9fa48("1779")) {
      {}
    } else {
      stryCov_9fa48("1779");
      const prompt = generateAssessmentPrompt(problem, transcript, SKILL_DEFINITIONS);
      let lastError: Error | null = null;
      for (let attempt = 1; stryMutAct_9fa48("1782") ? attempt > this.maxRetries : stryMutAct_9fa48("1781") ? attempt < this.maxRetries : stryMutAct_9fa48("1780") ? false : (stryCov_9fa48("1780", "1781", "1782"), attempt <= this.maxRetries); stryMutAct_9fa48("1783") ? attempt-- : (stryCov_9fa48("1783"), attempt++)) {
        if (stryMutAct_9fa48("1784")) {
          {}
        } else {
          stryCov_9fa48("1784");
          try {
            if (stryMutAct_9fa48("1785")) {
              {}
            } else {
              stryCov_9fa48("1785");
              const rawResponse = await this.callAI(prompt);
              const parsedData = this.parseResponse(rawResponse.text) as unknown as ParsedAssessmentResponse;

              // Pre-process: verify subset scores
              for (const skillId of Object.keys(parsedData.skills)) {
                if (stryMutAct_9fa48("1786")) {
                  {}
                } else {
                  stryCov_9fa48("1786");
                  const skill = parsedData.skills[skillId];
                  if (stryMutAct_9fa48("1789") ? skill || skill.subCriteria : stryMutAct_9fa48("1788") ? false : stryMutAct_9fa48("1787") ? true : (stryCov_9fa48("1787", "1788", "1789"), skill && skill.subCriteria)) {
                    if (stryMutAct_9fa48("1790")) {
                      {}
                    } else {
                      stryCov_9fa48("1790");
                      const weighted = computeWeightedScore(skill.subCriteria, skillId as CognitiveSkill);
                      if (stryMutAct_9fa48("1794") ? Math.abs(skill.score - weighted) <= 0.5 : stryMutAct_9fa48("1793") ? Math.abs(skill.score - weighted) >= 0.5 : stryMutAct_9fa48("1792") ? false : stryMutAct_9fa48("1791") ? true : (stryCov_9fa48("1791", "1792", "1793", "1794"), Math.abs(stryMutAct_9fa48("1795") ? skill.score + weighted : (stryCov_9fa48("1795"), skill.score - weighted)) > 0.5)) {
                        if (stryMutAct_9fa48("1796")) {
                          {}
                        } else {
                          stryCov_9fa48("1796");
                          skill.score = weighted;
                        }
                      }
                    }
                  }
                }
              }

              // Two-pass validation
              const userTurnCount = stryMutAct_9fa48("1797") ? transcript.length : (stryCov_9fa48("1797"), transcript.filter(stryMutAct_9fa48("1798") ? () => undefined : (stryCov_9fa48("1798"), t => stryMutAct_9fa48("1801") ? t.role !== 'user' : stryMutAct_9fa48("1800") ? false : stryMutAct_9fa48("1799") ? true : (stryCov_9fa48("1799", "1800", "1801"), t.role === (stryMutAct_9fa48("1802") ? "" : (stryCov_9fa48("1802"), 'user'))))).length);
              const validation = await validateAndCorrectScores(parsedData.skills, userTurnCount);
              const validatedSkills = applyValidation(parsedData.skills, validation);

              // Hard score cap enforcement for short sessions (BUG-07)
              // The validator only caps scores above the threshold, but the LLM
              // may still produce scores that slip through. Enforce ceiling here.
              const shortSessionCap: number | null = (stryMutAct_9fa48("1806") ? userTurnCount > 3 : stryMutAct_9fa48("1805") ? userTurnCount < 3 : stryMutAct_9fa48("1804") ? false : stryMutAct_9fa48("1803") ? true : (stryCov_9fa48("1803", "1804", "1805", "1806"), userTurnCount <= 3)) ? 5 : (stryMutAct_9fa48("1810") ? userTurnCount > 5 : stryMutAct_9fa48("1809") ? userTurnCount < 5 : stryMutAct_9fa48("1808") ? false : stryMutAct_9fa48("1807") ? true : (stryCov_9fa48("1807", "1808", "1809", "1810"), userTurnCount <= 5)) ? 6 : null;
              const isLimitedEvidence = stryMutAct_9fa48("1813") ? shortSessionCap === null : stryMutAct_9fa48("1812") ? false : stryMutAct_9fa48("1811") ? true : (stryCov_9fa48("1811", "1812", "1813"), shortSessionCap !== null);
              if (stryMutAct_9fa48("1816") ? shortSessionCap === null : stryMutAct_9fa48("1815") ? false : stryMutAct_9fa48("1814") ? true : (stryCov_9fa48("1814", "1815", "1816"), shortSessionCap !== null)) {
                if (stryMutAct_9fa48("1817")) {
                  {}
                } else {
                  stryCov_9fa48("1817");
                  for (const skillId of Object.keys(validatedSkills)) {
                    if (stryMutAct_9fa48("1818")) {
                      {}
                    } else {
                      stryCov_9fa48("1818");
                      if (stryMutAct_9fa48("1821") ? validatedSkills[skillId] || validatedSkills[skillId].score > shortSessionCap : stryMutAct_9fa48("1820") ? false : stryMutAct_9fa48("1819") ? true : (stryCov_9fa48("1819", "1820", "1821"), validatedSkills[skillId] && (stryMutAct_9fa48("1824") ? validatedSkills[skillId].score <= shortSessionCap : stryMutAct_9fa48("1823") ? validatedSkills[skillId].score >= shortSessionCap : stryMutAct_9fa48("1822") ? true : (stryCov_9fa48("1822", "1823", "1824"), validatedSkills[skillId].score > shortSessionCap)))) {
                        if (stryMutAct_9fa48("1825")) {
                          {}
                        } else {
                          stryCov_9fa48("1825");
                          validatedSkills[skillId] = stryMutAct_9fa48("1826") ? {} : (stryCov_9fa48("1826"), {
                            ...validatedSkills[skillId],
                            score: stryMutAct_9fa48("1827") ? Math.max(validatedSkills[skillId].score, shortSessionCap) : (stryCov_9fa48("1827"), Math.min(validatedSkills[skillId].score, shortSessionCap))
                          });
                        }
                      }
                    }
                  }
                }
              }

              // Post-process: calculate confidence and finalize structure
              const sessionConfidence = calculateConfidence(transcript, parsedData);
              const finalizedSkills: Record<string, SkillScore> = {};
              Object.keys(SKILL_DEFINITIONS).forEach(skillId => {
                if (stryMutAct_9fa48("1828")) {
                  {}
                } else {
                  stryCov_9fa48("1828");
                  const data = stryMutAct_9fa48("1831") ? validatedSkills[skillId] && {
                    score: 5,
                    subCriteria: {},
                    evidence: [],
                    strengths: [],
                    improvements: []
                  } : stryMutAct_9fa48("1830") ? false : stryMutAct_9fa48("1829") ? true : (stryCov_9fa48("1829", "1830", "1831"), validatedSkills[skillId] || (stryMutAct_9fa48("1832") ? {} : (stryCov_9fa48("1832"), {
                    score: 5,
                    subCriteria: {},
                    evidence: stryMutAct_9fa48("1833") ? ["Stryker was here"] : (stryCov_9fa48("1833"), []),
                    strengths: stryMutAct_9fa48("1834") ? ["Stryker was here"] : (stryCov_9fa48("1834"), []),
                    improvements: stryMutAct_9fa48("1835") ? ["Stryker was here"] : (stryCov_9fa48("1835"), [])
                  })));
                  finalizedSkills[skillId] = stryMutAct_9fa48("1836") ? {} : (stryCov_9fa48("1836"), {
                    ...data,
                    subCriteria: stryMutAct_9fa48("1839") ? data.subCriteria && {} : stryMutAct_9fa48("1838") ? false : stryMutAct_9fa48("1837") ? true : (stryCov_9fa48("1837", "1838", "1839"), data.subCriteria || {}),
                    confidence: sessionConfidence
                  });
                }
              });
              const rawOverall = (() => {
                if (stryMutAct_9fa48("1840")) {
                  {}
                } else {
                  stryCov_9fa48("1840");
                  const modeConf = MODE_ASSESSMENT_CONFIGS[stryMutAct_9fa48("1841") ? problem.difficultyMode && 'practice' : (stryCov_9fa48("1841"), problem.difficultyMode ?? (stryMutAct_9fa48("1842") ? "" : (stryCov_9fa48("1842"), 'practice')))];
                  const bonusKey = stryMutAct_9fa48("1844") ? modeConf.bonusDimension?.jsonKey : stryMutAct_9fa48("1843") ? modeConf?.bonusDimension.jsonKey : (stryCov_9fa48("1843", "1844"), modeConf?.bonusDimension?.jsonKey);
                  const bonusScore = bonusKey ? stryMutAct_9fa48("1845") ? (parsedData as any)?.bonusDimensions?.[bonusKey]?.score && null : (stryCov_9fa48("1845"), (stryMutAct_9fa48("1848") ? (parsedData as any).bonusDimensions?.[bonusKey]?.score : stryMutAct_9fa48("1847") ? (parsedData as any)?.bonusDimensions[bonusKey]?.score : stryMutAct_9fa48("1846") ? (parsedData as any)?.bonusDimensions?.[bonusKey].score : (stryCov_9fa48("1846", "1847", "1848"), (parsedData as any)?.bonusDimensions?.[bonusKey]?.score)) ?? null) : null;
                  return computeOverallScoreWithBonus(finalizedSkills, bonusScore);
                }
              })();
              const DIFFICULTY_MULTIPLIER: Record<string, number> = stryMutAct_9fa48("1849") ? {} : (stryCov_9fa48("1849"), {
                easy: 1.00,
                medium: 1.15,
                hard: 1.30
              });

              // If difficulty string contains easy/medium/hard (could be uppercase or have spaces)
              const normDiff = stryMutAct_9fa48("1851") ? problem.difficulty.toUpperCase().trim() : stryMutAct_9fa48("1850") ? problem.difficulty.toLowerCase() : (stryCov_9fa48("1850", "1851"), problem.difficulty.toLowerCase().trim());
              const multiplier = stryMutAct_9fa48("1852") ? DIFFICULTY_MULTIPLIER[normDiff] && 1.0 : (stryCov_9fa48("1852"), DIFFICULTY_MULTIPLIER[normDiff] ?? 1.0);
              const adjustedOverall = stryMutAct_9fa48("1853") ? Math.max(Math.round(rawOverall * multiplier * 100) / 100, 10.0) : (stryCov_9fa48("1853"), Math.min(stryMutAct_9fa48("1854") ? Math.round(rawOverall * multiplier * 100) * 100 : (stryCov_9fa48("1854"), Math.round(stryMutAct_9fa48("1855") ? rawOverall * multiplier / 100 : (stryCov_9fa48("1855"), (stryMutAct_9fa48("1856") ? rawOverall / multiplier : (stryCov_9fa48("1856"), rawOverall * multiplier)) * 100)) / 100), 10.0));

              // Extract and validate hireDecision
              const VALID_HIRE_DECISIONS = stryMutAct_9fa48("1857") ? [] : (stryCov_9fa48("1857"), [stryMutAct_9fa48("1858") ? "" : (stryCov_9fa48("1858"), 'STRONG_HIRE'), stryMutAct_9fa48("1859") ? "" : (stryCov_9fa48("1859"), 'HIRE'), stryMutAct_9fa48("1860") ? "" : (stryCov_9fa48("1860"), 'BORDERLINE'), stryMutAct_9fa48("1861") ? "" : (stryCov_9fa48("1861"), 'NO_HIRE'), stryMutAct_9fa48("1862") ? "" : (stryCov_9fa48("1862"), 'STRONG_NO_HIRE')]);
              const rawHireDecision = parsedData.hireDecision;
              const hireDecision = (stryMutAct_9fa48("1865") ? rawHireDecision || VALID_HIRE_DECISIONS.includes(rawHireDecision) : stryMutAct_9fa48("1864") ? false : stryMutAct_9fa48("1863") ? true : (stryCov_9fa48("1863", "1864", "1865"), rawHireDecision && VALID_HIRE_DECISIONS.includes(rawHireDecision))) ? rawHireDecision as HireDecision : null;
              return stryMutAct_9fa48("1866") ? {} : (stryCov_9fa48("1866"), {
                sessionId,
                timestamp: new Date(),
                problem,
                skills: finalizedSkills as Record<CognitiveSkill, SkillScore>,
                overallScore: rawOverall,
                rawScore: rawOverall,
                adjustedScore: adjustedOverall,
                overallFeedback: stryMutAct_9fa48("1869") ? parsedData.overallFeedback && "No feedback generated." : stryMutAct_9fa48("1868") ? false : stryMutAct_9fa48("1867") ? true : (stryCov_9fa48("1867", "1868", "1869"), parsedData.overallFeedback || (stryMutAct_9fa48("1870") ? "" : (stryCov_9fa48("1870"), "No feedback generated."))),
                nextSteps: stryMutAct_9fa48("1873") ? parsedData.nextSteps && ["Review the session manually."] : stryMutAct_9fa48("1872") ? false : stryMutAct_9fa48("1871") ? true : (stryCov_9fa48("1871", "1872", "1873"), parsedData.nextSteps || (stryMutAct_9fa48("1874") ? [] : (stryCov_9fa48("1874"), [stryMutAct_9fa48("1875") ? "" : (stryCov_9fa48("1875"), "Review the session manually.")]))),
                knowledgeGaps: stryMutAct_9fa48("1878") ? parsedData.knowledgeGaps && [] : stryMutAct_9fa48("1877") ? false : stryMutAct_9fa48("1876") ? true : (stryCov_9fa48("1876", "1877", "1878"), parsedData.knowledgeGaps || (stryMutAct_9fa48("1879") ? ["Stryker was here"] : (stryCov_9fa48("1879"), []))),
                codeQuality: stryMutAct_9fa48("1882") ? parsedData.codeQuality && null : stryMutAct_9fa48("1881") ? false : stryMutAct_9fa48("1880") ? true : (stryCov_9fa48("1880", "1881", "1882"), parsedData.codeQuality || null),
                modelUsed: stryMutAct_9fa48("1883") ? rawResponse.model && 'gemini-2.0-flash' : (stryCov_9fa48("1883"), rawResponse.model ?? (stryMutAct_9fa48("1884") ? "" : (stryCov_9fa48("1884"), 'gemini-2.0-flash'))),
                validationPassDone: stryMutAct_9fa48("1885") ? false : (stryCov_9fa48("1885"), true),
                hireDecision,
                isLimitedEvidence,
                keyMoments: stryMutAct_9fa48("1888") ? parsedData.keyMoments && [] : stryMutAct_9fa48("1887") ? false : stryMutAct_9fa48("1886") ? true : (stryCov_9fa48("1886", "1887", "1888"), parsedData.keyMoments || (stryMutAct_9fa48("1889") ? ["Stryker was here"] : (stryCov_9fa48("1889"), []))),
                improvementExamples: stryMutAct_9fa48("1892") ? parsedData.improvementExamples && [] : stryMutAct_9fa48("1891") ? false : stryMutAct_9fa48("1890") ? true : (stryCov_9fa48("1890", "1891", "1892"), parsedData.improvementExamples || (stryMutAct_9fa48("1893") ? ["Stryker was here"] : (stryCov_9fa48("1893"), [])))
              });
            }
          } catch (error: unknown) {
            if (stryMutAct_9fa48("1894")) {
              {}
            } else {
              stryCov_9fa48("1894");
              lastError = error instanceof Error ? error : new Error(String(error));
              console.warn(stryMutAct_9fa48("1895") ? `` : (stryCov_9fa48("1895"), `Assessment attempt ${attempt} failed:`), lastError.message);
              if (stryMutAct_9fa48("1899") ? attempt >= this.maxRetries : stryMutAct_9fa48("1898") ? attempt <= this.maxRetries : stryMutAct_9fa48("1897") ? false : stryMutAct_9fa48("1896") ? true : (stryCov_9fa48("1896", "1897", "1898", "1899"), attempt < this.maxRetries)) {
                if (stryMutAct_9fa48("1900")) {
                  {}
                } else {
                  stryCov_9fa48("1900");
                  // Wait before retrying (exponential backoff)
                  const delay = stryMutAct_9fa48("1901") ? this.retryDelayMs / Math.pow(2, attempt - 1) : (stryCov_9fa48("1901"), this.retryDelayMs * Math.pow(2, stryMutAct_9fa48("1902") ? attempt + 1 : (stryCov_9fa48("1902"), attempt - 1)));
                  await new Promise(stryMutAct_9fa48("1903") ? () => undefined : (stryCov_9fa48("1903"), resolve => setTimeout(resolve, delay)));
                }
              }
            }
          }
        }
      }

      // All retries exhausted, return fallback result instead of crashing
      console.error(stryMutAct_9fa48("1904") ? `` : (stryCov_9fa48("1904"), `Assessment failed after ${this.maxRetries} attempts. Returning fallback.`));

      // Detect user_fault vs system_fault for fallback scoring
      const userMessages = stryMutAct_9fa48("1905") ? transcript : (stryCov_9fa48("1905"), transcript.filter(stryMutAct_9fa48("1906") ? () => undefined : (stryCov_9fa48("1906"), t => stryMutAct_9fa48("1909") ? t.role !== 'user' : stryMutAct_9fa48("1908") ? false : stryMutAct_9fa48("1907") ? true : (stryCov_9fa48("1907", "1908", "1909"), t.role === (stryMutAct_9fa48("1910") ? "" : (stryCov_9fa48("1910"), 'user'))))));
      const userText = stryMutAct_9fa48("1911") ? userMessages.map(m => m.content).join(' ').toUpperCase() : (stryCov_9fa48("1911"), userMessages.map(stryMutAct_9fa48("1912") ? () => undefined : (stryCov_9fa48("1912"), m => m.content)).join(stryMutAct_9fa48("1913") ? "" : (stryCov_9fa48("1913"), ' ')).toLowerCase());
      const userWords = userMessages.reduce(stryMutAct_9fa48("1914") ? () => undefined : (stryCov_9fa48("1914"), (count, msg) => stryMutAct_9fa48("1915") ? count - (msg.content.match(/\S+/g) || []).length : (stryCov_9fa48("1915"), count + (stryMutAct_9fa48("1918") ? msg.content.match(/\S+/g) && [] : stryMutAct_9fa48("1917") ? false : stryMutAct_9fa48("1916") ? true : (stryCov_9fa48("1916", "1917", "1918"), msg.content.match(stryMutAct_9fa48("1920") ? /\s+/g : stryMutAct_9fa48("1919") ? /\S/g : (stryCov_9fa48("1919", "1920"), /\S+/g)) || (stryMutAct_9fa48("1921") ? ["Stryker was here"] : (stryCov_9fa48("1921"), [])))).length)), 0);
      const isUserFault = stryMutAct_9fa48("1924") ? userMessages.length === 0 && userWords < 20 : stryMutAct_9fa48("1923") ? false : stryMutAct_9fa48("1922") ? true : (stryCov_9fa48("1922", "1923", "1924"), (stryMutAct_9fa48("1926") ? userMessages.length !== 0 : stryMutAct_9fa48("1925") ? false : (stryCov_9fa48("1925", "1926"), userMessages.length === 0)) || (stryMutAct_9fa48("1929") ? userWords >= 20 : stryMutAct_9fa48("1928") ? userWords <= 20 : stryMutAct_9fa48("1927") ? false : (stryCov_9fa48("1927", "1928", "1929"), userWords < 20)));
      const failureType = isUserFault ? stryMutAct_9fa48("1930") ? "" : (stryCov_9fa48("1930"), 'user_fault') : stryMutAct_9fa48("1931") ? "" : (stryCov_9fa48("1931"), 'system_fault');

      // B1: Per-skill keyword-based fallback scoring (not flat 0 or 5)
      const fallbackSkills: Record<string, SkillScore> = {};
      if (stryMutAct_9fa48("1933") ? false : stryMutAct_9fa48("1932") ? true : (stryCov_9fa48("1932", "1933"), isUserFault)) {
        if (stryMutAct_9fa48("1934")) {
          {}
        } else {
          stryCov_9fa48("1934");
          // Truly insufficient data — all 0
          Object.keys(SKILL_DEFINITIONS).forEach(skillId => {
            if (stryMutAct_9fa48("1935")) {
              {}
            } else {
              stryCov_9fa48("1935");
              fallbackSkills[skillId] = stryMutAct_9fa48("1936") ? {} : (stryCov_9fa48("1936"), {
                score: 0,
                subCriteria: {},
                evidence: stryMutAct_9fa48("1937") ? [] : (stryCov_9fa48("1937"), [stryMutAct_9fa48("1938") ? "" : (stryCov_9fa48("1938"), "Insufficient user interaction to assess skills.")]),
                strengths: stryMutAct_9fa48("1939") ? ["Stryker was here"] : (stryCov_9fa48("1939"), []),
                improvements: stryMutAct_9fa48("1940") ? [] : (stryCov_9fa48("1940"), [stryMutAct_9fa48("1941") ? "" : (stryCov_9fa48("1941"), "Provide more detailed code and explanations.")]),
                confidence: 0
              });
            }
          });
        }
      } else {
        if (stryMutAct_9fa48("1942")) {
          {}
        } else {
          stryCov_9fa48("1942");
          // system_fault: AI failed but user provided good content.
          // Use keyword heuristics to give partial credit per skill.
          const skillKeywords: Record<string, string[]> = stryMutAct_9fa48("1943") ? {} : (stryCov_9fa48("1943"), {
            'problem-decomposition': stryMutAct_9fa48("1944") ? [] : (stryCov_9fa48("1944"), [stryMutAct_9fa48("1945") ? "" : (stryCov_9fa48("1945"), 'break'), stryMutAct_9fa48("1946") ? "" : (stryCov_9fa48("1946"), 'decompose'), stryMutAct_9fa48("1947") ? "" : (stryCov_9fa48("1947"), 'subproblem'), stryMutAct_9fa48("1948") ? "" : (stryCov_9fa48("1948"), 'step'), stryMutAct_9fa48("1949") ? "" : (stryCov_9fa48("1949"), 'divide'), stryMutAct_9fa48("1950") ? "" : (stryCov_9fa48("1950"), 'approach'), stryMutAct_9fa48("1951") ? "" : (stryCov_9fa48("1951"), 'plan'), stryMutAct_9fa48("1952") ? "" : (stryCov_9fa48("1952"), 'first'), stryMutAct_9fa48("1953") ? "" : (stryCov_9fa48("1953"), 'then')]),
            'pattern-recognition': stryMutAct_9fa48("1954") ? [] : (stryCov_9fa48("1954"), [stryMutAct_9fa48("1955") ? "" : (stryCov_9fa48("1955"), 'pattern'), stryMutAct_9fa48("1956") ? "" : (stryCov_9fa48("1956"), 'similar'), stryMutAct_9fa48("1957") ? "" : (stryCov_9fa48("1957"), 'sliding window'), stryMutAct_9fa48("1958") ? "" : (stryCov_9fa48("1958"), 'two pointer'), stryMutAct_9fa48("1959") ? "" : (stryCov_9fa48("1959"), 'dp'), stryMutAct_9fa48("1960") ? "" : (stryCov_9fa48("1960"), 'dynamic programming'), stryMutAct_9fa48("1961") ? "" : (stryCov_9fa48("1961"), 'bfs'), stryMutAct_9fa48("1962") ? "" : (stryCov_9fa48("1962"), 'dfs'), stryMutAct_9fa48("1963") ? "" : (stryCov_9fa48("1963"), 'greedy'), stryMutAct_9fa48("1964") ? "" : (stryCov_9fa48("1964"), 'binary search')]),
            'algorithmic-thinking': stryMutAct_9fa48("1965") ? [] : (stryCov_9fa48("1965"), [stryMutAct_9fa48("1966") ? "" : (stryCov_9fa48("1966"), 'algorithm'), stryMutAct_9fa48("1967") ? "" : (stryCov_9fa48("1967"), 'sort'), stryMutAct_9fa48("1968") ? "" : (stryCov_9fa48("1968"), 'search'), stryMutAct_9fa48("1969") ? "" : (stryCov_9fa48("1969"), 'traverse'), stryMutAct_9fa48("1970") ? "" : (stryCov_9fa48("1970"), 'iterate'), stryMutAct_9fa48("1971") ? "" : (stryCov_9fa48("1971"), 'recursion'), stryMutAct_9fa48("1972") ? "" : (stryCov_9fa48("1972"), 'recursive'), stryMutAct_9fa48("1973") ? "" : (stryCov_9fa48("1973"), 'hash'), stryMutAct_9fa48("1974") ? "" : (stryCov_9fa48("1974"), 'stack'), stryMutAct_9fa48("1975") ? "" : (stryCov_9fa48("1975"), 'queue'), stryMutAct_9fa48("1976") ? "" : (stryCov_9fa48("1976"), 'tree'), stryMutAct_9fa48("1977") ? "" : (stryCov_9fa48("1977"), 'graph'), stryMutAct_9fa48("1978") ? "" : (stryCov_9fa48("1978"), 'array')]),
            'complexity-analysis': stryMutAct_9fa48("1979") ? [] : (stryCov_9fa48("1979"), [stryMutAct_9fa48("1980") ? "" : (stryCov_9fa48("1980"), 'time complexity'), stryMutAct_9fa48("1981") ? "" : (stryCov_9fa48("1981"), 'space complexity'), stryMutAct_9fa48("1982") ? "" : (stryCov_9fa48("1982"), 'o(n)'), stryMutAct_9fa48("1983") ? "" : (stryCov_9fa48("1983"), 'o(log'), stryMutAct_9fa48("1984") ? "" : (stryCov_9fa48("1984"), 'o(1)'), stryMutAct_9fa48("1985") ? "" : (stryCov_9fa48("1985"), 'o(n^2)'), stryMutAct_9fa48("1986") ? "" : (stryCov_9fa48("1986"), 'big o'), stryMutAct_9fa48("1987") ? "" : (stryCov_9fa48("1987"), 'complexity'), stryMutAct_9fa48("1988") ? "" : (stryCov_9fa48("1988"), 'efficient')]),
            'communication-clarity': stryMutAct_9fa48("1989") ? [] : (stryCov_9fa48("1989"), [stryMutAct_9fa48("1990") ? "" : (stryCov_9fa48("1990"), 'because'), stryMutAct_9fa48("1991") ? "" : (stryCov_9fa48("1991"), 'reason'), stryMutAct_9fa48("1992") ? "" : (stryCov_9fa48("1992"), 'explain'), stryMutAct_9fa48("1993") ? "" : (stryCov_9fa48("1993"), 'idea'), stryMutAct_9fa48("1994") ? "" : (stryCov_9fa48("1994"), 'approach is'), stryMutAct_9fa48("1995") ? "" : (stryCov_9fa48("1995"), 'the way'), stryMutAct_9fa48("1996") ? "" : (stryCov_9fa48("1996"), 'basically'), stryMutAct_9fa48("1997") ? "" : (stryCov_9fa48("1997"), 'so the'), stryMutAct_9fa48("1998") ? "" : (stryCov_9fa48("1998"), 'let me')]),
            'edge-case-awareness': stryMutAct_9fa48("1999") ? [] : (stryCov_9fa48("1999"), [stryMutAct_9fa48("2000") ? "" : (stryCov_9fa48("2000"), 'edge case'), stryMutAct_9fa48("2001") ? "" : (stryCov_9fa48("2001"), 'empty'), stryMutAct_9fa48("2002") ? "" : (stryCov_9fa48("2002"), 'null'), stryMutAct_9fa48("2003") ? "" : (stryCov_9fa48("2003"), 'zero'), stryMutAct_9fa48("2004") ? "" : (stryCov_9fa48("2004"), 'negative'), stryMutAct_9fa48("2005") ? "" : (stryCov_9fa48("2005"), 'overflow'), stryMutAct_9fa48("2006") ? "" : (stryCov_9fa48("2006"), 'boundary'), stryMutAct_9fa48("2007") ? "" : (stryCov_9fa48("2007"), 'corner case'), stryMutAct_9fa48("2008") ? "" : (stryCov_9fa48("2008"), 'what if')]),
            'optimization-mindset': stryMutAct_9fa48("2009") ? [] : (stryCov_9fa48("2009"), [stryMutAct_9fa48("2010") ? "" : (stryCov_9fa48("2010"), 'optimize'), stryMutAct_9fa48("2011") ? "" : (stryCov_9fa48("2011"), 'improve'), stryMutAct_9fa48("2012") ? "" : (stryCov_9fa48("2012"), 'better'), stryMutAct_9fa48("2013") ? "" : (stryCov_9fa48("2013"), 'faster'), stryMutAct_9fa48("2014") ? "" : (stryCov_9fa48("2014"), 'reduce'), stryMutAct_9fa48("2015") ? "" : (stryCov_9fa48("2015"), 'efficient'), stryMutAct_9fa48("2016") ? "" : (stryCov_9fa48("2016"), 'optimal'), stryMutAct_9fa48("2017") ? "" : (stryCov_9fa48("2017"), 'trade-off'), stryMutAct_9fa48("2018") ? "" : (stryCov_9fa48("2018"), 'space-time')]),
            'debugging-approach': stryMutAct_9fa48("2019") ? [] : (stryCov_9fa48("2019"), [stryMutAct_9fa48("2020") ? "" : (stryCov_9fa48("2020"), 'debug'), stryMutAct_9fa48("2021") ? "" : (stryCov_9fa48("2021"), 'trace'), stryMutAct_9fa48("2022") ? "" : (stryCov_9fa48("2022"), 'print'), stryMutAct_9fa48("2023") ? "" : (stryCov_9fa48("2023"), 'test'), stryMutAct_9fa48("2024") ? "" : (stryCov_9fa48("2024"), 'dry run'), stryMutAct_9fa48("2025") ? "" : (stryCov_9fa48("2025"), 'walk through'), stryMutAct_9fa48("2026") ? "" : (stryCov_9fa48("2026"), 'check'), stryMutAct_9fa48("2027") ? "" : (stryCov_9fa48("2027"), 'verify'), stryMutAct_9fa48("2028") ? "" : (stryCov_9fa48("2028"), 'output')])
          });
          Object.keys(SKILL_DEFINITIONS).forEach(skillId => {
            if (stryMutAct_9fa48("2029")) {
              {}
            } else {
              stryCov_9fa48("2029");
              const keywords = stryMutAct_9fa48("2032") ? skillKeywords[skillId] && [] : stryMutAct_9fa48("2031") ? false : stryMutAct_9fa48("2030") ? true : (stryCov_9fa48("2030", "2031", "2032"), skillKeywords[skillId] || (stryMutAct_9fa48("2033") ? ["Stryker was here"] : (stryCov_9fa48("2033"), [])));
              const matchCount = stryMutAct_9fa48("2034") ? keywords.length : (stryCov_9fa48("2034"), keywords.filter(stryMutAct_9fa48("2035") ? () => undefined : (stryCov_9fa48("2035"), kw => userText.includes(kw))).length);
              // Base score 3 for system_fault (AI failed, not user). Bonus for keyword matches (max +3).
              const score = stryMutAct_9fa48("2036") ? Math.max(3 + Math.floor(matchCount * 1.5), 6) : (stryCov_9fa48("2036"), Math.min(stryMutAct_9fa48("2037") ? 3 - Math.floor(matchCount * 1.5) : (stryCov_9fa48("2037"), 3 + Math.floor(stryMutAct_9fa48("2038") ? matchCount / 1.5 : (stryCov_9fa48("2038"), matchCount * 1.5))), 6));
              fallbackSkills[skillId] = stryMutAct_9fa48("2039") ? {} : (stryCov_9fa48("2039"), {
                score,
                subCriteria: {},
                evidence: (stryMutAct_9fa48("2043") ? matchCount <= 0 : stryMutAct_9fa48("2042") ? matchCount >= 0 : stryMutAct_9fa48("2041") ? false : stryMutAct_9fa48("2040") ? true : (stryCov_9fa48("2040", "2041", "2042", "2043"), matchCount > 0)) ? stryMutAct_9fa48("2044") ? [] : (stryCov_9fa48("2044"), [stryMutAct_9fa48("2045") ? `` : (stryCov_9fa48("2045"), `Keyword-based fallback: detected ${matchCount} relevant terms. Scores may update when AI analysis retries.`)]) : stryMutAct_9fa48("2046") ? [] : (stryCov_9fa48("2046"), [stryMutAct_9fa48("2047") ? "" : (stryCov_9fa48("2047"), "AI analysis failed. Scores are estimated and may update shortly.")]),
                strengths: stryMutAct_9fa48("2048") ? ["Stryker was here"] : (stryCov_9fa48("2048"), []),
                improvements: stryMutAct_9fa48("2049") ? [] : (stryCov_9fa48("2049"), [stryMutAct_9fa48("2050") ? "" : (stryCov_9fa48("2050"), "Scores are based on keyword analysis due to AI failure. A full AI re-analysis may provide more accurate results.")]),
                confidence: 0.2 // Low confidence indicates keyword-based fallback
              });
            }
          });
        }
      }

      // Compute fallback overall
      const skillScores = Object.values(fallbackSkills).map(stryMutAct_9fa48("2051") ? () => undefined : (stryCov_9fa48("2051"), s => s.score));
      const rawOverallFallback = (stryMutAct_9fa48("2055") ? skillScores.length <= 0 : stryMutAct_9fa48("2054") ? skillScores.length >= 0 : stryMutAct_9fa48("2053") ? false : stryMutAct_9fa48("2052") ? true : (stryCov_9fa48("2052", "2053", "2054", "2055"), skillScores.length > 0)) ? stryMutAct_9fa48("2056") ? Math.round(skillScores.reduce((a, b) => a + b, 0) / skillScores.length * 10) * 10 : (stryCov_9fa48("2056"), Math.round(stryMutAct_9fa48("2057") ? skillScores.reduce((a, b) => a + b, 0) / skillScores.length / 10 : (stryCov_9fa48("2057"), (stryMutAct_9fa48("2058") ? skillScores.reduce((a, b) => a + b, 0) * skillScores.length : (stryCov_9fa48("2058"), skillScores.reduce(stryMutAct_9fa48("2059") ? () => undefined : (stryCov_9fa48("2059"), (a, b) => stryMutAct_9fa48("2060") ? a - b : (stryCov_9fa48("2060"), a + b)), 0) / skillScores.length)) * 10)) / 10) : 0;
      const normDiffFallback = stryMutAct_9fa48("2062") ? problem.difficulty.toUpperCase().trim() : stryMutAct_9fa48("2061") ? problem.difficulty.toLowerCase() : (stryCov_9fa48("2061", "2062"), problem.difficulty.toLowerCase().trim());
      const multiplierFallback = stryMutAct_9fa48("2063") ? {
        easy: 1.0,
        medium: 1.15,
        hard: 1.3
      }[normDiffFallback] && 1.0 : (stryCov_9fa48("2063"), (stryMutAct_9fa48("2064") ? {} : (stryCov_9fa48("2064"), {
        easy: 1.0,
        medium: 1.15,
        hard: 1.3
      }))[normDiffFallback] ?? 1.0);
      const adjustedOverallFallback = stryMutAct_9fa48("2065") ? Math.max(Math.round(rawOverallFallback * multiplierFallback * 100) / 100, 10.0) : (stryCov_9fa48("2065"), Math.min(stryMutAct_9fa48("2066") ? Math.round(rawOverallFallback * multiplierFallback * 100) * 100 : (stryCov_9fa48("2066"), Math.round(stryMutAct_9fa48("2067") ? rawOverallFallback * multiplierFallback / 100 : (stryCov_9fa48("2067"), (stryMutAct_9fa48("2068") ? rawOverallFallback / multiplierFallback : (stryCov_9fa48("2068"), rawOverallFallback * multiplierFallback)) * 100)) / 100), 10.0));
      return stryMutAct_9fa48("2069") ? {} : (stryCov_9fa48("2069"), {
        sessionId,
        timestamp: new Date(),
        problem,
        skills: fallbackSkills as Record<CognitiveSkill, SkillScore>,
        overallScore: rawOverallFallback,
        rawScore: rawOverallFallback,
        adjustedScore: adjustedOverallFallback,
        overallFeedback: isUserFault ? stryMutAct_9fa48("2070") ? "" : (stryCov_9fa48("2070"), "Your session had too little discussion for accurate scoring. Try engaging more with KAI.") : stryMutAct_9fa48("2071") ? "" : (stryCov_9fa48("2071"), "Our AI analysis is being retried. Scores may update shortly."),
        nextSteps: isUserFault ? stryMutAct_9fa48("2072") ? [] : (stryCov_9fa48("2072"), [stryMutAct_9fa48("2073") ? "" : (stryCov_9fa48("2073"), "Engage more comprehensively in the next interview to receive an assessment.")]) : stryMutAct_9fa48("2074") ? [] : (stryCov_9fa48("2074"), [stryMutAct_9fa48("2075") ? "" : (stryCov_9fa48("2075"), "Scores are based on keyword analysis. Full AI re-analysis may provide more accurate results.")]),
        knowledgeGaps: stryMutAct_9fa48("2076") ? ["Stryker was here"] : (stryCov_9fa48("2076"), []),
        analysisFailure: failureType,
        keyMoments: stryMutAct_9fa48("2077") ? ["Stryker was here"] : (stryCov_9fa48("2077"), []),
        improvementExamples: stryMutAct_9fa48("2078") ? ["Stryker was here"] : (stryCov_9fa48("2078"), [])
      });
    }
  }
  private async callAI(prompt: string): Promise<{
    text: string;
    model: string;
  }> {
    if (stryMutAct_9fa48("2079")) {
      {}
    } else {
      stryCov_9fa48("2079");
      // Use UnifiedAIClient directly instead of internal API fetch
      const {
        getAIClient
      } = await import('@/lib/ai/client');
      const client = getAIClient();
      const result = await client.generateCompletion(stryMutAct_9fa48("2080") ? [] : (stryCov_9fa48("2080"), [stryMutAct_9fa48("2081") ? {} : (stryCov_9fa48("2081"), {
        role: stryMutAct_9fa48("2082") ? "" : (stryCov_9fa48("2082"), 'user'),
        content: prompt
      })]), stryMutAct_9fa48("2083") ? {} : (stryCov_9fa48("2083"), {
        category: stryMutAct_9fa48("2084") ? "" : (stryCov_9fa48("2084"), 'analysis'),
        systemPrompt: stryMutAct_9fa48("2085") ? "" : (stryCov_9fa48("2085"), "You are a professional assessment engine. Return only valid JSON."),
        maxTokens: 4096,
        estimatedTokens: 2000,
        responseFormat: stryMutAct_9fa48("2086") ? {} : (stryCov_9fa48("2086"), {
          type: stryMutAct_9fa48("2087") ? "" : (stryCov_9fa48("2087"), 'json_object')
        })
      }));
      if (stryMutAct_9fa48("2090") ? !result.success && !result.response : stryMutAct_9fa48("2089") ? false : stryMutAct_9fa48("2088") ? true : (stryCov_9fa48("2088", "2089", "2090"), (stryMutAct_9fa48("2091") ? result.success : (stryCov_9fa48("2091"), !result.success)) || (stryMutAct_9fa48("2092") ? result.response : (stryCov_9fa48("2092"), !result.response)))) {
        if (stryMutAct_9fa48("2093")) {
          {}
        } else {
          stryCov_9fa48("2093");
          throw new Error(stryMutAct_9fa48("2094") ? `` : (stryCov_9fa48("2094"), `AI Analysis failed: ${result.error}`));
        }
      }
      return stryMutAct_9fa48("2095") ? {} : (stryCov_9fa48("2095"), {
        text: result.response,
        model: stryMutAct_9fa48("2098") ? result.modelUsed && 'gemini-2.0-flash' : stryMutAct_9fa48("2097") ? false : stryMutAct_9fa48("2096") ? true : (stryCov_9fa48("2096", "2097", "2098"), result.modelUsed || (stryMutAct_9fa48("2099") ? "" : (stryCov_9fa48("2099"), 'gemini-2.0-flash')))
      });
    }
  }
  private parseResponse(raw: string): unknown {
    if (stryMutAct_9fa48("2100")) {
      {}
    } else {
      stryCov_9fa48("2100");
      // 1. Strip markdown fences more thoroughly
      let jsonString = stryMutAct_9fa48("2101") ? raw.replace(/^```(?:json)?\s*/i, '') // Opening fence
      .replace(/```\s*$/i, '') // Closing fence
      : (stryCov_9fa48("2101"), raw.replace(stryMutAct_9fa48("2105") ? /^```(?:json)?\S*/i : stryMutAct_9fa48("2104") ? /^```(?:json)?\s/i : stryMutAct_9fa48("2103") ? /^```(?:json)\s*/i : stryMutAct_9fa48("2102") ? /```(?:json)?\s*/i : (stryCov_9fa48("2102", "2103", "2104", "2105"), /^```(?:json)?\s*/i), stryMutAct_9fa48("2106") ? "Stryker was here!" : (stryCov_9fa48("2106"), '')) // Opening fence
      .replace(stryMutAct_9fa48("2109") ? /```\S*$/i : stryMutAct_9fa48("2108") ? /```\s$/i : stryMutAct_9fa48("2107") ? /```\s*/i : (stryCov_9fa48("2107", "2108", "2109"), /```\s*$/i), stryMutAct_9fa48("2110") ? "Stryker was here!" : (stryCov_9fa48("2110"), '')) // Closing fence
      .trim());

      // 2. Try to find JSON object boundaries if wrapped in extra text
      const jsonStart = jsonString.indexOf(stryMutAct_9fa48("2111") ? "" : (stryCov_9fa48("2111"), '{'));
      const jsonEnd = jsonString.lastIndexOf(stryMutAct_9fa48("2112") ? "" : (stryCov_9fa48("2112"), '}'));
      if (stryMutAct_9fa48("2115") ? jsonStart !== -1 && jsonEnd !== -1 || jsonEnd > jsonStart : stryMutAct_9fa48("2114") ? false : stryMutAct_9fa48("2113") ? true : (stryCov_9fa48("2113", "2114", "2115"), (stryMutAct_9fa48("2117") ? jsonStart !== -1 || jsonEnd !== -1 : stryMutAct_9fa48("2116") ? true : (stryCov_9fa48("2116", "2117"), (stryMutAct_9fa48("2119") ? jsonStart === -1 : stryMutAct_9fa48("2118") ? true : (stryCov_9fa48("2118", "2119"), jsonStart !== (stryMutAct_9fa48("2120") ? +1 : (stryCov_9fa48("2120"), -1)))) && (stryMutAct_9fa48("2122") ? jsonEnd === -1 : stryMutAct_9fa48("2121") ? true : (stryCov_9fa48("2121", "2122"), jsonEnd !== (stryMutAct_9fa48("2123") ? +1 : (stryCov_9fa48("2123"), -1)))))) && (stryMutAct_9fa48("2126") ? jsonEnd <= jsonStart : stryMutAct_9fa48("2125") ? jsonEnd >= jsonStart : stryMutAct_9fa48("2124") ? true : (stryCov_9fa48("2124", "2125", "2126"), jsonEnd > jsonStart)))) {
        if (stryMutAct_9fa48("2127")) {
          {}
        } else {
          stryCov_9fa48("2127");
          jsonString = stryMutAct_9fa48("2128") ? jsonString : (stryCov_9fa48("2128"), jsonString.slice(jsonStart, stryMutAct_9fa48("2129") ? jsonEnd - 1 : (stryCov_9fa48("2129"), jsonEnd + 1)));
        }
      }

      // 3. Check if response appears truncated (no closing brace or ends abruptly)
      const openBraces = (stryMutAct_9fa48("2132") ? jsonString.match(/{/g) && [] : stryMutAct_9fa48("2131") ? false : stryMutAct_9fa48("2130") ? true : (stryCov_9fa48("2130", "2131", "2132"), jsonString.match(/{/g) || (stryMutAct_9fa48("2133") ? ["Stryker was here"] : (stryCov_9fa48("2133"), [])))).length;
      const closeBraces = (stryMutAct_9fa48("2136") ? jsonString.match(/}/g) && [] : stryMutAct_9fa48("2135") ? false : stryMutAct_9fa48("2134") ? true : (stryCov_9fa48("2134", "2135", "2136"), jsonString.match(/}/g) || (stryMutAct_9fa48("2137") ? ["Stryker was here"] : (stryCov_9fa48("2137"), [])))).length;
      if (stryMutAct_9fa48("2140") ? openBraces === closeBraces : stryMutAct_9fa48("2139") ? false : stryMutAct_9fa48("2138") ? true : (stryCov_9fa48("2138", "2139", "2140"), openBraces !== closeBraces)) {
        if (stryMutAct_9fa48("2141")) {
          {}
        } else {
          stryCov_9fa48("2141");
          console.error(stryMutAct_9fa48("2142") ? "" : (stryCov_9fa48("2142"), "AI response appears truncated - mismatched braces:"), stryMutAct_9fa48("2143") ? {} : (stryCov_9fa48("2143"), {
            openBraces,
            closeBraces
          }));
          throw new Error(stryMutAct_9fa48("2144") ? `` : (stryCov_9fa48("2144"), `AI response truncated (${openBraces} open braces, ${closeBraces} close braces). Retry with another model.`));
        }
      }
      try {
        if (stryMutAct_9fa48("2145")) {
          {}
        } else {
          stryCov_9fa48("2145");
          const parsed = JSON.parse(jsonString);

          // Validate required fields exist
          if (stryMutAct_9fa48("2148") ? false : stryMutAct_9fa48("2147") ? true : stryMutAct_9fa48("2146") ? parsed.skills : (stryCov_9fa48("2146", "2147", "2148"), !parsed.skills)) {
            if (stryMutAct_9fa48("2149")) {
              {}
            } else {
              stryCov_9fa48("2149");
              throw new Error(stryMutAct_9fa48("2150") ? "" : (stryCov_9fa48("2150"), "Invalid response format: missing 'skills' object"));
            }
          }

          // Validate we have at least some skill scores
          const skillCount = Object.keys(parsed.skills).length;
          if (stryMutAct_9fa48("2153") ? skillCount !== 0 : stryMutAct_9fa48("2152") ? false : stryMutAct_9fa48("2151") ? true : (stryCov_9fa48("2151", "2152", "2153"), skillCount === 0)) {
            if (stryMutAct_9fa48("2154")) {
              {}
            } else {
              stryCov_9fa48("2154");
              throw new Error(stryMutAct_9fa48("2155") ? "" : (stryCov_9fa48("2155"), "Invalid response format: 'skills' object is empty"));
            }
          }
          return parsed;
        }
      } catch (e) {
        if (stryMutAct_9fa48("2156")) {
          {}
        } else {
          stryCov_9fa48("2156");
          const errorDetail = e instanceof Error ? e.message : stryMutAct_9fa48("2157") ? "" : (stryCov_9fa48("2157"), 'Unknown parse error');
          console.error(stryMutAct_9fa48("2158") ? "" : (stryCov_9fa48("2158"), "Failed to parse AI JSON response:"), errorDetail);
          console.error(stryMutAct_9fa48("2159") ? "" : (stryCov_9fa48("2159"), "Raw response (first 500 chars):"), stryMutAct_9fa48("2160") ? raw : (stryCov_9fa48("2160"), raw.substring(0, 500)));

          // Throw error to trigger model fallback in AI client
          throw new Error(stryMutAct_9fa48("2161") ? `` : (stryCov_9fa48("2161"), `Assessment parse failed: ${errorDetail}. The AI model may need to retry.`));
        }
      }
    }
  }
}