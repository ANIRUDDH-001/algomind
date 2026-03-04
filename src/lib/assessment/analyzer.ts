import { CognitiveSkill } from '@/types/assessment';
import type { DifficultyMode } from '../interview/interview-config';
import { SKILL_DEFINITIONS } from './skill-registry';
import { ConversationTurn, generateAssessmentPrompt } from './prompts';
import { calculateConfidence } from './confidence-calculator';
import { validateAndCorrectScores, applyValidation } from './score-validator';

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
    problem: { title: string; description: string; difficulty: string };
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
}

function computeWeightedScore(
    subCriteriaScores: Record<string, number>,
    skillId: CognitiveSkill
): number {
    const def = SKILL_DEFINITIONS[skillId];
    if (!def || !def.subCriteria) return 5;
    let total = 0;
    for (const sc of def.subCriteria) {
        total += (subCriteriaScores[sc.id] ?? 5) * sc.weight;
    }
    return Math.round(total * 10) / 10;
}

function computeOverallScore(skills: Record<string, SkillScore>): number {
    let totalWeight = 0;
    let weightedSum = 0;

    Object.keys(skills).forEach(skillId => {
        const def = SKILL_DEFINITIONS[skillId as CognitiveSkill];
        if (def) {
            totalWeight += def.weight;
            weightedSum += skills[skillId].score * def.weight;
        }
    });

    return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : 5;
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
}

export class CognitiveAnalyzer {
    private maxRetries = 3;
    private retryDelayMs = 1000;

