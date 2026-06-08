/**
 * @codesage
 * @file      src/app/learn/[slug]/results/page.tsx
 * @purpose   Client component to display post-session results, concept progress, and Kai's assessment notes.
 * @tech      Next.js, React, Framer Motion, Lucide React
 * @connects  API route /api/learn/results/[sessionId]
 * @apis      GET /api/learn/results/[sessionId]
 * @db        None
 * @state     React local state
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 

'use client';

import { useSearchParams, useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, TrendingUp, TrendingDown, Minus, Home, Loader2, AlertCircle } from 'lucide-react';

interface ResultsPayload {
  session: {
    id: string;
    conceptSlug: string;
    durationSeconds: number | null;
    exchangeCount: number;
    startedAt: string | null;
    completedAt: string | null;
  };
  concept: {
    slug: string;
    displayName: string;
    icon: string | null;
    confidenceBefore: number;
    confidenceAfter: number;
    confidenceDelta: number;
  };
  assessment: {
    understood: string[];
    struggled: string[];
    notes: string;
    confidenceDelta: number;
  };
}

export default function LearnResultsPage() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get('sessionId');
  const [data, setData] = useState<ResultsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setError('Missing session id. Please complete a learn session first.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`/api/learn/results/${sessionId}`);
        const payload = await res.json().catch(() => ({} as { error?: string }));
        if (!res.ok) {
          throw new Error(payload.error ?? 'Unable to load session results');
        }

        if (!cancelled) {
          const typed = payload as ResultsPayload;
          if (typed.concept.slug !== params.slug) {
            setError('This session does not match the selected concept.');
          } else {
            setData(typed);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load learn results');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [params.slug, sessionId]);

  const pctBefore = Math.round((data?.concept.confidenceBefore ?? 0.5) * 100);
  const pctAfter = Math.round((data?.concept.confidenceAfter ?? 0.5) * 100);
  const delta = pctAfter - pctBefore;

  if (loading) {
    return (
      <div className="flex-1 bg-[#0A0A0F] flex items-center justify-center px-4">
        <div className="flex items-center gap-3 text-zinc-300 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading your session results...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 bg-[#0A0A0F] flex items-center justify-center px-4">
        <div className="max-w-md w-full space-y-5 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-950/40 border border-red-500/25">
            <AlertCircle className="w-5 h-5 text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-white">Unable to load results</h1>
          <p className="text-sm text-zinc-400">{error ?? 'We could not find this learn session.'}</p>
          <div className="space-y-2">
            <button
              onClick={() => router.push('/learn')}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium"
            >
              Back to Learn
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="results-container" className="flex-1 bg-[#0A0A0F] flex items-center justify-center px-4 py-8">
      <div className="max-w-md w-full space-y-6">
        {/* Trophy header */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', damping: 15 }}
          className="text-center"
        >
          <div className="text-5xl mb-3">🎯</div>
          <h1 className="text-2xl font-bold text-white">Session Complete!</h1>
          <p className="text-zinc-400 text-sm mt-1">{data.concept.displayName}</p>
        </motion.div>

        {/* Confidence change card */}
        {data.concept && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-[#111118] border border-[#1E1E2E] rounded-2xl p-5"
          >
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Concept Progress</h2>
            <div className="flex items-center gap-4">
              <div className="flex-1 text-center">
                <div data-testid="confidence-before" className="text-2xl font-black text-zinc-400">{pctBefore}%</div>
                <div className="text-xs text-zinc-600 mt-0.5">Before</div>
              </div>
              <div className="flex flex-col items-center gap-1">
                {delta > 0 ? (
                  <TrendingUp size={20} className="text-emerald-400" />
                ) : delta < 0 ? (
                  <TrendingDown size={20} className="text-red-400" />
                ) : (
                  <Minus size={20} className="text-zinc-500" />
                )}
                <span data-testid="confidence-delta" className={`text-sm font-bold ${delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-zinc-500'}`}>
                  {delta > 0 ? `+${delta}%` : `${delta}%`}
                </span>
              </div>
              <div className="flex-1 text-center">
                <div data-testid="confidence-after" className="text-2xl font-black text-white">{pctAfter}%</div>
                <div className="text-xs text-zinc-600 mt-0.5">After</div>
              </div>
            </div>
            <p className="text-xs text-zinc-500 mt-4">
              Session delta from tutor assessment combined with your latest concept confidence.
            </p>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="bg-[#111118] border border-[#1E1E2E] rounded-2xl p-5 space-y-2"
        >
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Kai's Notes</h2>
          <p className="text-sm text-zinc-300 leading-relaxed">{data.assessment.notes || 'No additional notes for this session.'}</p>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="space-y-3"
        >
          <button
            onClick={() => router.push(`/learn/${params.slug}`)}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-colors"
          >
            Continue Learning <ArrowRight size={16} />
          </button>
          <button
            onClick={() => router.push('/learn')}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-sm transition-colors"
          >
            <Home size={14} /> Pick Another Concept
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full text-center text-xs text-zinc-500 hover:text-zinc-400 py-3 transition-colors"
          >
            Back to Dashboard
          </button>
        </motion.div>
      </div>
    </div>
  );
}