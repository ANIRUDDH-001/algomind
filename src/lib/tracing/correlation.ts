export const CORRELATION_ID_HEADER = 'x-correlation-id';

export function createCorrelationId(): string {
    return crypto.randomUUID();
}

export function getCorrelationIdFromRequest(request: Pick<Request, 'headers'> | Headers): string {
    const requestHeaders = request instanceof Headers ? request : request.headers;
    return requestHeaders.get(CORRELATION_ID_HEADER) ?? createCorrelationId();
}

export async function getCorrelationId(): Promise<string> {
    // This helper must remain isomorphic because it is imported in both
    // server-only and client-reachable module graphs.
    return createCorrelationId();
}

export function withCorrelationIdHeaders(headersInit: HeadersInit | undefined, correlationId: string): Headers {
    const responseHeaders = new Headers(headersInit);
    responseHeaders.set(CORRELATION_ID_HEADER, correlationId);
    return responseHeaders;
}

export function withCorrelationId<T extends Response>(response: T, correlationId: string): T {
    response.headers.set(CORRELATION_ID_HEADER, correlationId);
    return response;
}

export function createRequestContext(correlationId: string, extra?: Record<string, string>) {
    return {
        correlationId,
        timestamp: new Date().toISOString(),
        ...extra,
    };
}