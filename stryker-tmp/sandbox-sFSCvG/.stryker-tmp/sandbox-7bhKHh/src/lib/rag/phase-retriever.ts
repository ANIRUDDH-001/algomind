/**
 * phase-retriever.ts
 *
 * Phase-specific RAG retrieval. Returns different knowledge chunks
 * depending on the current interview phase.
 *
 * Phase → Query strategy:
 *   intro:      problem title only — general context
 *   approach:   problem title + "algorithm patterns" — find matching patterns
 *   coding:     problem title + specific pattern if known — implementation notes
 *   testing:    "edge cases" + problem tags — testing strategies
 *   complexity: "time complexity space complexity" + problem title — analysis examples
 *   wrap-up:    problem title + "optimal solution" — authoritative answer
 */
// @ts-nocheck

// 


import { supabaseHybridSearch } from './supabaseVectorStore';
import type { SearchResult } from './types';
import { type SupabaseClient } from '@supabase/supabase-js';

export type InterviewPhase =
    | 'intro' | 'approach' | 'coding'
    | 'testing' | 'complexity' | 'wrap-up';

export const PHASE_QUERY_TEMPLATES: Record<InterviewPhase, (title: string, tags: string[]) => string> = {
    intro: (title) => title,
    approach: (title, tags) => `${title} algorithm pattern ${tags.slice(0, 2).join(' ')}`,
    coding: (title, tags) => `${title} implementation ${tags[0] ?? ''} code`,
    testing: (_title, tags) => `edge cases testing ${tags.join(' ')}`,
    complexity: (title) => `time complexity space complexity ${title}`,
    'wrap-up': (title) => `optimal solution ${title}`,
};

export const PHASE_CHUNK_COUNTS: Record<InterviewPhase, number> = {
    intro: 2,
    approach: 4,
    coding: 3,
    testing: 2,
    complexity: 3,
    'wrap-up': 3,
};

interface PhaseContext {
    phase: InterviewPhase;
    chunks: SearchResult[];
    contextString: string;
    retrievalMs: number;
}

// Cache: session-scoped, keyed by phase
const phaseContextCache = new Map<string, PhaseContext>();

export async function getPhaseContext(
    supabase: SupabaseClient,
    sessionId: string,
    phase: InterviewPhase,
    problemTitle: string,
    problemTags: string[]
): Promise<string> {
    const cacheKey = `${sessionId}:${phase}`;
    if (phaseContextCache.has(cacheKey)) {
        return phaseContextCache.get(cacheKey)!.contextString;
    }

    const queryFn = PHASE_QUERY_TEMPLATES[phase];
    const query = queryFn(problemTitle, problemTags);
    const limit = PHASE_CHUNK_COUNTS[phase];

    const start = Date.now();
    const chunks = await supabaseHybridSearch(supabase, query, limit);
    const retrievalMs = Date.now() - start;

    const contextString = chunks.length === 0
        ? 'No relevant context found.'
        : chunks.map((r, i) => {
            const c = r.chunk;
            return `[${i + 1}] ${c.title} (${c.topic})\n${c.content.substring(0, 400)}`;
        }).join('\n\n---\n\n');

    const ctx: PhaseContext = { phase, chunks, contextString, retrievalMs };
    phaseContextCache.set(cacheKey, ctx);

    return contextString;
}

/** Clear the session cache on session end to free memory */
export function clearPhaseCache(sessionId: string): void {
    for (const key of phaseContextCache.keys()) {
        if (key.startsWith(`${sessionId}:`)) {
            phaseContextCache.delete(key);
        }
    }
}

/** Expose cache for testing purposes */
export function _getPhaseContextCache(): Map<string, PhaseContext> {
    return phaseContextCache;
}
