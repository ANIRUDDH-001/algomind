/* eslint-disable @typescript-eslint/no-explicit-any */
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

/**
 * Wrap an async function with automatic error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    onError?: (error: Error) => void
): T {
    return (async (...args: Parameters<T>) => {
        try {
            return await fn(...args);
        } catch (error: unknown) {
            const handledError = error instanceof Error ? error : new Error(String(error));
            onError?.(handledError);
            throw handledError;
        }
    }) as T;
}

/**
 * Check if an error is transient and should be retried
 */
export function isTransientError(error: unknown): boolean {
    if (error instanceof APIError) {
        return error.retryable;
    }

    if (error instanceof Error) {
        const message = error.message.toLowerCase();
        return (
            message.includes('network') ||
            message.includes('timeout') ||
            message.includes('rate') ||
            message.includes('503') ||
            message.includes('502') ||
            message.includes('504')
        );
    }

    return false;
}
