/**
 * @codesage
 * @file      src/components/learn/ConceptPicker.tsx
 * @purpose   Grid of concept cards for selecting what to learn, handling diagnostic prompt.
 * @tech      React, Framer Motion, TailwindCSS, Next.js App Router
 * @connects  framer-motion, lucide-react, next/navigation, KGConceptSummary
 * @apis      None
 * @db        None
 * @state     Local Component State
 * @env       None
 * @issues    No issues found
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

/**
 * @component ConceptPicker
 * @description Grid of concept cards for selecting what to learn.
 *              Shows diagnostic prompt for new users.
 * @phase Phase 2J
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Target, Zap, Brain, BookOpen, Code2, Search, Database, Activity, BarChart3, Clock, LayoutDashboard } from 'lucide-react';
import type { KGConceptSummary } from '@/lib/knowledge-graph';
import { getConceptIconKey } from '@/lib/knowledge-graph/concept-icon-keys';

interface StudentContextProps {
  hasCompletedDiagnostic: boolean;
  nextRecommendedConcept: string | null;
  weakestConcepts: { slug: string; displayName: string; confidence: number }[];
  subscription: { sessionsUsedThisWeek: number; sessionsRemaining: number | null; weeklyLimit: number | null };
}

interface ConceptPickerProps {
  concepts: KGConceptSummary[];
  studentContext: StudentContextProps;
}

const LEVEL_BADGE: Record<string, string> = {
  unknown: 'bg-zinc-800 text-zinc-400',
  weak: 'bg-red-950/60 text-red-400',
  developing: 'bg-amber-950/60 text-amber-400',
  solid: 'bg-blue-950/60 text-blue-400',
  strong: 'bg-emerald-950/60 text-emerald-400',
};

const LEVEL_LABEL: Record<string, string> = {
  unknown: 'Not started',
  weak: 'Needs work',
  developing: 'In progress',
  solid: 'Good',
  strong: 'Mastered',
};

export function ConceptPicker({ concepts, studentContext }: ConceptPickerProps) {
  const router = useRouter();
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);
  const [showSkipConfirmation, setShowSkipConfirmation] = useState(false);
  const { hasCompletedDiagnostic, nextRecommendedConcept, weakestConcepts, subscription } = studentContext;

  const ICON_BY_KEY = {
    code: Code2,
    search: Search,
    brain: Brain,
    database: Database,
    activity: Activity,
    chart: BarChart3,
    book: BookOpen,
    target: Target,
    clock: Clock,
    layout: LayoutDashboard,
  } as const;

  const showLimitReachedModal = () => {
    window.dispatchEvent(new CustomEvent('algomind:upgrade-modal', {
      detail: {
        source: 'learn-concept-picker',
        sessionsUsed: subscription.sessionsUsedThisWeek,
        limit: subscription.weeklyLimit ?? undefined,
      },
    }));
  };

  // Show diagnostic prompt for new users
  if (!hasCompletedDiagnostic) {
    if (showSkipConfirmation) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-lg mx-auto text-center"
        >
          <div className="bg-[#111118] border border-[#1E1E2E] rounded-2xl p-8 space-y-6">
            <div className="w-16 h-16 rounded-full bg-amber-950/60 border border-amber-500/30 flex items-center justify-center mx-auto">
              <Sparkles size={28} className="text-amber-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Skip Baseline Diagnostic?</h2>
              <p className="text-zinc-400 text-sm leading-relaxed">
                By skipping the baseline assessment, Kai will start teaching you <strong>Arrays & Strings</strong> using a default baseline. We highly recommend the 5-minute diagnostic to set a personalized baseline first.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push('/learn/arrays-strings')}
                className="w-full py-3.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
              >
                Yes, Start Arrays & Strings <ArrowRight size={16} />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowSkipConfirmation(false)}
                className="w-full py-3.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-sm flex items-center justify-center gap-2 transition-colors border border-[#1E1E2E]"
              >
                No, Go Back to Diagnostic (Recommended)
              </motion.button>
            </div>
          </div>
        </motion.div>
      );
    }

    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg mx-auto text-center"
      >
        <div className="bg-[#111118] border border-[#1E1E2E] rounded-2xl p-8 space-y-6">
          <div className="w-16 h-16 rounded-full bg-indigo-950/60 border border-indigo-500/30 flex items-center justify-center mx-auto">
            <Target size={28} className="text-indigo-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white mb-2">Set Your Baseline First</h2>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Kai will ask you 10-12 questions across key DSA topics. Takes about 5 minutes.
              Your answers calibrate everything — concept recommendations, difficulty, and Kai's teaching style.
            </p>
          </div>
          <div className="bg-zinc-900/50 rounded-xl p-4 text-left space-y-2">
            {['Quick 5-min assessment', 'Covers 8 core DSA clusters', 'Sets your personalized learning path', 'Voice-first — just speak naturally'].map(f => (
              <div key={f} className="flex items-center gap-2 text-sm text-zinc-300">
                <span className="text-emerald-500 text-xs">✓</span>
                {f}
              </div>
            ))}
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => router.push('/learn/diagnostic')}
            className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
          >
            Start Diagnostic <ArrowRight size={16} />
          </motion.button>
          <button
            onClick={() => setShowSkipConfirmation(true)}
            className="text-xs text-zinc-500 hover:text-zinc-400 transition-colors"
          >
            Skip and start with Arrays & Strings
          </button>
        </div>
      </motion.div>
    );
  }

  // Session limit warning
  const isLimitReached = subscription.sessionsRemaining === 0;

  return (
    <div className="space-y-6">
      {/* Recommendation banner */}
      {nextRecommendedConcept && !isLimitReached && (
        <motion.div
          data-testid="recommendation-banner"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/20"
        >
          <Sparkles size={16} className="text-indigo-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-zinc-300">
              Kai recommends starting with{' '}
              <span className="text-indigo-400 font-medium">
                {concepts.find(c => c.slug === nextRecommendedConcept)?.displayName ?? nextRecommendedConcept}
              </span>
            </p>
          </div>
          <button
            data-testid="recommendation-start-button"
            onClick={() => router.push(`/learn/${nextRecommendedConcept}`)}
            className="shrink-0 text-xs font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
          >
            Start <ArrowRight size={12} />
          </button>
        </motion.div>
      )}

      {/* Session limit warning */}
      {isLimitReached && (
        <div data-testid="limit-warning" className="p-4 rounded-xl bg-red-950/30 border border-red-500/20 flex items-center gap-3">
          <Zap size={16} className="text-red-400 shrink-0" />
          <p className="text-sm text-zinc-300">
            Weekly limit reached: {subscription.sessionsUsedThisWeek}/{subscription.weeklyLimit} sessions used.{" "}
            <button
              data-testid="upgrade-trigger"
              onClick={showLimitReachedModal}
              className="text-indigo-400 hover:text-indigo-300"
            >
              Upgrade for unlimited access
            </button>
          </p>
        </div>
      )}

      {/* Concept grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {concepts.map((concept, index) => {
          const isRecommended = concept.slug === nextRecommendedConcept;
          //  -- automated unused local suppression
          const isWeak = weakestConcepts.some(w => w.slug === concept.slug);

          return (
            <motion.button
              data-testid={`concept-card-${concept.slug}`}
              key={concept.slug}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.025 }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => {
                if (isLimitReached) {
                  showLimitReachedModal();
                  return;
                }
                router.push(`/learn/${concept.slug}`);
              }}
              onMouseEnter={() => setHoveredSlug(concept.slug)}
              onMouseLeave={() => setHoveredSlug(null)}
              className={`
                relative text-left p-4 rounded-xl border transition-all
                cursor-pointer
                ${isRecommended
                  ? 'bg-indigo-950/30 border-indigo-500/40 hover:border-indigo-400/60'
                  : 'bg-[#111118] border-[#1E1E2E] hover:border-zinc-600/50'
                }
                ${hoveredSlug === concept.slug ? 'shadow-lg shadow-black/20' : ''}
              `}
            >
              {isRecommended && (
                <span className="absolute top-2 right-2 text-xs font-medium text-indigo-400 bg-indigo-950/60 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                  Recommended
                </span>
              )}

              <div className="flex items-start gap-3 mb-3">
                {(() => {
                  const Icon = ICON_BY_KEY[getConceptIconKey(concept.slug)];
                  return <Icon size={18} className="text-zinc-300 mt-0.5" aria-hidden="true" />;
                })()}
                <div>
                  <h3 className="text-sm font-semibold text-white leading-tight">{concept.displayName}</h3>
                  <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${LEVEL_BADGE[concept.level]}`}>
                    {LEVEL_LABEL[concept.level]}
                  </span>
                </div>
              </div>

              {/* Confidence bar */}
              {concept.evidenceCount > 0 && (
                <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      concept.level === 'strong' ? 'bg-emerald-500' :
                      concept.level === 'solid' ? 'bg-blue-500' :
                      concept.level === 'developing' ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.round(concept.confidence * 100)}%` }}
                  />
                </div>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}