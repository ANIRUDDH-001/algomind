/**
 * @codesage
 * @file      src/lib/assessment/improvement-examples.ts
 * @purpose   Generates actionable improvement examples for candidate feedback using AI
 * @tech      AI Client
 * @connects  imports getAIClient from '@/lib/ai/client'
 * @apis      None directly (uses getAIClient)
 * @db        None
 * @state     None
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1
 */

import { getAIClient } from '@/lib/ai/client';
import type { CognitiveSkill } from '@/types/assessment';

export interface ImprovementExample {
    skill: CognitiveSkill;
    subCriterionLabel: string;
    score: number;
    whatWasSaid: string;       // from transcript evidence
    level6Response: string;    // what a 6/10 response looks like
    level9Response: string;    // what a 9/10 response looks like
}

interface WeakArea {
    skill: CognitiveSkill;
    label: string;
    score: number;
    evidence: string;
}

export async function generateImprovementExamples(
    problemTitle: string,
    weakAreas: WeakArea[]
): Promise<ImprovementExample[]> {
    if (!weakAreas || weakAreas.length === 0) return [];

    const prompt = `For each weak sub-criterion (score ≤ 4), generate improvement examples.

Problem: ${problemTitle}
Weak areas (with what was actually said):
${weakAreas.map(w => `${w.label} (score ${w.score}): "${w.evidence}"`).join('\n')}

For each, return a JSON object:
{
  "subCriterionLabel": "...",
  "whatWasSaid": "<exact quote from transcript>",
  "level6Response": "<what a 6/10 response to this question/moment looks like — specific, 2 sentences>",
  "level9Response": "<what a 9/10 response looks like — specific, 2 sentences>"
}

Return ONLY a valid JSON array of objects. No prose.`;

    try {
        const client = getAIClient();
        const result = await client.generateCompletion(
            [{ role: 'user', content: prompt }],
            {
                maxTokens: 1000,
                preferredProvider: 'gemini',
                category: 'intelligence',
                systemPrompt: 'Return only valid JSON array.',
            }
        );

        if (!result.success || !result.response) return [];

        const clean = result.response.replace(/```json|```/gi, '').trim();
        const parsed = JSON.parse(clean);

        if (!Array.isArray(parsed)) return [];

        return parsed.map((item: any, i: number) => ({
            skill: weakAreas[i]?.skill ?? ('problem-decomposition' as CognitiveSkill),
            subCriterionLabel: item.subCriterionLabel || weakAreas[i]?.label || '',
            score: weakAreas[i]?.score ?? 0,
            whatWasSaid: item.whatWasSaid || '',
            level6Response: item.level6Response || '',
            level9Response: item.level9Response || '',
        }));
    } catch (e) {
        console.error('[ImprovementExamples] Failed to generate improvement examples — report will have empty examples section:', e);
        return [];
    }
}
