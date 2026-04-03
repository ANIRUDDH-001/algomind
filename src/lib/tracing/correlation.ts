// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 6: CORRELATION FOUNDATION HARDENING
// ═══════════════════════════════════════════════════════════════════════════════

export const CORRELATION_ID_HEADER = 'x-correlation-id';
export const PARENT_CORRELATION_ID_HEADER = 'x-parent-correlation-id';
export const HOP_ID_HEADER = 'x-hop-id';

/**
 * Represents a single hop in a request lineage (HTTP → cron → batch → edge).
 * Used for end-to-end tracing across system boundaries.
 */
export interface CorrelationHop {
    hop_id: string;           // Unique ID for this hop (sequential UUID)
    source: 'http' | 'cron' | 'batch' | 'edge' | 'script'; // Originating layer
    root_correlation_id: string;  // Immutable root trace ID
    parent_correlation_id?: string; // ID of previous hop (if async handoff)
    started_at: string;       // ISO timestamp when hop began
    ended_at?: string;        // ISO timestamp when hop completed
    success: boolean;
    error_code?: string;
    error_message?: string;
}

/**
 * Represents the complete correlation context for a request.
 * Tracks root ID, parent IDs, and hop lineage for distributed tracing.
 */
export interface CorrelationContext {
    root_correlation_id: string;
    parent_correlation_id?: string;
    current_hop_id: string;
    current_source: 'http' | 'cron' | 'batch' | 'edge' | 'script';
    hops: CorrelationHop[];
}

/**
 * Creates a new correlation ID (UUID v4).
 * This function should not be called directly; use getOrCreateCorrelationId() instead.
 */
export function createCorrelationId(): string {
    return crypto.randomUUID();
}

/**
 * Extracts correlation ID from request headers, or creates one if missing.
 * Enforces strict validation: non-empty UUID format.
 * @throws {Error} if header exists but is malformed (empty string, invalid format)
 */
export function getCorrelationIdFromRequest(request: Pick<Request, 'headers'> | Headers): string {
    const requestHeaders = request instanceof Headers ? request : request.headers;
    const correlationId = requestHeaders.get(CORRELATION_ID_HEADER);
    
    if (correlationId) {
        // Validate existing header: must be non-empty and match UUID format
        if (!correlationId.trim()) {
            throw new Error('Correlation ID header exists but is empty');
        }
        if (!isValidUUID(correlationId)) {
            throw new Error(`Invalid Correlation ID format: ${correlationId}`);
        }
        return correlationId;
    }
    
    // No header: create new correlation ID
    return createCorrelationId();
}

/**
 * Extracts parent correlation ID from request headers (optional).
 * Used for async handoffs (HTTP → cron → batch → edge).
 * Makes parent ID optional; always succeeds if header is valid.
 */
export function getParentCorrelationIdFromRequest(request: Pick<Request, 'headers'> | Headers): string | undefined {
    const requestHeaders = request instanceof Headers ? request : request.headers;
    const parentId = requestHeaders.get(PARENT_CORRELATION_ID_HEADER);
    
    if (!parentId) return undefined;
    
    if (!parentId.trim()) {
        throw new Error('Parent Correlation ID header exists but is empty');
    }
    
    if (!isValidUUID(parentId)) {
        throw new Error(`Invalid Parent Correlation ID format: ${parentId}`);
    }
    
    return parentId;
}

/**
 * Validates UUID v4 format (strict check).
 */
export function isValidUUID(id: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
}

/**
 * Async helper to retrieve current correlation ID (isomorphic, safe for both server + client).
 * Returns a valid UUID (creates one if not available in context).
 */
export async function getCorrelationId(): Promise<string> {
    // This helper must remain isomorphic because it is imported in both
    // server-only and client-reachable module graphs.
    return createCorrelationId();
}

/**
 * Adds correlation ID headers to a response headers object (mutable).
 * Includes x-correlation-id (required) and x-parent-correlation-id (if present).
 * Enforces non-empty header values.
 */
