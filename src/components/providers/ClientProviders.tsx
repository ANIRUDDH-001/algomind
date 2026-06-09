/**
 * @codesage
 * @file      src/components/providers/ClientProviders.tsx
 * @purpose   Client-side providers wrapper for global hooks (session, telemetry).
 * @tech      React, Next.js
 * @connects  @/lib/auth/session-manager, @/lib/telemetry/report-error
 * @apis      None
 * @db        None
 * @state     Local Component State
 * @env       None
 * @issues    No issues found
 * @audit     CODESAGE-v1
 */
'use client';

import React, { useEffect } from 'react';
import { useSessionPersistence } from '@/lib/auth/session-manager';
import { reportError } from '@/lib/telemetry/report-error';

/**
 * Client-side providers wrapper
 * This component runs client-side hooks that need to be used in the root layout
 */
export function ClientProviders({ children }: { children: React.ReactNode }) {
    // Initialize session persistence (auto-refresh tokens, handle auth events)
    useSessionPersistence();

    // Custom event listener removed

    useEffect(() => {
        const handleError = (event: ErrorEvent) => {
            if (event.error) {
                reportError(event.error, { severity: 'error' });
            }
        };

        const handleRejection = (event: PromiseRejectionEvent) => {
            const error = event.reason instanceof Error
                ? event.reason
                : new Error(String(event.reason));
            reportError(error, { severity: 'warning' });
        };

        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handleRejection);

        return () => {
            window.removeEventListener('error', handleError);
            window.removeEventListener('unhandledrejection', handleRejection);
        };
    }, []);

    return (
        <>
            {children}
        </>
    );
}
