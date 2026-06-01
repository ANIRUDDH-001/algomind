/**
 * @codesage
 * @file      src/hooks/useGuardedRouter.ts
 * @purpose   React hook wrapping Next.js useRouter to prevent concurrent duplicate navigations.
 * @tech      React, Next.js App Router
 * @connects  Wraps next/navigation useRouter; Exported for general app navigation
 * @apis      none
 * @db        none
 * @state     React refs for navigating status and timeouts
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
'use client';

import { useRouter } from 'next/navigation';
import { useRef, useCallback, useMemo } from 'react';

/**
 * A wrapper around Next.js useRouter that prevents concurrent navigations.
 * Adds an isNavigating ref guard so that rapid-fire router.push calls
 * (from effects, click handlers, etc.) don't produce multiple parallel
 * navigation requests.
 *
 * Usage: drop-in replacement for useRouter() in components with
 * multiple navigation triggers.
 */
export function useGuardedRouter() {
    const router = useRouter();
    const isNavigatingRef = useRef(false);
    const navigationTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const guardedPush = useCallback(
        (href: string, options?: Parameters<typeof router.push>[1]) => {
            if (isNavigatingRef.current) return;
            isNavigatingRef.current = true;

            // Clear any previous timeout
            if (navigationTimeoutRef.current) {
                clearTimeout(navigationTimeoutRef.current);
            }

            router.push(href, options);

            // Reset guard after navigation settles (Next.js route transitions
            // are typically sub-second; 1s is generous enough for slow networks)
            navigationTimeoutRef.current = setTimeout(() => {
                isNavigatingRef.current = false;
            }, 1000);
        },
        [router]
    );

    const guardedReplace = useCallback(
        (href: string, options?: Parameters<typeof router.replace>[1]) => {
            if (isNavigatingRef.current) return;
            isNavigatingRef.current = true;

            if (navigationTimeoutRef.current) {
                clearTimeout(navigationTimeoutRef.current);
            }

            router.replace(href, options);

            navigationTimeoutRef.current = setTimeout(() => {
                isNavigatingRef.current = false;
            }, 1000);
        },
        [router]
    );

    return useMemo(
        () => ({
            ...router,
            push: guardedPush,
            replace: guardedReplace,
            isNavigating: isNavigatingRef,
        }),
        [router, guardedPush, guardedReplace]
    );
}
