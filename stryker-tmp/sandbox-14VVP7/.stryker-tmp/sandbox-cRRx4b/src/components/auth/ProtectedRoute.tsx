/**
 * @codesage
 */
// @ts-nocheck

// 

'use client';

import { useAuth } from './AuthProvider';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useGuardedRouter } from '@/hooks/useGuardedRouter';
import { LoadingState } from '@/components/LoadingState';

interface ProtectedRouteProps {
    children: React.ReactNode;
    fallbackUrl?: string;
}

export function ProtectedRoute({ children, fallbackUrl = '/login' }: ProtectedRouteProps) {
    const { user, loading } = useAuth();
    const router = useGuardedRouter();
    const pathname = usePathname();
    const hasRedirected = useRef(false);

    useEffect(() => {
        if (!loading && !user && !hasRedirected.current) {
            hasRedirected.current = true;
            sessionStorage.setItem('redirectAfterLogin', pathname);
            router.push(fallbackUrl);
        }
    }, [user, loading, pathname, fallbackUrl]); // removed router from deps

    if (loading) {
        return <LoadingState message="Checking authentication..." fullScreen />;
    }

    if (!user) {
        return null;
    }

    return <>{children}</>;
}
