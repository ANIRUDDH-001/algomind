'use client';

/**
 * LearnErrorFallback
 *
 * Error fallback rendered by ErrorBoundary around the Learn session client.
 * Streaming failures (SSE parser, abort handling, transcript persistence) and
 * other unhandled errors land here instead of a blank screen. Users can retry
 * the same concept or restart from /learn.
 */

import { AlertTriangle, RefreshCcw, RotateCcw } from 'lucide-react';

interface LearnErrorFallbackProps {
  conceptSlug: string;
}

export function LearnErrorFallback({ conceptSlug }: LearnErrorFallbackProps) {
  const tryAgain = () => {
    // Reload current concept page — fresh session, same slug.
    window.location.href = `/learn/${conceptSlug}`;
  };

  const restart = () => {
    // Bail back to the concept picker.
    window.location.href = '/learn';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="text-center p-8 bg-[var(--surface-1)]/50 border border-white/8 rounded-2xl shadow-2xl max-w-md w-full">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-8 h-8 text-red-400" />
        </div>

        <h2 className="text-2xl font-bold text-white mb-2">
          Learn session interrupted
        </h2>

        <p className="text-zinc-400 mb-6 text-sm">
          Something went wrong while streaming Kai&apos;s response. Your progress up
          to the last completed turn is saved. Try again, or pick a different
          concept.
        </p>

        <div className="flex gap-3 justify-center">
          <button
            onClick={tryAgain}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors"
          >
            <RefreshCcw className="w-4 h-4" />
            Try again
          </button>
          <button
            onClick={restart}
            className="flex items-center gap-2 px-5 py-2.5 bg-[var(--surface-3)] hover:bg-[var(--surface-edge-hi)] text-white rounded-lg font-medium transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Restart session
          </button>
        </div>
      </div>
    </div>
  );
}
