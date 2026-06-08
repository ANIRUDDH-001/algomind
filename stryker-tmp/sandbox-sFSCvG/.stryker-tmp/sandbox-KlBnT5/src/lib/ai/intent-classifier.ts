// @ts-nocheck
// 
// Intent Classifier — Hybrid regex + LLM classification
// Routes queries to Groq (simple/fast) or Gemini (complex/deep)
// Target: < 100ms total classification latency

import {
    ALL_PATTERNS,
    type IntentCategory,
    type IntentComplexity,
    type PatternRule,
} from './patterns';

// ── Types ───────────────────────────────────────────────────────────

export interface IntentClassification {
    complexity: IntentComplexity;
    category: IntentCategory;
    confidence: number;
    suggestedModel: 'groq' | 'gemini' | 'bedrock';
    reasoning?: string;
}

export interface ClassifierOptions {
    /** Confidence threshold: above this → trust result; below → escalate */
    confidenceThreshold?: number;
    /** Maximum cache size before LRU eviction */
    maxCacheSize?: number;
    /** Levenshtein distance threshold for fuzzy cache matching */
    fuzzyThreshold?: number;
    /** Enable Groq LLM second-pass for ambiguous queries */
    enableLLMPass?: boolean;
    /** Timeout for the Groq classification call (ms) */
    llmTimeoutMs?: number;
}

const DEFAULT_OPTIONS: Required<ClassifierOptions> = {
    confidenceThreshold: 0.8,
    maxCacheSize: 500,
    fuzzyThreshold: 2,
    enableLLMPass: true,
    llmTimeoutMs: 3000,
};

// ── Normalization ───────────────────────────────────────────────────

export function normalizeQuery(query: string): string {
    return query.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_]/gu, '').replace(/\s+/g, ' ');
}

// ── Levenshtein Distance ────────────────────────────────────────────

/**
 * Compute Levenshtein edit distance between two strings.
 * Used for fuzzy cache matching.
 */
export function levenshtein(a: string, b: string): number {
    const la = a.length;
    const lb = b.length;
    if (la === 0) return lb;
    if (lb === 0) return la;

    // Optimise: single-row DP
    let prev = new Array(lb + 1);
    let curr = new Array(lb + 1);

    for (let j = 0; j <= lb; j++) prev[j] = j;

    for (let i = 1; i <= la; i++) {
        curr[0] = i;
        for (let j = 1; j <= lb; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            curr[j] = Math.min(
                prev[j] + 1,     // deletion
                curr[j - 1] + 1, // insertion
                prev[j - 1] + cost // substitution
            );
        }
        [prev, curr] = [curr, prev];
    }
    return prev[lb];
}

// ── Intent Classifier ───────────────────────────────────────────────

export class IntentClassifier {
    private opts: Required<ClassifierOptions>;
    private cache = new Map<string, IntentClassification>();
    private cacheInsertOrder: string[] = []; // for LRU eviction
    private modelOverride: 'groq' | 'gemini' | null = null;

    constructor(options: ClassifierOptions = {}) {
        this.opts = { ...DEFAULT_OPTIONS, ...options };
    }

    // ── Public API ──────────────────────────────────────────────────

    /**
     * Classify a query and suggest which model to use.
     * Hybrid: regex first → cache → (optional) Groq LLM → fallback Gemini.
     */
    async classify(query: string): Promise<IntentClassification> {
        const normalised = normalizeQuery(query);

        // 0. Admin override
        if (this.modelOverride) {
            const base = this.regexClassify(normalised, query) ?? this.defaultClassification(normalised);
            return {
                ...base,
                suggestedModel: this.modelOverride,
                reasoning: `Admin override → ${this.modelOverride}`,
            };
        }

        // 1. Exact cache hit
        const cached = this.cache.get(normalised);
        if (cached) return { ...cached, reasoning: 'cache_hit' };

        // 2. Fuzzy cache hit
        const fuzzy = this.fuzzyLookup(normalised);
        if (fuzzy) return { ...fuzzy, reasoning: 'fuzzy_cache_hit' };

        // 3. Regex first-pass (instant)
        const regexResult = this.regexClassify(normalised, query);
        if (regexResult && regexResult.confidence >= this.opts.confidenceThreshold) {
            this.addToCache(normalised, regexResult);
            return regexResult;
        }

        // 4. LLM second-pass (Groq, fast)
        if (this.opts.enableLLMPass) {
            try {
                const llmResult = await this.llmClassify(query);
                if (llmResult && llmResult.confidence >= this.opts.confidenceThreshold) {
                    this.addToCache(normalised, llmResult);
                    return llmResult;
                }
            } catch (err) {
                // LLM call failed — fall through to default
                console.warn('[IntentClassifier] LLM pass failed:', err);
            }
        }

        // 5. Fallback: default heuristic
        const fallback = this.defaultClassification(normalised);
        fallback.reasoning = regexResult
            ? `Low-confidence regex (${regexResult.confidence.toFixed(2)}), defaulting to heuristics`
            : 'No pattern match, defaulting to heuristics';

        this.addToCache(normalised, fallback);
        return fallback;
    }

