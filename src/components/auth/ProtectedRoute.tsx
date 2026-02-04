'use client';

import { useAuth } from './AuthProvider';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { LoadingState } from '@/components/LoadingState';

interface ProtectedRouteProps {
    children: React.ReactNode;
    fallbackUrl?: string;
}

export function ProtectedRoute({ children, fallbackUrl = '/login' }: ProtectedRouteProps) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (!loading && !user) {
            // Store the attempted URL to redirect back after login
            sessionStorage.setItem('redirectAfterLogin', pathname);
            router.push(fallbackUrl);
        }
    }, [user, loading, router, fallbackUrl, pathname]);

    if (loading) {
        return <LoadingState message="Checking authentication..." fullScreen />;
    }

    if (!user) {
        return null;
    }

    return <>{children}</>;
}
