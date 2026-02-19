import { useState, useCallback } from 'react';
import { AssessmentResult, CognitiveAnalyzer } from '@/lib/assessment/analyzer';
import { ConversationTurn } from '@/lib/assessment/prompts';

export function useAssessment() {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<AssessmentResult | null>(null);

    const analyzeSession = useCallback(async (
        sessionId: string,
        problem: { title: string; description: string; difficulty: string },
        transcript: ConversationTurn[]
    ) => {
        if (transcript.length < 2) {
            setError("Conversation too short for analysis.");
            return null;
        }

        setIsAnalyzing(true);
        setError(null);

        try {
            const analyzer = new CognitiveAnalyzer();
            const assessment = await analyzer.analyze(sessionId, problem, transcript);
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
