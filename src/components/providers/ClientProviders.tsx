'use client';

import { useSessionPersistence } from '@/lib/auth/session-manager';

/**
 * Client-side providers wrapper
 * This component runs client-side hooks that need to be used in the root layout
 */
export function ClientProviders({ children }: { children: React.ReactNode }) {
    // Initialize session persistence (auto-refresh tokens, handle auth events)
    useSessionPersistence();

    return <>{children}</>;
}
