/**
 * Report a client-side error to the server. Non-blocking, never throws.
 */
export function reportError(
    error: Error,
    context?: {
        componentStack?: string;
        severity?: 'error' | 'warning' | 'fatal';
        extra?: Record<string, string>;
    }
) {
    try {
        const body = JSON.stringify({
            error_message: error.message,
            error_stack: error.stack,
            component_stack: context?.componentStack,
            url: typeof window !== 'undefined' ? window.location.href : undefined,
            user_agent:
                typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
            severity: context?.severity || 'error',
        });

        if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
            navigator.sendBeacon('/api/log-error', body);
        } else {
            fetch('/api/log-error', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
                keepalive: true,
            }).catch(() => {});
        }
    } catch {
        // Never throw from error reporter
    }
}
