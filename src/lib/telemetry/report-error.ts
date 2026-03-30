export type ErrorSeverity = 'error' | 'warning' | 'fatal';

export interface ReportErrorContext {
    componentStack?: string;
    severity?: ErrorSeverity;
    extra?: Record<string, string>;
}

/**
 * Report an error to the server.
 * Fire-and-forget and never throws.
 */
export function reportError(error: Error, context?: ReportErrorContext): void {
    try {
        const body = {
            error_message: String(error.message || 'Unknown error').slice(0, 2000),
            error_stack: String(error.stack || '').slice(0, 5000),
            component_stack: String(context?.componentStack || '').slice(0, 2000),
            url: typeof window !== 'undefined' ? window.location.href : undefined,
            user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
            severity: context?.severity || 'error',
            ...(context?.extra || {}),
        };

        if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
            const blob = new Blob([JSON.stringify(body)], { type: 'application/json' });
            navigator.sendBeacon('/api/log-error', blob);
            return;
        }

        void fetch('/api/log-error', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            keepalive: true,
        }).catch(() => {
            // Swallow reporter failures to avoid cascading errors.
        });
    } catch {
        // Never throw from telemetry path.
    }
}
