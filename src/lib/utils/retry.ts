/**
 * Exponential backoff retry utility for API calls.
 *
 * Retries failed requests with increasing delays:
 * - Attempt 1: immediate
 * - Attempt 2: 1s delay
 * - Attempt 3: 2s delay
 * - Attempt 4: 4s delay
 */

export interface RetryOptions {
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs: number;
    retryOn?: (error: Error | Response) => boolean;
    onRetry?: (attempt: number, error: Error | Response) => void;
}

const DEFAULT_OPTIONS: RetryOptions = {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
};

/**
 * Execute an async function with exponential backoff retry.
 *
 * @example
 * const result = await retryWithBackoff(
 *   () => fetch(url),
 *  {
     *     maxRetries: 3,
     *     retryOn: (err) => err instanceof Response && err.status === 429
     *   }
     * );
     */
    export async function retryWithBackoff<T>(
        fn: () => Promise<T>,
        options: Partial<RetryOptions> = {}
    ): Promise<T> {
        const opts = { ...DEFAULT_OPTIONS, ...options };
        let lastError: Error | Response;

        for (let attempt = 1; attempt <= opts.maxRetries + 1; attempt++) {
            try {
                return await fn();
            } catch (err) {
                lastError = err as Error | Response;

                // Check if we should retry
                const shouldRetry = opts.retryOn ? opts.retryOn(lastError) : true;
                if (!shouldRetry || attempt > opts.maxRetries) {
                    throw lastError;
                }

                // Calculate delay with exponential backoff + jitter
                const delay = Math.min(
                    opts.baseDelayMs * Math.pow(2, attempt - 1),
                    opts.maxDelayMs
                );
                const jitter = Math.random() * 0.3 * delay; // ±30% jitter
                const totalDelay = delay + jitter;

                opts.onRetry?.(attempt, lastError);
                console.warn(`[Retry] Attempt ${attempt} failed, retrying in ${Math.round(totalDelay)}ms...`);

                await new Promise(resolve => setTimeout(resolve, totalDelay));
            }
        }

        throw lastError!;
    }
