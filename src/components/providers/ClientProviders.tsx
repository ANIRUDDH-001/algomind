'use client';

import { useEffect, useState } from 'react';
import { useSessionPersistence } from '@/lib/auth/session-manager';
import { UpgradeModal, type UpgradeModalPayload } from '@/components/upgrade/UpgradeModal';
import { reportError } from '@/lib/telemetry/report-error';

/**
 * Client-side providers wrapper
 * This component runs client-side hooks that need to be used in the root layout
 */
export function ClientProviders({ children }: { children: React.ReactNode }) {
    // Initialize session persistence (auto-refresh tokens, handle auth events)
    useSessionPersistence();

    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
    const [upgradePayload, setUpgradePayload] = useState<UpgradeModalPayload | null>(null);

    useEffect(() => {
        const listener = (event: Event) => {
            const customEvent = event as CustomEvent<UpgradeModalPayload>;
            setUpgradePayload(customEvent.detail ?? null);
            setIsUpgradeModalOpen(true);
        };

        window.addEventListener('algomind:upgrade-modal', listener as EventListener);
        return () => {
            window.removeEventListener('algomind:upgrade-modal', listener as EventListener);
        };
    }, []);

    useEffect(() => {
        const handleError = (event: ErrorEvent) => {
            const error = event.error instanceof Error
                ? event.error
                : new Error(event.message || 'Unhandled window error');

            reportError(error, {
                severity: 'error',
                extra: {
                    source: 'window.error',
                    file: event.filename || '',
                    line: String(event.lineno || 0),
                    column: String(event.colno || 0),
                },
            });
        };

        const handleRejection = (event: PromiseRejectionEvent) => {
            const error = event.reason instanceof Error
                ? event.reason
                : new Error(String(event.reason));

            reportError(error, {
                severity: 'warning',
                extra: {
                    source: 'window.unhandledrejection',
                },
            });
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
            <UpgradeModal
                open={isUpgradeModalOpen}
                onOpenChange={setIsUpgradeModalOpen}
                payload={upgradePayload}
            />
        </>
    );
}
