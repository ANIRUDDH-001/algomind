export interface GeminiResult {
    overallScore: number;
    overallFeedback: string;
    nextSteps: string[];
    skills: Record<string, { score: number; evidence: string }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeScore(value: unknown): number {
    const n = Number(value);
    if (!Number.isFinite(n)) {
        throw new Error('schema_invalid: score is not a number');
    }
    return Math.max(0, Math.min(10, n));
}

export function parseGeminiResultText(rawText: string): GeminiResult {
    const cleaned = rawText.replace(/```json\n?|```/g, '').trim();
    if (!cleaned) {
        throw new Error('parse_failed: empty_response');
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(cleaned);
    } catch {
        throw new Error('parse_failed: invalid_json');
    }

    if (!isRecord(parsed)) {
        throw new Error('schema_invalid: root object required');
    }

    if (typeof parsed.overallFeedback !== 'string' || parsed.overallFeedback.trim().length === 0) {
        throw new Error('schema_invalid: overallFeedback required');
    }

    if (!Array.isArray(parsed.nextSteps)) {
        throw new Error('schema_invalid: nextSteps array required');
    }

    if (!isRecord(parsed.skills)) {
        throw new Error('schema_invalid: skills object required');
    }

    const nextSteps = parsed.nextSteps
        .filter((step): step is string => typeof step === 'string' && step.trim().length > 0)
        .slice(0, 5);

    const normalizedSkills: Record<string, { score: number; evidence: string }> = {};
    for (const [skill, value] of Object.entries(parsed.skills)) {
        if (!isRecord(value)) continue;

        const score = normalizeScore(value.score);
        const evidence = typeof value.evidence === 'string' ? value.evidence : '';
        normalizedSkills[skill] = { score, evidence };
    }

    if (Object.keys(normalizedSkills).length === 0) {
        throw new Error('schema_invalid: at least one skill score is required');
    }

    return {
        overallScore: normalizeScore(parsed.overallScore),
        overallFeedback: parsed.overallFeedback,
        nextSteps,
        skills: normalizedSkills,
    };
}
