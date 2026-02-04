import { InterviewState } from './state-machine';

interface PromptContext {
    state: InterviewState;
    problemTitle: string;
    problemContent: string;
    transcript: string; // The specific recent user input
    conversationHistory: string; // Full history
    ragContext: string; // Retrieved chunks
}

export function generateSystemPrompt(): string {
    return `You are "Algo", an expert technical interviewer at a top tech company. 
Your goal is to conduct a mock regular coding interview. 
You are friendly, encouraging, but rigorous.
Speak naturally and concisely (max 2-3 sentences usually) so the candidate can respond.
Do NOT give away the solution immediately. Guide the user with hints if they are stuck.
If the user mentions specific patterns (like Sliding Window or DFS), validate them.
`;
}

export function generateTurnPrompt(context: PromptContext): string {
    const { state, problemTitle, problemContent, ragContext, conversationHistory, transcript } = context;

    const baseContext = `
Problem: ${problemTitle}
${problemContent}

Relevant Knowledge:
${ragContext}

Conversation History:
${conversationHistory}
`;

    switch (state) {
        case 'problem-intro':
            return `
${baseContext}
Task: Introduce the problem to the candidate clearly. 
Ask them how they would approach this. 
Keep it brief and encouraging.
`;

        case 'ai-clarifying':
            return `
${baseContext}
Current User Input: "${transcript}"
Task: The user is explaining their approach. 
If their approach is correct, validate it and ask them to proceed to solving/coding.
If their approach has flaws, ask a clarifying question to nudge them in the right direction without being negative.
If they are vague, ask for more details on time complexity or data structures.
`;

        case 'ai-feedback':
            return `
${baseContext}
Current User Input: "${transcript}"
Task: The user is working through the solution.
Provide brief feedback. If they made a mistake, gently point it out.
If they are doing well, encourage them to continue.
`;

        case 'solution-review':
            return `
${baseContext}
Task: The user has submitted their solution.
Provide a summary of their performance. Mention time/space complexity.
Congratulate them on completion.
`;

        default:
            return `
${baseContext}
Current User Input: "${transcript}"
Task: Respond naturally to the user.
`;
    }
}
