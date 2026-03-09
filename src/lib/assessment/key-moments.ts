/**
 * key-moments.ts
 *
 * Identifies 5-7 meaningful turning points in an interview transcript.
 * Called once post-session (not real-time). Result cached in assessments.skill_evidence.
 */

import { getAIClient } from '@/lib/ai/client';

export type KeyMomentType = 'impressive' | 'gap' | 'notable';

export interface KeyMoment {
    timestampIndex: number;    // index in transcript array
    momentType:
    | 'approach_identified'
    | 'optimization_transition'
    | 'self_correction'
    | 'complexity_explained'
    | 'impressive_statement'
    | 'missed_opportunity'
    | 'stuck_point';
    type: KeyMomentType;       // classified: impressive (positive), gap (negative), notable (neutral)
    quote: string;             // up to 60 chars from transcript
    significance: string;      // 1 sentence: why this moment matters
    dimension: string | null;  // which cognitive dimension this relates to
    sentiment: 'positive' | 'negative' | 'neutral';
}

const VALID_MOMENT_TYPES = new Set([
    'approach_identified',
    'optimization_transition',
    'self_correction',
    'complexity_explained',
    'impressive_statement',
    'missed_opportunity',
    'stuck_point',
]);

const VALID_SENTIMENTS = new Set(['positive', 'negative', 'neutral']);

const VALID_DIMENSIONS = new Set([
    'problem-decomposition',
    'pattern-recognition',
    'algorithmic-thinking',
    'complexity-analysis',
    'communication-clarity',
    'edge-case-awareness',
    'optimization-mindset',
    'debugging-approach',
    null,
]);

const KEY_MOMENTS_PROMPT = `Analyze this technical interview transcript and identify 5-7 key moments.

For each moment return:
- momentType: one of approach_identified | optimization_transition | self_correction | complexity_explained | impressive_statement | missed_opportunity | stuck_point
- type: classify the moment based on whether the evidence is positive, negative, or neutral:
  - "impressive": candidate demonstrated genuine strength (correct insight, good explanation, proactive thinking)
  - "gap": candidate showed a clear weakness or missed something important (wrong answer, no analysis, confusion)
  - "notable": neutral observation worth noting but neither clearly positive nor negative
- quote: exact phrase from transcript, max 60 chars, use "..." for truncation
- significance: 1 sentence explaining why this moment matters for evaluation
- dimension: which cognitive dimension (problem-decomposition|pattern-recognition|algorithmic-thinking|complexity-analysis|communication-clarity|edge-case-awareness|optimization-mindset|debugging-approach) or null
- sentiment: positive|negative|neutral

IMPORTANT: The "type" field must reflect the actual nature of the evidence.
- A negative observation like "No complexity analysis was attempted" must be type "gap", NOT "impressive".
- Only use type "impressive" for genuinely positive evidence.

Return ONLY valid JSON array. No prose.
[
  { "momentType": "...", "type": "impressive|gap|notable", "quote": "...", "significance": "...", "dimension": "...", "sentiment": "..." },
  ...
]`;

export async function extractKeyMoments(
    transcript: Array<{ speaker: string; text: string; timestamp?: number }>
): Promise<KeyMoment[]> {
    if (!transcript || transcript.length < 4) return [];

    const formattedTranscript = transcript
        .map((t, i) => `[${i}] ${t.speaker.toUpperCase()}: ${t.text.substring(0, 200)}`)
        .join('\n');

    try {
        const client = getAIClient();
        const result = await client.generateCompletion(
            [{
                role: 'user',
                content: `${KEY_MOMENTS_PROMPT}\n\nTRANSCRIPT:\n${formattedTranscript}`,
            }],
            {
                maxTokens: 800,
                preferredProvider: 'gemini',
                category: 'intelligence',
                systemPrompt: 'Return only valid JSON array.',
            }
        );

        if (!result.success || !result.response) return [];

        const clean = result.response.replace(/```json|```/gi, '').trim();
        const parsed = JSON.parse(clean);

        if (!Array.isArray(parsed)) return [];

        const VALID_TYPES = new Set(['impressive', 'gap', 'notable']);

        return (parsed as KeyMoment[])
            .filter(m =>
                VALID_MOMENT_TYPES.has(m.momentType) &&
                VALID_SENTIMENTS.has(m.sentiment) &&
                (m.dimension === null || VALID_DIMENSIONS.has(m.dimension))
            )
            .map((m, i) => ({
                ...m,
                timestampIndex: i,
                quote: typeof m.quote === 'string' ? m.quote.substring(0, 60) : '',
                significance: typeof m.significance === 'string' ? m.significance : '',
                // Derive type from sentiment if LLM didn't provide a valid one
                type: VALID_TYPES.has(m.type) ? m.type
                    : m.sentiment === 'positive' ? 'impressive' as const
                    : m.sentiment === 'negative' ? 'gap' as const
                    : 'notable' as const,
            }))
            .slice(0, 7);
    } catch (e) {
        console.error('[KeyMoments] Failed to extract key moments — report will have empty moments section:', e);
        return [];
    }
}
