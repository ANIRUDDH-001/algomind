/**
 * @codesage
 * @file      src/hooks/useKeyboardShortcuts.ts
 * @purpose   React hook to handle global keyboard shortcuts (e.g. Cmd+K to navigate to /learn).
 * @tech      React, Next.js App Router
 * @connects  Exported for global layout/app components
 * @apis      none
 * @db        none
 * @state     None (event listeners only)
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export function useLearnKeyboardShortcuts() {
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            if (!target) return;

            const tagName = target.tagName;
            const isTypingField =
                tagName === 'INPUT' ||
                tagName === 'TEXTAREA' ||
                target.isContentEditable;

            if (isTypingField || e.metaKey || e.ctrlKey || e.altKey) {
                return;
            }

            if (e.key === 'k' || e.key === 'K' || e.key === 'l' || e.key === 'L') {
                if (pathname !== '/learn') {
                    e.preventDefault();
                    router.push('/learn');
                }
                return;
            }

            if (e.key === 'Escape' && pathname.startsWith('/learn/') && pathname !== '/learn/diagnostic') {
                e.preventDefault();
                document.dispatchEvent(new CustomEvent('learn-escape-pressed'));
            }
        };

        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [pathname, router]);
}