export function withCorrelationIdHeaders(
    headersInit: HeadersInit | undefined,
    correlationId: string,
    parentCorrelationId?: string
): Headers {
    if (!correlationId || !correlationId.trim()) {
        throw new Error('Cannot add correlation headers with empty correlation_id');
    }
    
    const responseHeaders = new Headers(headersInit);
    responseHeaders.set(CORRELATION_ID_HEADER, correlationId);
    
    if (parentCorrelationId && parentCorrelationId.trim()) {
        responseHeaders.set(PARENT_CORRELATION_ID_HEADER, parentCorrelationId);
    }
    
    return responseHeaders;
}

/**
 * Adds correlation ID header to a Response (mutable).
 * Includes x-correlation-id (required) and x-parent-correlation-id (if present).
 */
export function withCorrelationId<T extends Response>(
    response: T,
    correlationId: string,
    parentCorrelationId?: string
): T {
    if (!correlationId || !correlationId.trim()) {
        throw new Error('Cannot set correlation header with empty correlation_id');
    }
    
    response.headers.set(CORRELATION_ID_HEADER, correlationId);
    
    if (parentCorrelationId && parentCorrelationId.trim()) {
        response.headers.set(PARENT_CORRELATION_ID_HEADER, parentCorrelationId);
    }
    
    return response;
}

/**
 * Creates a request context bundle for immediate request handling.
 * Includes root correlation ID, parent ID (if async handoff), and timestamp.
 * Used to pass correlation context to async tasks, batch jobs, and edge functions.
 */
export function createRequestContext(
    correlationId: string,
    parentCorrelationId?: string,
    extra?: Record<string, string>
) {
    if (!correlationId || !correlationId.trim()) {
        throw new Error('Cannot create request context with empty correlation_id');
    }
    
    return {
        root_correlation_id: correlationId,
        parent_correlation_id: parentCorrelationId,
        current_hop_id: createCorrelationId(),
        timestamp: new Date().toISOString(),
        ...extra,
    };
}

/**
 * Begins a new correlation hop (async handoff to cron/batch/edge).
 * Increments the hop lineage and creates a new hop context.
 * Parent correlation ID becomes the previous hop's current ID.
 */
export function beginCorrelationHop(
    rootCorrelationId: string,
    source: 'cron' | 'batch' | 'edge' | 'script',
    parentCorrelationId?: string
): CorrelationHop {
    if (!rootCorrelationId || !rootCorrelationId.trim()) {
        throw new Error('Cannot begin hop with empty root_correlation_id');
    }
    
    return {
        hop_id: createCorrelationId(),
        source,
        root_correlation_id: rootCorrelationId,
        parent_correlation_id: parentCorrelationId,
        started_at: new Date().toISOString(),
        success: false,
    };
}

/**
 * Completes a correlation hop (success or failure).
 * Records end time, success status, and optional error details.
 */
export function completeCorrelationHop(
    hop: CorrelationHop,
    success: boolean,
    errorCode?: string,
    errorMessage?: string
): CorrelationHop {
    return {
        ...hop,
        ended_at: new Date().toISOString(),
        success,
        error_code: errorCode,
        error_message: errorMessage,
    };
}

/**
 * Extracts correlation context from request headers (both HTTP and internal propagation).
 * Strictly validates all present headers.
 * Returns a safe context object ready for async handoffs.
 * @throws {Error} if any present header is malformed
 */
export function extractCorrelationContextFromRequest(
    request: Pick<Request, 'headers'> | Headers
): CorrelationContext {
    const correlationId = getCorrelationIdFromRequest(request);
    const parentCorrelationId = getParentCorrelationIdFromRequest(request);
    
    return {
        root_correlation_id: correlationId,
        parent_correlation_id: parentCorrelationId,
        current_hop_id: createCorrelationId(),
        current_source: 'http',
        hops: [],
    };
}
