/**
 * turn-classifier.ts
 *
 * Lightweight (50-token) per-turn classifier that detects when a user
 * message contains a genuine cognitive signal worth surfacing as a badge.
 *
 * Called after EVERY user message. Runs on Groq (fast) with strict prompt.
 * Returns null when no signal detected (most turns).
 */

import { getAIClient } from '@/lib/ai/client';
import type { CognitiveSkill } from '@/types/assessment';

export interface TurnSignal {
    dimension: CognitiveSkill;
    confidence: number;   // 0.0 – 1.0
    triggerPhrase: string; // Brief label shown in badge
}

const CLASSIFIER_PROMPT = `You are a technical interview signal detector.
Classify a candidate's message into ONE cognitive dimension only if clearly demonstrated.
Threshold is HIGH — do not classify ambiguous or generic statements.

DIMENSIONS:
- problem-decomposition: explicitly broke problem into sub-steps or listed components
- pattern-recognition: named a specific algorithm pattern AND explained fit (e.g. "this is sliding window because the window size is fixed")
- algorithmic-thinking: proposed a concrete algorithm with step-by-step logic (not vague "use a loop")
- complexity-analysis: stated correct time OR space complexity AND explained why
- communication-clarity: used an analogy, visualization, or unusually clear structured explanation
- edge-case-awareness: proactively mentioned a specific edge case before being asked
- optimization-mindset: identified a brute-force and then proposed a better approach with tradeoff
- debugging-approach: systematically traced through example to find a bug or stated a hypothesis before changing code

Return JSON only:
{ "dimension": "<id or null>", "confidence": <0.0-1.0>, "triggerPhrase": "<8 words max>" }

If confidence < 0.75 or no clear signal: return { "dimension": null, "confidence": 0, "triggerPhrase": "" }`;

export async function classifyTurnSignal(
    userMessage: string,
    problemTitle: string
): Promise<TurnSignal | null> {
    if (!userMessage || userMessage.trim().length < 20) return null;

    try {
        const client = getAIClient();
        const result = await client.generateCompletion(
            [
                {
                    role: 'user',
                    content: `Problem: "${problemTitle}"\nCandidate message: "${userMessage.substring(0, 300)}"\n\n${CLASSIFIER_PROMPT}`,
                },
            ],
            {
                maxTokens: 60,
                preferredProvider: 'groq',
                category: 'fast',
            }
        );

        if (!result.success || !result.response) return null;

        const clean = result.response
            .replace(/```json|```/gi, '')
            .trim();
        const parsed = JSON.parse(clean);

        if (!parsed.dimension || parsed.confidence < 0.75) return null;

        return {
            dimension: parsed.dimension as CognitiveSkill,
            confidence: parsed.confidence,
            triggerPhrase: parsed.triggerPhrase || 'Signal detected',
        };
    } catch {
        return null;
    }
}
