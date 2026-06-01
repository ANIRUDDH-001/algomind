/**
 * @codesage
 * @file      src/lib/api/result.ts
 * @purpose   Provides a discriminated union pattern for server action results
 * @tech      None
 * @connects  None
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1
 */
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
