/**
 * @codesage
 * @file      src/components/providers/QueryProvider.tsx
 * @purpose   Tanstack QueryClient provider wrapper for React components.
 * @tech      React, @tanstack/react-query
 * @connects  @tanstack/react-query
 * @apis      None
 * @db        None
 * @state     QueryClient state
 * @env       None
 * @issues    No issues found
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 

'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                // With SSR, we usually want to set some default staleTime
                // above 0 to avoid refetching immediately on the client
                staleTime: 60 * 1000 * 5, // 5 minutes
                gcTime: 1000 * 60 * 60 * 24, // 24 hours
            },
        },
    }));

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}
