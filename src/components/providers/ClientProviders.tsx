'use client';

import { useEffect, useState } from 'react';
import { useSessionPersistence } from '@/lib/auth/session-manager';
import { UpgradeModal, type UpgradeModalPayload } from '@/components/upgrade/UpgradeModal';

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
