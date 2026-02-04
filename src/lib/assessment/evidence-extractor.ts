import { CognitiveSkill } from '@/types/assessment';
import { ConversationTurn } from './prompts';

// Simple keyword/pattern-based helper to find relevant turns for specific skills
// This is used for highlighting or manual verification but mostly the AI does this.
export function extractEvidence(
    transcript: ConversationTurn[],
    skill: CognitiveSkill
): string[] {
    const userTurns = transcript.filter(t => t.role === 'user');

    const skillKeywords: Record<CognitiveSkill, string[]> = {
        'problem-decomposition': ['break down', 'subproblems', 'part', 'first', 'second', 'step'],
        'pattern-recognition': ['dynamic programming', 'hash map', 'two pointers', 'sliding window', 'recursive'],
        'algorithmic-thinking': ['loop', 'iterate', 'stack', 'queue', 'sorting', 'binary'],
        'complexity-analysis': ['O(', 'complexity', 'time', 'space', 'linear', 'logarithmic'],
        'communication-clarity': ['explain', 'think', 'thought', 'process'],
        'edge-case-awareness': ['empty', 'null', 'negative', 'overflow', 'limit', 'boundary'],
        'optimization-mindset': ['faster', 'optimize', 'efficiency', 'overhead', 'tradeoff'],
        'debugging-approach': ['bug', 'wrong', 'fix', 'error', 'tracing', 'instead'],
    };

    const keywords = skillKeywords[skill];
    const relevantTurns = userTurns.filter(turn =>
        keywords.some(kw => turn.content.toLowerCase().includes(kw.toLowerCase()))
    );

    return relevantTurns.slice(0, 3).map(turn => turn.content);
}
