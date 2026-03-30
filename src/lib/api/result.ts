/**
 * Discriminated union for server action results.
 * Forces callers to check success before accessing data.
 */
export type Result<T, E = string> =
    | { success: true; data: T }
    | { success: false; error: E; code?: string };

/**
 * Helper to create a success result.
 */
export function ok<T>(data: T): Result<T> {
    return { success: true, data };
}

/**
 * Helper to create an error result.
 */
export function err<E = string>(error: E, code?: string): Result<never, E> {
    return { success: false, error, code };
}
