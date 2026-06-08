/**
 * @codesage
 * @file      src/lib/analytics/model-telemetry.ts
 * @purpose   Provides server-side in-memory telemetry tracking for AI model routing decisions and latency.
 * @tech      TypeScript
 * @connects  Exported singleton used by AI routing services.
 * @apis      None
 * @db        None
 * @state     Maintains a circular buffer of routing decisions in memory.
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

/**
 * Model Telemetry — server-side in-memory tracking of routing decisions.
 *
 * Tracks which model was chosen, response latency, and
 * enables cost-savings analysis (Groq is faster/cheaper for simple queries).
 *
 * @module model-telemetry
 */

// ── Types ───────────────────────────────────────────────────────────

export interface RoutingDecision {
    /** Timestamp of the decision */
    timestamp: number;
    /** The user query (truncated to 100 chars for privacy) */
    query: string;
    /** Classified complexity */
    complexity: 'simple' | 'medium' | 'complex';
    /** Classified category */
    category: string;
    /** Classification confidence */
    confidence: number;
    /** Which model was routed to */
    routedTo: 'groq' | 'gemini' | 'bedrock';
    /** Which model actually responded (may differ if fallback occurred) */
    actualModel: string;
    /** Whether smart routing was used (vs explicit override) */
    smartRouting: boolean;
    /** Classification latency in ms */
    classificationTimeMs: number;
    /** Total response latency in ms */
    totalTimeMs: number;
    /** Whether the request succeeded */
    success: boolean;
}

export interface TelemetryStats {
    /** Total routing decisions tracked */
    totalDecisions: number;
    /** Decisions made by smart routing (vs explicit) */
    smartRoutingDecisions: number;
    /** Breakdown by routed model */
    routedToGroq: number;
    routedToGemini: number;
    /** Average latencies */
    avgClassificationMs: number;
    avgTotalMs: number;
    avgGroqLatencyMs: number;
    avgGeminiLatencyMs: number;
    /** Success rate */
    successRate: number;
    /** Estimated cost savings (Groq calls that would have gone to Gemini) */
    estimatedSavings: {
        simpleQueriesRoutedToGroq: number;
        estimatedTimeSavedMs: number;
    };
}

// ── Constants ───────────────────────────────────────────────────────

const MAX_DECISIONS = 1000;

// ── ModelTelemetry ──────────────────────────────────────────────────

export class ModelTelemetry {
    private decisions: RoutingDecision[] = [];

    /** Record a routing decision */
    recordDecision(decision: RoutingDecision): void {
        // Truncate query for privacy
        const sanitised: RoutingDecision = {
            ...decision,
            query: decision.query.length > 100
                ? decision.query.slice(0, 97) + '...'
                : decision.query,
        };

        this.decisions.push(sanitised);

        // Circular buffer: evict oldest
        if (this.decisions.length > MAX_DECISIONS) {
            this.decisions = this.decisions.slice(this.decisions.length - MAX_DECISIONS);
        }
    }

    /** Get aggregate statistics */
    getStats(): TelemetryStats {
        const total = this.decisions.length;

        if (total === 0) {
            return {
                totalDecisions: 0,
                smartRoutingDecisions: 0,
                routedToGroq: 0,
                routedToGemini: 0,
                avgClassificationMs: 0,
                avgTotalMs: 0,
                avgGroqLatencyMs: 0,
                avgGeminiLatencyMs: 0,
                successRate: 0,
                estimatedSavings: {
                    simpleQueriesRoutedToGroq: 0,
                    estimatedTimeSavedMs: 0,
                },
            };
        }

        const smart = this.decisions.filter(d => d.smartRouting);
        const groqDecisions = this.decisions.filter(d => d.routedTo === 'groq');
        const geminiDecisions = this.decisions.filter(d => d.routedTo === 'gemini');
        const successes = this.decisions.filter(d => d.success);

        const avg = (arr: number[]) => arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;

        // Simple queries routed to Groq that would have defaulted to Gemini
        const simpleGroq = this.decisions.filter(
            d => d.smartRouting && d.routedTo === 'groq' && d.complexity === 'simple'
        );

        // Estimate time saved: assume Gemini averages ~800ms more than Groq for simple queries
        const ESTIMATED_GEMINI_OVERHEAD_MS = 800;

        return {
            totalDecisions: total,
            smartRoutingDecisions: smart.length,
            routedToGroq: groqDecisions.length,
            routedToGemini: geminiDecisions.length,
            avgClassificationMs: Math.round(avg(this.decisions.map(d => d.classificationTimeMs))),
            avgTotalMs: Math.round(avg(this.decisions.map(d => d.totalTimeMs))),
            avgGroqLatencyMs: Math.round(avg(groqDecisions.map(d => d.totalTimeMs))),
            avgGeminiLatencyMs: Math.round(avg(geminiDecisions.map(d => d.totalTimeMs))),
            successRate: Math.round((successes.length / total) * 100),
            estimatedSavings: {
                simpleQueriesRoutedToGroq: simpleGroq.length,
                estimatedTimeSavedMs: simpleGroq.length * ESTIMATED_GEMINI_OVERHEAD_MS,
            },
        };
    }

    /** Get recent decisions for admin dashboard */
    getDecisionLog(limit = 50): RoutingDecision[] {
        return this.decisions.slice(-limit);
    }

    /** Clear all telemetry data */
    clear(): void {
        this.decisions = [];
    }

    /** Get total number of tracked decisions */
    get size(): number {
        return this.decisions.length;
    }
}

// ── Singleton ───────────────────────────────────────────────────────

let instance: ModelTelemetry | null = null;

export function getModelTelemetry(): ModelTelemetry {
    if (!instance) {
        instance = new ModelTelemetry();
    }
    return instance;
}

