/**
 * @codesage
 * @file      src/lib/assessment/evidence-extractor.ts
 * @purpose   Extracts raw transcript evidence mapped to specific cognitive skills based on heuristics
 * @tech      None
 * @connects  imports CognitiveSkill, ConversationTurn
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    dead code removed (unused _userTurns variable)
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

import { CognitiveSkill } from '@/types/assessment';
import { ConversationTurn } from './prompts';

// Simple keyword/pattern-based helper to find relevant turns for specific skills
// This is used for highlighting or manual verification but mostly the AI does this.
export function extractEvidence(
    transcript: ConversationTurn[],
    skill: CognitiveSkill
): string[] {
    const skillKeywords: Record<CognitiveSkill, string[]> = {
        'problem-decomposition': ['break down', 'subproblems', 'part', 'first', 'second', 'step', 'divide'],
        'pattern-recognition': ['dynamic programming', 'hash map', 'two pointers', 'sliding window', 'recursive'],
        'algorithmic-thinking': ['loop', 'iterate', 'stack', 'queue', 'sorting', 'binary'],
        'complexity-analysis': ['O(', 'complexity', 'time', 'space', 'linear', 'logarithmic', 'O(n', 'O(1', 'O(log'],
        'communication-clarity': ['explain', 'think', 'thought', 'process'],
        'edge-case-awareness': ['empty', 'null', 'negative', 'overflow', 'limit', 'boundary', 'undefined'],
        'optimization-mindset': ['faster', 'optimize', 'efficiency', 'overhead', 'tradeoff'],
        'debugging-approach': ['bug', 'wrong', 'fix', 'error', 'tracing', 'instead'],
    };

    const keywords = skillKeywords[skill];
    const relevantTurns = transcript.filter(turn => {
        // Also look for code snippets wrapped in backticks
        const hasCodeSnippet = /`[^`]+`|```[\s\S]*?```/.test(turn.content);

        // Assistant can also highlight facts contributing to evidence mapping
        return keywords.some(kw => turn.content.toLowerCase().includes(kw.toLowerCase())) ||
            (skill === 'algorithmic-thinking' && hasCodeSnippet);
    });

    return relevantTurns.slice(0, 3).map(turn => turn.content);
}