    /**
     * Main entry point for analyzing an interview session
     * Implements retry logic to handle model fallback
     */
    async analyze(
        sessionId: string,
        problem: { title: string; description: string; difficulty: string; difficultyMode?: DifficultyMode | 'employer' },
        transcript: ConversationTurn[]
    ): Promise<AssessmentResult> {
        const prompt = generateAssessmentPrompt(problem, transcript, SKILL_DEFINITIONS);

        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                const rawResponse = await this.callAI(prompt);
                const parsedData = this.parseResponse(rawResponse.text) as unknown as ParsedAssessmentResponse;

                // Pre-process: verify subset scores
                for (const skillId of Object.keys(parsedData.skills)) {
                    const skill = parsedData.skills[skillId];
                    if (skill && skill.subCriteria) {
                        const weighted = computeWeightedScore(skill.subCriteria, skillId as CognitiveSkill);
                        if (Math.abs(skill.score - weighted) > 0.5) {
                            skill.score = weighted;
                        }
                    }
                }

                // Two-pass validation
                const userTurnCount = transcript.filter(t => t.role === 'user').length;
                const validation = await validateAndCorrectScores(parsedData.skills, userTurnCount);
                const validatedSkills = applyValidation(parsedData.skills, validation);

                // Post-process: calculate confidence and finalize structure
                const sessionConfidence = calculateConfidence(transcript, parsedData);

                const finalizedSkills: Record<string, SkillScore> = {};
                Object.keys(SKILL_DEFINITIONS).forEach((skillId) => {
                    const data = validatedSkills[skillId] || {
                        score: 5,
                        subCriteria: {},
                        evidence: [],
                        strengths: [],
                        improvements: []
                    };
                    finalizedSkills[skillId] = {
                        ...data,
                        subCriteria: data.subCriteria || {},
                        confidence: sessionConfidence
                    };
                });

                const rawOverall = computeOverallScore(finalizedSkills);

                const DIFFICULTY_MULTIPLIER: Record<string, number> = {
                    easy: 1.00,
                    medium: 1.15,
                    hard: 1.30,
                };

                // If difficulty string contains easy/medium/hard (could be uppercase or have spaces)
                const normDiff = problem.difficulty.toLowerCase().trim();
                const multiplier = DIFFICULTY_MULTIPLIER[normDiff] ?? 1.0;
                const adjustedOverall = Math.min(
                    Math.round(rawOverall * multiplier * 100) / 100,
                    10.0
                );

                // Extract and validate hireDecision
                const VALID_HIRE_DECISIONS = ['STRONG_HIRE', 'HIRE', 'BORDERLINE', 'NO_HIRE', 'STRONG_NO_HIRE'];
                const rawHireDecision = parsedData.hireDecision;
                const hireDecision = (rawHireDecision && VALID_HIRE_DECISIONS.includes(rawHireDecision))
                    ? rawHireDecision as HireDecision
                    : null;

                return {
                    sessionId,
                    timestamp: new Date(),
                    problem,
                    skills: finalizedSkills as Record<CognitiveSkill, SkillScore>,
                    overallScore: rawOverall,
                    rawScore: rawOverall,
                    adjustedScore: adjustedOverall,
                    overallFeedback: parsedData.overallFeedback || "No feedback generated.",
                    nextSteps: parsedData.nextSteps || ["Review the session manually."],
                    knowledgeGaps: parsedData.knowledgeGaps || [],
                    codeQuality: parsedData.codeQuality || null,
                    modelUsed: rawResponse.model ?? 'gemini-2.0-flash',
                    validationPassDone: true,
                    hireDecision,
                };

            } catch (error: unknown) {
                lastError = error instanceof Error ? error : new Error(String(error));
                console.warn(`Assessment attempt ${attempt} failed:`, lastError.message);

                if (attempt < this.maxRetries) {
                    // Wait before retrying (exponential backoff)
                    const delay = this.retryDelayMs * Math.pow(2, attempt - 1);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        // All retries exhausted, return fallback result instead of crashing
        console.error(`Assessment failed after ${this.maxRetries} attempts. Returning fallback.`);

        // Detect user_fault vs system_fault for fallback scoring
        const userMessages = transcript.filter(t => t.role === 'user');
        const userText = userMessages.map(m => m.content).join(' ').toLowerCase();
        const userWords = userMessages.reduce((count, msg) => count + (msg.content.match(/\S+/g) || []).length, 0);
        const isUserFault = userMessages.length === 0 || userWords < 20;
        const failureType = isUserFault ? 'user_fault' : 'system_fault';

        // B1: Per-skill keyword-based fallback scoring (not flat 0 or 5)
        const fallbackSkills: Record<string, SkillScore> = {};
        if (isUserFault) {
            // Truly insufficient data — all 0
            Object.keys(SKILL_DEFINITIONS).forEach((skillId) => {
                fallbackSkills[skillId] = {
                    score: 0,
                    subCriteria: {},
                    evidence: ["Insufficient user interaction to assess skills."],
                    strengths: [],
                    improvements: ["Provide more detailed code and explanations."],
                    confidence: 0,
                };
            });
        } else {
            // system_fault: AI failed but user provided good content.
            // Use keyword heuristics to give partial credit per skill.
            const skillKeywords: Record<string, string[]> = {
                'problem-decomposition': ['break', 'decompose', 'subproblem', 'step', 'divide', 'approach', 'plan', 'first', 'then'],
                'pattern-recognition': ['pattern', 'similar', 'sliding window', 'two pointer', 'dp', 'dynamic programming', 'bfs', 'dfs', 'greedy', 'binary search'],
                'algorithmic-thinking': ['algorithm', 'sort', 'search', 'traverse', 'iterate', 'recursion', 'recursive', 'hash', 'stack', 'queue', 'tree', 'graph', 'array'],
                'complexity-analysis': ['time complexity', 'space complexity', 'o(n)', 'o(log', 'o(1)', 'o(n^2)', 'big o', 'complexity', 'efficient'],
                'communication-clarity': ['because', 'reason', 'explain', 'idea', 'approach is', 'the way', 'basically', 'so the', 'let me'],
                'edge-case-awareness': ['edge case', 'empty', 'null', 'zero', 'negative', 'overflow', 'boundary', 'corner case', 'what if'],
                'optimization-mindset': ['optimize', 'improve', 'better', 'faster', 'reduce', 'efficient', 'optimal', 'trade-off', 'space-time'],
                'debugging-approach': ['debug', 'trace', 'print', 'test', 'dry run', 'walk through', 'check', 'verify', 'output'],
            };

            Object.keys(SKILL_DEFINITIONS).forEach((skillId) => {
                const keywords = skillKeywords[skillId] || [];
                const matchCount = keywords.filter(kw => userText.includes(kw)).length;
                // Base score 3 for system_fault (AI failed, not user). Bonus for keyword matches (max +3).
                const score = Math.min(3 + Math.floor(matchCount * 1.5), 6);
                fallbackSkills[skillId] = {
                    score,
                    subCriteria: {},
                    evidence: matchCount > 0
                        ? [`Keyword-based fallback: detected ${matchCount} relevant terms. Scores may update when AI analysis retries.`]
                        : ["AI analysis failed. Scores are estimated and may update shortly."],
                    strengths: [],
                    improvements: ["Scores are based on keyword analysis due to AI failure. A full AI re-analysis may provide more accurate results."],
                    confidence: 0.2, // Low confidence indicates keyword-based fallback
                };
            });
        }

        // Compute fallback overall
        const skillScores = Object.values(fallbackSkills).map(s => s.score);
        const rawOverallFallback = skillScores.length > 0
            ? Math.round((skillScores.reduce((a, b) => a + b, 0) / skillScores.length) * 10) / 10
            : 0;
        const normDiffFallback = problem.difficulty.toLowerCase().trim();
        const multiplierFallback = { easy: 1.0, medium: 1.15, hard: 1.3 }[normDiffFallback] ?? 1.0;
        const adjustedOverallFallback = Math.min(
            Math.round(rawOverallFallback * multiplierFallback * 100) / 100,
            10.0
        );

        return {
            sessionId,
            timestamp: new Date(),
            problem,
            skills: fallbackSkills as Record<CognitiveSkill, SkillScore>,
            overallScore: rawOverallFallback,
            rawScore: rawOverallFallback,
            adjustedScore: adjustedOverallFallback,
            overallFeedback: isUserFault
                ? "Your session had too little discussion for accurate scoring. Try engaging more with KAI."
                : "Our AI analysis is being retried. Scores may update shortly.",
            nextSteps: isUserFault
                ? ["Engage more comprehensively in the next interview to receive an assessment."]
                : ["Scores are based on keyword analysis. Full AI re-analysis may provide more accurate results."],
            knowledgeGaps: [],
            analysisFailure: failureType
        };
    }

    private async callAI(prompt: string): Promise<{ text: string, model: string }> {
        // Use UnifiedAIClient directly instead of internal API fetch
        const { getAIClient } = await import('@/lib/ai/client');
        const client = getAIClient();

        const result = await client.generateCompletion(
            [{ role: 'user', content: prompt }],
            {
                category: 'analysis',
                systemPrompt: "You are a professional assessment engine. Return only valid JSON.",
                maxTokens: 4096,
                estimatedTokens: 2000
            }
        );

        if (!result.success || !result.response) {
            throw new Error(`AI Analysis failed: ${result.error}`);
        }

        return { text: result.response, model: result.modelUsed || 'gemini-2.0-flash' };
    }


    private parseResponse(raw: string): unknown {
        // 1. Strip markdown fences more thoroughly
        let jsonString = raw
            .replace(/^```(?:json)?\s*/i, '')  // Opening fence
            .replace(/```\s*$/i, '')           // Closing fence
            .trim();

        // 2. Try to find JSON object boundaries if wrapped in extra text
        const jsonStart = jsonString.indexOf('{');
        const jsonEnd = jsonString.lastIndexOf('}');

        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
            jsonString = jsonString.slice(jsonStart, jsonEnd + 1);
        }

        // 3. Check if response appears truncated (no closing brace or ends abruptly)
        const openBraces = (jsonString.match(/{/g) || []).length;
        const closeBraces = (jsonString.match(/}/g) || []).length;

        if (openBraces !== closeBraces) {
            console.error("AI response appears truncated - mismatched braces:", { openBraces, closeBraces });
            throw new Error(`AI response truncated (${openBraces} open braces, ${closeBraces} close braces). Retry with another model.`);
        }

        try {
            const parsed = JSON.parse(jsonString);

            // Validate required fields exist
            if (!parsed.skills) {
                throw new Error("Invalid response format: missing 'skills' object");
            }

            // Validate we have at least some skill scores
            const skillCount = Object.keys(parsed.skills).length;
            if (skillCount === 0) {
                throw new Error("Invalid response format: 'skills' object is empty");
            }

            return parsed;

        } catch (e) {
            const errorDetail = e instanceof Error ? e.message : 'Unknown parse error';
            console.error("Failed to parse AI JSON response:", errorDetail);
            console.error("Raw response (first 500 chars):", raw.substring(0, 500));

            // Throw error to trigger model fallback in AI client
            throw new Error(`Assessment parse failed: ${errorDetail}. The AI model may need to retry.`);
        }
    }
}

