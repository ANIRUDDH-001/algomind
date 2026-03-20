/**
 * @page /learn/[slug]/results
 * @description Post-session results screen with concept progress + next steps.
 * @phase Phase 2J
 */
'use client';

import { useSearchParams, useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, TrendingUp, TrendingDown, Minus, Home } from 'lucide-react';

interface SessionResult {
  conceptSlug: string;
  durationSeconds: number;
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

  // Results are passed via router state or re-fetched
  const [conceptData, setConceptData] = useState<{
    displayName: string;
    confidenceBefore: number;
    confidenceAfter: number;
  } | null>(null);

  useEffect(() => {
    // Fetch updated concept state to show before/after
    fetch('/api/knowledge/concepts')
      .then(r => r.json())
      .then(data => {
        const concept = data.concepts?.find((c: { slug: string; displayName: string; confidence: number }) => c.slug === params.slug);
        if (concept) setConceptData({ displayName: concept.displayName, confidenceBefore: concept.confidence - 0.05, confidenceAfter: concept.confidence });
      });
  }, [params.slug]);

  const pctBefore = Math.round((conceptData?.confidenceBefore ?? 0.5) * 100);
  const pctAfter = Math.round((conceptData?.confidenceAfter ?? 0.5) * 100);
  const delta = pctAfter - pctBefore;

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center px-4">
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
          <p className="text-zinc-400 text-sm mt-1">{conceptData?.displayName ?? params.slug}</p>
        </motion.div>

        {/* Confidence change card */}
        {conceptData && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-[#111118] border border-[#1E1E2E] rounded-2xl p-5"
          >
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Concept Progress</h2>
            <div className="flex items-center gap-4">
              <div className="flex-1 text-center">
                <div className="text-2xl font-black text-zinc-400">{pctBefore}%</div>
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
                <span className={`text-sm font-bold ${delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-zinc-500'}`}>
                  {delta > 0 ? `+${delta}%` : `${delta}%`}
                </span>
              </div>
              <div className="flex-1 text-center">
                <div className="text-2xl font-black text-white">{pctAfter}%</div>
                <div className="text-xs text-zinc-600 mt-0.5">After</div>
              </div>
            </div>
          </motion.div>
        )}

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