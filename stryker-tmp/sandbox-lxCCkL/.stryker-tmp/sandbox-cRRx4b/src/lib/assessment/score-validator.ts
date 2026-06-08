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
 */

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

const VALIDATION_PROMPT = `You are a scoring calibrator for technical interviews. Apply these rules STRICTLY:

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
}`;

export async function validateAndCorrectScores(
    initialScores: Record<string, ParsedSkillScore>,
    conversationLength: number
): Promise<ValidationResult> {
    // B1: Graduated short-session cap instead of flat boolean
    // 2-3 turns → cap 5, 4-5 turns → cap 6, 6+ → no cap
    const shortSessionCap: number | null =
        conversationLength <= 3 ? 5 :
        conversationLength <= 5 ? 6 :
        null;
    const isShortSession = shortSessionCap !== null;

    const scoresSummary = Object.entries(initialScores)
        .map(([dim, s]) =>
            `${dim}: score=${s.score}, evidence="${(s.evidence || []).slice(0, 2).join('; ').substring(0, 150)}"`
        )
        .join('\n');

    try {
        const client = getAIClient();
        const result = await client.generateCompletion(
            [
                {
                    role: 'user',
                    content: `Session length: ${conversationLength} turns. Short session: ${isShortSession}.\n\nInitial scores with evidence:\n${scoresSummary}\n\n${VALIDATION_PROMPT}`,
                },
            ],
            {
                maxTokens: 400,
                category: 'analysis',
                systemPrompt: 'You are a strict scoring calibrator. Return only valid JSON.',
            }
        );

        if (!result.success || !result.response) {
            return { correctedScores: {}, inflationDetected: false, validationNotes: 'Validation skipped.' };
        }

        const clean = result.response.replace(/```json|```/gi, '').trim();
        const parsed = JSON.parse(clean);

        // Map camelCase dimension names to dash-case skill IDs for lookup
        const camelToDash: Record<string, string> = {
            problemDecomposition: 'problem-decomposition',
            patternRecognition: 'pattern-recognition',
            algorithmicThinking: 'algorithmic-thinking',
            complexityAnalysis: 'complexity-analysis',
            communicationClarity: 'communication-clarity',
            edgeCaseAwareness: 'edge-case-awareness',
            optimizationMindset: 'optimization-mindset',
            debuggingApproach: 'debugging-approach',
        };

        // Apply graduated hard caps for short sessions
        if (shortSessionCap !== null) {
            Object.keys(parsed.correctedScores).forEach((dim) => {
                const dashKey = camelToDash[dim] || dim;
                const current = initialScores[dashKey]?.score || 0;
                if (current > shortSessionCap) {
                    parsed.correctedScores[dim] = Math.min(parsed.correctedScores[dim] ?? current, shortSessionCap);
                    parsed.inflationDetected = true;
                }
            });
        }

        return parsed as ValidationResult;
    } catch (e) {
        console.error('[ScoreValidator] Validation crashed — raw scores will pass through uncorrected:', e);
        return { correctedScores: {}, inflationDetected: false, validationNotes: 'Validation error.' };
    }
}

/**
 * Apply corrections to the initial parsed assessment response.
 * Returns a new skills object with corrected scores.
 */
export function applyValidation(
    skills: Record<string, ParsedSkillScore>,
    validation: ValidationResult
): Record<string, ParsedSkillScore> {
    const corrected = { ...skills };

    // Map camelCase dimension names to dash-case skill IDs
    const camelToDash: Record<string, string> = {
        problemDecomposition: 'problem-decomposition',
        patternRecognition: 'pattern-recognition',
        algorithmicThinking: 'algorithmic-thinking',
        complexityAnalysis: 'complexity-analysis',
        communicationClarity: 'communication-clarity',
        edgeCaseAwareness: 'edge-case-awareness',
        optimizationMindset: 'optimization-mindset',
        debuggingApproach: 'debugging-approach',
    };

    Object.entries(validation.correctedScores).forEach(([camelDim, correctedScore]) => {
        if (correctedScore === null) return;
        const dashId = camelToDash[camelDim];
        if (dashId && corrected[dashId]) {
            corrected[dashId] = {
                ...corrected[dashId],
                score: correctedScore,
                improvements: [
                    ...(corrected[dashId].improvements || []),
                    `Score adjusted by validator: ${validation.validationNotes}`,
                ],
            };
        }
    });

    return corrected;
}
