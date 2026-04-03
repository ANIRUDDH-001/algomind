export type RagDifficulty = 'easy' | 'medium' | 'hard' | null;

export interface RagChunk {
    id: string;
    title: string;
    content: string;
    topic: string | null;
    subtopic: string | null;
    difficulty: RagDifficulty;
    score: number;
    matchType: 'semantic' | 'keyword' | 'hybrid';
}

export interface RagResponse {
    status: 'ok';
    query: string;
    chunks: RagChunk[];
    context: string;
}

function normalizeText(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

function normalizeDifficulty(value: unknown): RagDifficulty {
    if (value === 'easy' || value === 'medium' || value === 'hard') {
        return value;
    }
    return null;
}

function toFiniteScore(value: unknown): number {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
}

export function mapRpcChunk(row: Record<string, unknown>): RagChunk {
    const id = normalizeText(row.id) || normalizeText(row.chunk_id) || `${normalizeText(row.title)}-${normalizeText(row.topic)}`;
    return {
        id: id || 'rag-chunk',
        title: normalizeText(row.title),
        content: normalizeText(row.content),
        topic: normalizeText(row.topic) || null,
        subtopic: normalizeText(row.subtopic) || null,
        difficulty: normalizeDifficulty(row.difficulty),
        score: toFiniteScore(row.score ?? row.similarity),
        matchType: 'semantic',
    };
}

export function mapSearchChunk(result: {
    score: number;
    matchType: 'semantic' | 'keyword' | 'hybrid';
    chunk: {
        id: string;
        title: string;
        content: string;
        topic: string;
        subtopic: string;
        difficulty: 'easy' | 'medium' | 'hard';
    };
}): RagChunk {
    return {
        id: result.chunk.id,
        title: result.chunk.title,
        content: result.chunk.content,
        topic: result.chunk.topic,
        subtopic: result.chunk.subtopic,
        difficulty: result.chunk.difficulty,
        score: toFiniteScore(result.score),
        matchType: result.matchType,
    };
}

export function buildRagContext(chunks: RagChunk[]): string {
    if (chunks.length === 0) return '';
    return chunks
        .map((chunk) => `### ${chunk.title}\n${chunk.content}`)
        .join('\n\n---\n\n');
}

export function buildRagResponse(query: string, chunks: RagChunk[]): RagResponse {
    return {
        status: 'ok',
        query,
        chunks,
        context: buildRagContext(chunks),
    };
}
