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
    conversationHistory: string; // Full history
    ragContext: string; // Retrieved chunks
    /** Optional context from an interrupted AI response. */
    interruptionContext?: string;
}

/**
 * Generate the main system prompt for the AI interviewer.
 * Uses the comprehensive interviewer prompt with problem context.
 */
export function generateSystemPrompt(problem?: Problem, ragContext?: string): string {
    // If no problem provided, return basic prompt (backward compatibility)
    if (!problem) {
        return `You are "Algo", an expert technical interviewer at a top tech company. 
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

    return generateInterviewerSystemPrompt(config);
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

Conversation History:
${conversationHistory}
`;

    // Map state machine states to prompt phases
    const stateToPhase: Record<InterviewState, string> = {
        'idle': 'intro',
        'problem-intro': 'intro',
        'user-thinking': 'approach',
        'ai-clarifying': 'approach',
        'user-solving': 'coding',
        'ai-feedback': 'coding',
        'solution-review': 'wrap-up',
        'assessment': 'wrap-up',
        'completed': 'wrap-up',
    };

    const phase = stateToPhase[state] || 'approach';

    // Use advanced turn prompt for detailed guidance
    const advancedPrompt = generateAdvancedTurnPrompt(
        phase as 'intro' | 'approach' | 'coding' | 'testing' | 'complexity' | 'wrap-up',
        transcript,
        conversationHistory
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

