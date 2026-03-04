import { InterviewState } from './state-machine';
import {
    generateInterviewerSystemPrompt,
    generateTurnPrompt as generateAdvancedTurnPrompt,
    generateFeedbackPrompt,
    InterviewConfig
} from './interviewer-prompt';
import { Problem } from '@/types/problem';

interface PromptContext {
    state: InterviewState;
    problemTitle: string;
    problemContent: string;
    transcript: string; // The specific recent user input
    conversationHistory?: string; // DEPRECATED: kept for backward compat, not used in prompt
    ragContext: string; // Retrieved chunks
    /** Optional context from an interrupted AI response. */
    interruptionContext?: string;
}

/**
 * Difficulty mode persona overlays.
 * These are appended to the system prompt to adjust interviewer behavior.
 */
const DIFFICULTY_MODE_CONTEXT: Record<string, string> = {
    'warm-up': `\n\n[DIFFICULTY MODE: WARM-UP]
You are a WARM and ENCOURAGING interviewer. Allow pauses up to 30 seconds before offering help.
Give hints after 2 minutes of silence. Celebrate small wins enthusiastically.
Use phrases like "Great start!", "You're on the right track!" frequently.
Focus on building confidence. This is a learning session.`,

    'practice': '', // No change — current default behavior

    'crunch': `\n\n[DIFFICULTY MODE: CRUNCH]
You are a TIME-CONSCIOUS interviewer. Mention the clock at 15 and 20 minutes.
Only give ONE hint maximum. Be direct and businesslike.
Push the candidate to think faster. Say things like "Let's move on" if they stall.
Do not over-explain. Keep responses brief.`,

    'sprint': `\n\n[DIFFICULTY MODE: SPRINT]
This is a SPRINT session with 2 problems. Announce when time for problem 1 (22 mins) is up
and transition to problem 2. No extended explanations.
Be efficient and fast-paced. Say "Time's up for problem 1, let's move to problem 2."
Minimal encouragement — focus on throughput.`,
};

/**
 * Generate the main system prompt for the AI interviewer.
 * Uses the comprehensive interviewer prompt with problem context.
 * Optionally appends difficulty mode persona overlay.
 */
export function generateSystemPrompt(problem?: Problem, ragContext?: string, mode?: string): string {
    // If no problem provided, return basic prompt (backward compatibility)
    if (!problem) {
        return `You are "Kai", an expert technical interviewer at a top tech company. 
Your goal is to conduct a mock regular coding interview. 
You are friendly, encouraging, but rigorous.
Speak naturally and concisely (max 2-3 sentences usually) so the candidate can respond.
Do NOT give away the solution immediately. Guide the user with hints if they are stuck.
If the user mentions specific patterns (like Sliding Window or DFS), validate them.
`;
    }

    // Use comprehensive interviewer prompt
    const config: InterviewConfig = {
        problem,
        difficulty: (problem.difficulty as 'easy' | 'medium' | 'hard') || 'medium',
        ragContext: ragContext || '',
    };

    let prompt = generateInterviewerSystemPrompt(config);

    // Append difficulty mode context if provided
    if (mode && DIFFICULTY_MODE_CONTEXT[mode]) {
        prompt += DIFFICULTY_MODE_CONTEXT[mode];
    }

    return prompt;
}

/**
 * Generate turn-specific prompts based on interview phase.
 * Maps internal state machine states to prompt phases.
 */
export function generateTurnPrompt(context: PromptContext): string {
    const { state, problemTitle, problemContent, ragContext, conversationHistory, transcript, interruptionContext } = context;

    const baseContext = `
Problem: ${problemTitle}
${problemContent}

Relevant Knowledge:
${ragContext}
`;
    // NOTE: Conversation history is NOT included here.
    // It is passed via the messages[] array in the API request body.
    // Including it here would duplicate the context and inflate token usage.

    // Map state machine states to prompt phases
    const stateToPhase: Record<InterviewState, string> = {
        'idle': 'intro',
        'problem-intro': 'intro',
        'user-thinking': 'approach',
        'ai-clarifying': 'approach',
        'user-solving': 'coding',
        'ai-feedback': 'coding',
        'user-coding': 'coding',
        'solution-review': 'wrap-up',
        'assessment': 'wrap-up',
        'completed': 'wrap-up',
    };

    const phase = stateToPhase[state] || 'approach';

    // Use advanced turn prompt for detailed guidance
    const advancedPrompt = generateAdvancedTurnPrompt(
        phase as 'intro' | 'approach' | 'coding' | 'testing' | 'complexity' | 'wrap-up',
        transcript,
        conversationHistory || ''
    );

    // Append interruption context if present
    const interruptionBlock = interruptionContext
        ? `\n\n${interruptionContext}`
        : '';

    return `${baseContext}\n${advancedPrompt}${interruptionBlock}`;
}

/**
 * Generate the final feedback prompt for assessment.
 */
export function generateFinalFeedbackPrompt(
    conversationHistory: string,
    problemTitle: string,
    terminated: boolean = false,
    terminationReason?: string
): string {
    return generateFeedbackPrompt(conversationHistory, problemTitle, terminated, terminationReason);
}

