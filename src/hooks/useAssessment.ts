import { useState, useCallback } from 'react';
import type { AssessmentResult } from '@/lib/assessment/analyzer';
import type { ConversationTurn } from '@/lib/assessment/prompts';
import type { DifficultyMode } from '@/lib/interview/interview-config';

/**
 * useAssessment — client hook that calls the server-side assessment endpoint.
 *
 * A1 fix: CognitiveAnalyzer requires AI API keys that only exist server-side.
 * Running it in the browser produced 0-score fallback results every time.
 * Now we delegate to POST /api/interview/analyze.
 */
export function useAssessment() {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<AssessmentResult | null>(null);

    const analyzeSession = useCallback(async (
        sessionId: string,
        problem: { title: string; description: string; difficulty: string; difficultyMode?: DifficultyMode | 'employer' },
        transcript: ConversationTurn[]
    ) => {
        if (transcript.length < 2) {
            setError("Conversation too short for analysis.");
            return null;
        }

        setIsAnalyzing(true);
        setError(null);

        try {
            const res = await fetch('/api/interview/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, problem, transcript }),
            });

            if (!res.ok) {
                const errBody = await res.json().catch(() => ({ error: 'Assessment request failed' }));
                throw new Error(errBody.error || `Assessment failed (${res.status})`);
            }

            const assessment: AssessmentResult = await res.json();
            setResult(assessment);
            return assessment;
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to analyze interview.";
            setError(msg);
            return null;
        } finally {
            setIsAnalyzing(false);
        }
    }, []);

    const reset = useCallback(() => {
        setResult(null);
        setError(null);
        setIsAnalyzing(false);
    }, []);

    return {
        analyzeSession,
        isAnalyzing,
        error,
        result,
        reset
    };
}
