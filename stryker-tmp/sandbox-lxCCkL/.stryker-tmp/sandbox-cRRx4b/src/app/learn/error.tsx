/**
 * @codesage
 * @file      src/app/learn/error.tsx
 * @purpose   Displays a fallback error UI and reports telemetry for failures within the learn route.
 * @tech      Next.js, React, Lucide React
 * @connects  Imports reportError from @/lib/telemetry/report-error
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { reportError } from '@/lib/telemetry/report-error';

export default function LearnError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    reportError(error, {
      severity: 'error',
      extra: { route: 'learn' },
    });
  }, [error]);

  return (
    <div className="flex-1 bg-[#0A0A0F] flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red-950/40 border border-red-500/25 mb-4">
          <AlertCircle size={24} className="text-red-400" />
        </div>
        <h2 className="text-lg font-bold text-white mb-2">Something went wrong</h2>
        <p className="text-sm text-zinc-400 mb-6">
          {error.message?.includes('Unauthorized')
            ? 'You need to be signed in to use Learn mode.'
            : 'Failed to load the learn session. This has been reported.'}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
          >
            <RefreshCw size={14} />
            Try again
          </button>
          <button
            onClick={() => router.push('/learn')}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium transition-colors"
          >
            Back to Learn
          </button>
        </div>
      </div>
    </div>
  );
}