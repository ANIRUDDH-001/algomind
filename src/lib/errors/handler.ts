/**
 * @codesage
 * @file      src/lib/errors/handler.ts
 * @purpose   Error handling and user-friendly error formatting.
 * @tech      Node.js
 * @connects  Imports app logic, configuration, and external library utilities
 * @apis      None directly visible
 * @db        None
 * @state     Stateless
 * @env       None
 * @issues    No major issues observed.
 * @audit     CODESAGE-v1
 */
 
export class APIError extends Error {
    constructor(
        message: string,
        public statusCode?: number,
        public retryable: boolean = false
    ) {
        super(message);
        this.name = 'APIError';
    }
}

export async function handleAPIError(error: unknown): Promise<never> {
    if (error instanceof APIError) {
        throw error;
    }

    if (error instanceof Error) {
        const message = error.message.toLowerCase();

        if (message.includes('rate') || message.includes('limit') || message.includes('quota')) {
            throw new APIError('Rate limit exceeded. Please try again in a moment.', 429, true);
        }

        if (message.includes('network') || message.includes('fetch')) {
            throw new APIError('Network error. Please check your connection.', 0, true);
        }

        if (message.includes('timeout')) {
            throw new APIError('Request timed out. Please try again.', 408, true);
        }

        if (message.includes('unauthorized') || message.includes('401')) {
            throw new APIError('Authentication failed. Please refresh the page.', 401, false);
        }
    }

    throw new APIError('An unexpected error occurred. Please try again.', 500, true);
}

export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelayMs: number = 1000
): Promise<T> {
    let lastError: Error = new Error('No attempts made');

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error: unknown) {
            lastError = error instanceof Error ? error : new Error(String(error));

            // Don't retry non-retryable errors
            if (error instanceof APIError && !error.retryable) {
                throw error;
            }

            if (attempt < maxRetries - 1) {
                // Exponential backoff with jitter
                const delay = Math.min(baseDelayMs * Math.pow(2, attempt), 10000);
                const jitter = Math.random() * 500;
                await new Promise(resolve => setTimeout(resolve, delay + jitter));
            }
        }
    }

    throw lastError;
}