    /**
     * Synchronous regex-only classification. Returns null if no match.
     * Useful when you need instant results with zero async overhead.
     */
    classifySync(query: string): IntentClassification | null {
        const normalised = normalizeQuery(query);

        if (this.modelOverride) {
            const base = this.regexClassify(normalised, query) ?? this.defaultClassification(normalised);
            return { ...base, suggestedModel: this.modelOverride, reasoning: `Admin override → ${this.modelOverride}` };
        }

        const cached = this.cache.get(normalised);
        if (cached) return { ...cached, reasoning: 'cache_hit' };

        const fuzzy = this.fuzzyLookup(normalised);
        if (fuzzy) return { ...fuzzy, reasoning: 'fuzzy_cache_hit' };

        const result = this.regexClassify(normalised, query);
        if (result) this.addToCache(normalised, result);
        return result;
    }

    // ── Admin Controls ──────────────────────────────────────────────

    /** Force a specific model regardless of classification */
    setModelOverride(model: 'groq' | 'gemini' | null): void {
        this.modelOverride = model;
    }

    getModelOverride(): 'groq' | 'gemini' | null {
        return this.modelOverride;
    }

    // ── Feedback / Cache Management ─────────────────────────────────

    /** Update cache with corrected classification (from user or admin feedback) */
    updateFromFeedback(query: string, corrected: IntentClassification): void {
        const normalised = normalizeQuery(query);
        this.addToCache(normalised, { ...corrected, reasoning: 'user_feedback' });
    }

    /** Clear the entire intent cache */
    clearCache(): void {
        this.cache.clear();
        this.cacheInsertOrder = [];
    }

    /** Get current cache size */
    getCacheSize(): number {
        return this.cache.size;
    }

    /** Get cache stats for admin dashboard */
    getCacheStats(): { size: number; maxSize: number; keys: string[] } {
        return {
            size: this.cache.size,
            maxSize: this.opts.maxCacheSize,
            keys: [...this.cache.keys()],
        };
    }

    // ── Internal: Regex Pass ────────────────────────────────────────

    private regexClassify(normalised: string, originalQuery: string): IntentClassification | null {
        // Test against original (un-lowercased) query too, since some patterns
        // are case-insensitive but we normalised for caching.
        let bestMatch: { rule: PatternRule; confidence: number } | null = null;

        for (const rule of ALL_PATTERNS) {
            if (rule.pattern.test(normalised) || rule.pattern.test(originalQuery)) {
                if (!bestMatch || rule.confidence > bestMatch.confidence) {
                    bestMatch = { rule, confidence: rule.confidence };
                }
            }
        }

        if (!bestMatch) return null;

        const { rule } = bestMatch;
        const suggestedModel = this.complexityToModel(rule.complexity, bestMatch.confidence);

        return {
            complexity: rule.complexity,
            category: rule.category,
            confidence: bestMatch.confidence,
            suggestedModel,
            reasoning: `regex:${rule.label}`,
        };
    }

    // ── Internal: LLM Pass (Groq) ──────────────────────────────────

    private async llmClassify(query: string): Promise<IntentClassification | null> {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) return null;

