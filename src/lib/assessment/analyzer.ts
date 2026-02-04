import { CognitiveSkill, SkillDefinition } from '@/types/assessment';
import { SKILL_DEFINITIONS } from './skill-registry';
import { ConversationTurn, generateAssessmentPrompt } from './prompts';
import { calculateConfidence } from './confidence-calculator';

export interface SkillScore {
    score: number;
    evidence: string[];
    strengths: string[];
    improvements: string[];
    confidence: number;
}

export interface AssessmentResult {
    sessionId: string;
    timestamp: Date;
    problem: { title: string; description: string; difficulty: string };
    skills: Record<CognitiveSkill, SkillScore>;
    overallFeedback: string;
    nextSteps: string[];
    modelUsed?: string;
}

export class CognitiveAnalyzer {
    /**
     * Main entry point for analyzing an interview session
     */
    async analyze(
        sessionId: string,
        problem: { title: string; description: string; difficulty: string },
        transcript: ConversationTurn[]
    ): Promise<AssessmentResult> {
        const prompt = generateAssessmentPrompt(problem, transcript, SKILL_DEFINITIONS);

        try {
            const rawResponse = await this.callAI(prompt);
            const parsedData = this.parseResponse(rawResponse);

            // Post-process: calculate confidence and finalize structure
            const sessionConfidence = calculateConfidence(transcript, parsedData);

            const finalizedSkills: any = {};
            Object.keys(SKILL_DEFINITIONS).forEach((skillId) => {
                const data = parsedData.skills[skillId] || {
                    score: 5,
                    evidence: [],
                    strengths: [],
                    improvements: []
                };
                finalizedSkills[skillId] = {
                    ...data,
                    confidence: sessionConfidence
                };
            });

            return {
                sessionId,
                timestamp: new Date(),
                problem,
                skills: finalizedSkills,
                overallFeedback: parsedData.overallFeedback || "No feedback generated.",
                nextSteps: parsedData.nextSteps || ["Review the session manually."]
            };
        } catch (error) {
            console.error("Assessment Analysis Failed:", error);
            throw error;
        }
    }

    private async callAI(prompt: string): Promise<string> {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [{ role: 'user', content: prompt }],
                systemPrompt: "You are a professional assessment engine. Return only valid JSON."
            })
        });

        if (!response.ok) {
            throw new Error(`AI API failed with status ${response.status}`);
        }

        const data = await response.json();
        return data.response; // returns the string content from AI
    }

    private parseResponse(raw: string): any {
        // 1. Strip markdown fences if present
        const jsonString = raw.replace(/```json/g, '').replace(/```/g, '').trim();

        try {
            const parsed = JSON.parse(jsonString);

            // Basic validation
            if (!parsed.skills) {
                throw new Error("Invalid response format: missing skills object");
            }

            return parsed;
        } catch (e) {
            console.error("Failed to parse AI JSON response:", raw);
            throw new Error("Could not parse assessment results.");
        }
    }
}
