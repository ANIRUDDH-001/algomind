import { CognitiveSkill } from '@/types/assessment';
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
    knowledgeGaps?: string[];
    modelUsed?: string;
    analysisFailure?: 'user_fault' | 'system_fault';
}

interface ParsedAssessmentResponse {
    skills: Record<string, {
        score: number;
        evidence: string[];
        strengths: string[];
        improvements: string[];
    }>;
    overallFeedback: string;
    nextSteps: string[];
    knowledgeGaps?: string[];
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
        problem: { title: string; description: string; difficulty: string },
        transcript: ConversationTurn[]
    ): Promise<AssessmentResult> {
        const prompt = generateAssessmentPrompt(problem, transcript, SKILL_DEFINITIONS);

        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                const rawResponse = await this.callAI(prompt);
                const parsedData = this.parseResponse(rawResponse.text) as unknown as ParsedAssessmentResponse;

                // Post-process: calculate confidence and finalize structure
                const sessionConfidence = calculateConfidence(transcript, parsedData);

                const finalizedSkills: Record<string, SkillScore> = {};
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
                    nextSteps: parsedData.nextSteps || ["Review the session manually."],
                    knowledgeGaps: parsedData.knowledgeGaps || [],
                    modelUsed: rawResponse.model ?? 'gemini-2.0-flash'
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

        // Task B: Detect user_fault vs system_fault for fallback score
        const userMessages = transcript.filter(t => t.role === 'user');
        const userWords = userMessages.reduce((count, msg) => count + (msg.content.match(/\S+/g) || []).length, 0);
        const isUserFault = userMessages.length === 0 || userWords < 20;
        const failureType = isUserFault ? 'user_fault' : 'system_fault';
        const fallbackScore = isUserFault ? 0 : 5;

        const fallbackSkills: Record<string, SkillScore> = {};
        Object.keys(SKILL_DEFINITIONS).forEach((skillId) => {
            fallbackSkills[skillId] = {
                score: fallbackScore,
                evidence: [isUserFault ? "Insufficient user interaction to assess skills." : "Session analysis failed."],
                strengths: [],
                improvements: [isUserFault ? "Provide more detailed code and explanations." : "Unable to analyze due to technical constraints."],
                confidence: 0, // 0 confidence indicates automated failure
            };
        });

        return {
            sessionId,
            timestamp: new Date(),
            problem,
            skills: fallbackSkills as Record<CognitiveSkill, SkillScore>,
            overallFeedback: isUserFault
                ? "Not enough interaction to properly assess skills. Please write more code or detail your thoughts more."
                : "Automated analysis failed. Manual review required.",
            nextSteps: isUserFault
                ? ["Engage more comprehensively in the next interview to receive an assessment."]
                : ["Review the session manually due to assessment failure."],
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
                preferredProvider: 'gemini', // Deep analysis
                category: 'intelligence',
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

