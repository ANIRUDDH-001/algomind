import { ConversationTurn } from './prompts';

export interface AssessmentPartial {
    skills: Record<string, { evidence: string[] }>;
}

export function calculateConfidence(
    transcript: ConversationTurn[],
    assessment: AssessmentPartial
): number {
    const userContent = transcript
        .filter(t => t.role === 'user')
        .map(t => t.content)
        .join(' ');

    // Factors for higher confidence:
    // 1. Transcript length (more signal)
    // 2. Number of user turns
    // 3. Presence of evidence in assessment

    const userTurnCount = transcript.filter(t => t.role === 'user').length;
    const wordCount = userContent.split(/\s+/).length;

    let evidencePoints = 0;
    Object.values(assessment.skills).forEach(s => {
        if (s.evidence && s.evidence.length > 0) evidencePoints++;
    });

    // Simple heuristic normalized to 0-1
    const turnScore = Math.min(userTurnCount / 10, 0.4); // Max 0.4 for 10+ turns
    const wordScore = Math.min(wordCount / 500, 0.3);    // Max 0.3 for 500+ words
    const evidenceScore = (evidencePoints / 8) * 0.3;   // Max 0.3 if all skills have evidence

    const confidence = turnScore + wordScore + evidenceScore;

    return Math.round(confidence * 100) / 100;
}
