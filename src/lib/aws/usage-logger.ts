/**
 * AWS Usage Logger — Tracks all AWS API calls for budget visibility.
 *
 * Every AWS service call (Polly, S3, Transcribe, Bedrock) should log usage here.
 * The owner dashboard reads from the `aws_usage_log` table to display costs.
 *
 * Non-blocking: failures here never break the main flow.
 */

import { getServiceClient } from '@/lib/supabase/service';

export type AWSService = 'polly' | 's3' | 'transcribe' | 'bedrock';

export interface UsageLogEntry {
    service: AWSService;
    operation: string;
    region: string;
    bytesProcessed?: number;
    estimatedCostUsd?: number;
    userId?: string | null;
    sessionId?: string | null;
    metadata?: Record<string, unknown>;
}

/**
 * Log an AWS API call. Fire-and-forget — never throws.
 */
export async function logAWSUsage(entry: UsageLogEntry): Promise<void> {
    try {
        const supabase = getServiceClient();
        await supabase.from('aws_usage_log').insert({
            service: entry.service,
            operation: entry.operation,
            region: entry.region,
            bytes_processed: entry.bytesProcessed || 0,
            estimated_cost_usd: entry.estimatedCostUsd || 0,
            user_id: entry.userId || null,
            session_id: entry.sessionId || null,
            metadata: entry.metadata || {},
        });
    } catch (err) {
        // Never throw — usage logging is best-effort
        console.warn('[AWS Usage Logger] Failed to log:', err instanceof Error ? err.message : err);
    }
}

/**
 * Polly cost estimate: $4.00/million chars (Neural), $1.00/million chars (Standard).
 */
export function estimatePollyCost(charCount: number, isNeural = true): number {
    const ratePerMillion = isNeural ? 4.0 : 1.0;
    return (charCount / 1_000_000) * ratePerMillion;
}

/**
 * Bedrock cost estimate (Claude 3.5 Sonnet):
 * Input: $3.00/million tokens, Output: $15.00/million tokens.
 * Rough: ~4 chars per token.
 */
export function estimateBedrockCost(inputChars: number, outputChars: number): number {
    const inputTokens = inputChars / 4;
    const outputTokens = outputChars / 4;
    return (inputTokens / 1_000_000) * 3.0 + (outputTokens / 1_000_000) * 15.0;
}

/**
 * Transcribe cost: $0.024/min.
 */
export function estimateTranscribeCostFromDuration(durationSec: number): number {
    return (durationSec / 60) * 0.024;
}

/**
 * S3 cost: negligible for small volumes but we track for completeness.
 * $0.005 per 1000 PUT, $0.023/GB stored.
 */
export function estimateS3PutCost(bytes: number): number {
    const gbCost = (bytes / (1024 ** 3)) * 0.023;
    return gbCost + 0.000005; // one PUT request
}