        const systemPrompt = `You are a query complexity classifier for a coding interview platform.
Classify the user's query into exactly ONE JSON object. Respond ONLY with valid JSON, no markdown.

Schema:
{
  "complexity": "simple" | "medium" | "complex",
  "category": "greeting" | "clarification" | "technical" | "behavioral" | "code_review",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}

Rules:
- simple: greetings, yes/no, acknowledgments, repetition requests
- medium: short definitions, basic examples, simple how-does-X-work
- complex: algorithms, code review, system design, trade-offs, behavioral questions
- confidence: how sure you are (0.0-1.0)`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.opts.llmTimeoutMs);

        try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'llama-3.1-8b-instant', // fastest Groq model
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: query },
                    ],
                    max_tokens: 150,
                    temperature: 0.1, // deterministic
                }),
                signal: controller.signal,
            });

            if (!response.ok) return null;

            const data = await response.json();
            const text = data.choices?.[0]?.message?.content?.trim();
            if (!text) return null;

            // Parse JSON response (strip markdown fences if present)
            const cleaned = text.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim();
            const parsed = JSON.parse(cleaned);

            // Validate shape
            const validComplexities = ['simple', 'medium', 'complex'];
            const validCategories = ['greeting', 'clarification', 'technical', 'behavioral', 'code_review'];

            if (
                !validComplexities.includes(parsed.complexity) ||
                !validCategories.includes(parsed.category) ||
                typeof parsed.confidence !== 'number'
            ) {
                return null;
            }

            const confidence = Math.max(0, Math.min(1, parsed.confidence));
            return {
                complexity: parsed.complexity,
                category: parsed.category,
                confidence,
                suggestedModel: this.complexityToModel(parsed.complexity, confidence),
                reasoning: `llm:${parsed.reasoning || 'groq-classified'}`,
            };
        } catch {
            return null;
        } finally {
            clearTimeout(timeout);
        }
    }

    // ── Internal: Cache ─────────────────────────────────────────────

    private addToCache(key: string, value: IntentClassification): void {
        // LRU eviction
        if (this.cache.size >= this.opts.maxCacheSize && !this.cache.has(key)) {
            const oldest = this.cacheInsertOrder.shift();
            if (oldest) this.cache.delete(oldest);
        }

        // Remove existing entry from order tracking if updating
        if (this.cache.has(key)) {
            const idx = this.cacheInsertOrder.indexOf(key);
            if (idx !== -1) this.cacheInsertOrder.splice(idx, 1);
        }

        this.cache.set(key, value);
        this.cacheInsertOrder.push(key);
    }

    private fuzzyLookup(normalised: string): IntentClassification | null {
        // Only attempt fuzzy match for short queries (perf guard)
        if (normalised.length > 50 || this.cache.size === 0) return null;

        let bestKey: string | null = null;
        let bestDist = Infinity;

        for (const key of this.cache.keys()) {
            // Skip if lengths differ too much — can't be within threshold
            if (Math.abs(key.length - normalised.length) > this.opts.fuzzyThreshold) continue;

            const dist = levenshtein(normalised, key);
            if (dist <= this.opts.fuzzyThreshold && dist < bestDist) {
                bestDist = dist;
                bestKey = key;
            }
        }

        if (bestKey) {
            const cached = this.cache.get(bestKey)!;
            // Reduce confidence slightly for fuzzy matches
            return {
                ...cached,
                confidence: Math.max(0.5, cached.confidence - bestDist * 0.05),
            };
        }

        return null;
    }

    // ── Internal: Helpers ───────────────────────────────────────────

    private complexityToModel(
        complexity: IntentComplexity,
        confidence: number
    ): 'groq' | 'gemini' {
        if (complexity === 'simple') return 'groq';
        if (complexity === 'medium') {
            return confidence >= this.opts.confidenceThreshold ? 'groq' : 'gemini';
        }
        return 'gemini'; // complex → always Gemini
    }

    private defaultClassification(normalised: string): IntentClassification {
        // Heuristic: short queries are likely simpler
        const words = normalised.split(/\s+/).filter(w => w.length > 0);
        if (words.length > 0 && words.length <= 3) {
            return { complexity: 'simple', category: 'clarification', confidence: 0.6, suggestedModel: 'groq' };
        }
        return { complexity: 'complex', category: 'technical', confidence: 0.5, suggestedModel: 'gemini' };
    }
}

// ── Singleton ───────────────────────────────────────────────────────

let classifierInstance: IntentClassifier | null = null;

export function getIntentClassifier(options?: ClassifierOptions): IntentClassifier {
    if (!classifierInstance) {
        classifierInstance = new IntentClassifier(options);
    }
    return classifierInstance;
}

/** Reset the singleton (useful for tests) */
export function resetIntentClassifier(): void {
    classifierInstance = null;
}
