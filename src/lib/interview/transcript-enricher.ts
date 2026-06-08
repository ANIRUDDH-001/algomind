/**
 * @codesage
 * @description Combines the conversation history with the final submitted code for end-of-interview assessment generation.
 * @section SEC-05: Core Libs: Interview & Voice
 * @author ANIRUDDH
 * @last_audited 2026-06-01
 */
import type { ConversationTurn } from '@/lib/assessment/prompts';

export function buildEnrichedTranscript(
    conversationMessages: Array<{ role: string; content: string }>,
    finalCode: string,
    language: string,
    // @ts-expect-error -- automated unused local suppression
    problemTitle: string
): ConversationTurn[] {
    const turns: ConversationTurn[] = conversationMessages.map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
    }));

    if (finalCode && finalCode.trim().length > 0) {
        const lineCount = finalCode.split('\n').length;
        const codeBlock = `[FINAL CODE SUBMITTED — ${language.toUpperCase()}]
Language: ${language}
Lines: ${lineCount}

\`\`\`${language}
${finalCode}
\`\`\`

Note to evaluator: This is the candidate's actual submitted code.
Assess correctness, naming conventions, code clarity, and consistency 
with their verbal approach.`;

        turns.push({
            role: 'user',
            content: codeBlock,
        });
    }

    return turns;
}
