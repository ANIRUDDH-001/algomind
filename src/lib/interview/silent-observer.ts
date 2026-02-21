import { getAIClient } from '../ai/client';

export type InterviewState = 'idle' | 'user-speaking' | 'ai-speaking' | 'user-thinking' | 'user-solving' | 'ai-clarifying' | 'completed';

export class SilentObserver {
    private lastNudgeAt: number = 0;
    private readonly COOLDOWN_MS = 90_000;
    private readonly MIN_TURNS = 4;

    public async analyze(params: {
        recentTurns: Array<{ role: 'user' | 'assistant'; content: string }>;
        interviewState: InterviewState;
        elapsedSeconds: number;
    }): Promise<string | null> {
        const { recentTurns, interviewState, elapsedSeconds } = params;

        // 1. Minimum interaction volume gate
        if (recentTurns.length < this.MIN_TURNS) {
            return null;
        }

        // 2. Cooldown timer guard 
        if (Date.now() - this.lastNudgeAt < this.COOLDOWN_MS) {
            return null;
        }

        // 3. Active phases only
        const activePhases: InterviewState[] = ['user-thinking', 'user-solving', 'ai-clarifying'];
        if (!activePhases.includes(interviewState)) {
            return null; // Only run during active phases; idle, completed, and all others are excluded
        }

        const recentHistoryText = recentTurns.slice(-3).map(
            t => `${t.role.toUpperCase()}: ${t.content.substring(0, 150)}...`
        ).join('\n---\n');

        const prompt = `You are a silent coaching observer watching a technical interview.
Current phase: ${interviewState}
Minutes elapsed: ${Math.floor(elapsedSeconds / 60)}
Last 3 conversation turns:
${recentHistoryText}

Detect ONE of these patterns and respond with a SHORT coaching tip (max 10 words):
- User spoke 90+ seconds without checking if their approach makes sense: 'Check in: Does this approach make sense to you?'
- User wrote code without discussing time complexity: 'Quick pause: what is the time complexity?'  
- User never asked about input constraints: 'Did you clarify the input constraints first?'
- User has been silent for the coding phase: 'Narrate your thinking as you code'
- User is clearly stuck but hasn't asked for a hint: 'It is okay to ask for a hint'

If NONE of these patterns apply: respond with exactly the word: PASS

Output ONLY the tip text or PASS. Nothing else.`;

        try {
            const client = getAIClient();
            const result = await client.generateCompletion([{ role: 'user', content: prompt }], {
                maxTokens: 20,
                preferredProvider: 'groq'
            });

            if (!result || !result.response) {
                return null;
            }

            const cleanTip = result.response.trim();
            if (cleanTip === 'PASS' || cleanTip.length === 0) {
                return null;
            }

            // Successfully received a valid nudge
            this.lastNudgeAt = Date.now();
            return cleanTip;

        } catch (err) {
            // Hot path failure, suppress and die gracefully
            return null;
        }
    }

    public reset() {
        this.lastNudgeAt = 0;
    }
}
