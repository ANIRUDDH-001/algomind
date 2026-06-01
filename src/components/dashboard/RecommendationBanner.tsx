/**
 * @codesage
 * @component RecommendationBanner
 * @description Top-of-dashboard personalized action recommendation.
 *              Shows diagnostic prompt for new users, session recommendation for returning.
 * @phase Phase 2K
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Play, BookOpen, Target, ArrowRight } from 'lucide-react';

interface RecommendationData {
  nextConcept?: string | null;
  nextRecommendedConcept?: string | null;
  hasCompletedDiagnostic: boolean;
  weakest?: { slug: string; displayName: string; confidence: number }[];
  weakestConcepts?: { slug: string; displayName: string; confidence: number }[];
  sessionsRemaining: number | null;
}

export function RecommendationBanner() {
  const router = useRouter();
  const [data, setData] = useState<RecommendationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/knowledge/recommendations')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to fetch recommendations');
        return r.json();
      })
      .then((nextData) => {
        if (cancelled) return;
        setData(nextData);
        setFetchError(false);
      })
      .catch(() => {
        if (cancelled) return;
        setFetchError(true);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (fetchError) {
      console.warn('[RecommendationBanner] Failed to load recommendations');
    }
  }, [fetchError]);

  if (loading) {
    return (
      <div className="h-20 rounded-2xl animate-pulse" style={{ background: 'var(--surface-1)' }} />
    );
  }

  if (fetchError) {
    return null;
  }

  if (!data || dismissed) return null;

  const weakest = data.weakestConcepts ?? data.weakest ?? [];
  const nextConcept = data.nextRecommendedConcept ?? data.nextConcept ?? null;

  // New user: take diagnostic
  if (!data.hasCompletedDiagnostic) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-2xl bg-linear-to-br from-indigo-950/60 to-zinc-900/40 border border-indigo-500/20 p-5 overflow-hidden"
        >
          {/* Background decoration */}
          <div className="absolute right-0 top-0 w-48 h-48 bg-indigo-600/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />

          <div className="relative flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <Target size={18} className="text-indigo-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-white mb-1">Start your personalized journey</h3>
              <p className="text-xs text-zinc-400 mb-3">
                Take a quick 5-min diagnostic and Kai will build your custom DSA learning path.
              </p>
              <button
                onClick={() => router.push('/learn/diagnostic')}
                className="inline-flex items-center gap-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg transition-colors"
              >
                Take Diagnostic <ArrowRight size={12} />
              </button>
            </div>
            <button onClick={() => setDismissed(true)} className="text-zinc-600 hover:text-zinc-400 text-xs shrink-0 mt-0.5">✕</button>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Returning user: concept recommendation
  const nextConceptName = weakest[0]?.displayName ?? nextConcept;
  if (!nextConceptName) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-[#111118] border border-[#1E1E2E] p-4 flex items-center gap-4"
    >
      <div className="w-9 h-9 rounded-xl bg-indigo-950/60 border border-indigo-500/20 flex items-center justify-center shrink-0">
        <Sparkles size={16} className="text-indigo-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-zinc-400">Recommended for you</p>
        <p className="text-sm font-semibold text-white truncate">
          Learn: <span className="text-indigo-400">{nextConceptName}</span>
        </p>
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={() => router.push(`/learn/${nextConcept ?? weakest[0]?.slug}`)}
          className="flex items-center gap-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-lg transition-colors"
        >
          <BookOpen size={12} /> Learn
        </button>
        <button
          onClick={() => router.push(`/interview?concept=${nextConcept}`)}
          className="flex items-center gap-1.5 text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Play size={12} /> Practice
        </button>
      </div>
    </motion.div>
  );
}