/**
 * @component ConceptDetailPanel
 * @description Slide-in panel showing concept details + quick actions.
 *              Appears when a ConceptTile is clicked.
 * @phase Phase 2I
 * @a11y Phase 3E — role="dialog", aria-modal, focus trap, Escape close
 */
'use client';

import { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, BookOpen, TrendingUp, TrendingDown } from 'lucide-react';
import type { KGConceptSummary } from '@/lib/knowledge-graph';
import { useRouter } from 'next/navigation';

interface ConceptDetailPanelProps {
  concept: KGConceptSummary | null;
  onClose: () => void;
}

export function ConceptDetailPanel({ concept, onClose }: ConceptDetailPanelProps) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const firstFocusRef = useRef<HTMLButtonElement>(null);

  const handleStartLearn = () => {
    if (!concept) return;
    router.push(`/learn/${concept.slug}`);
  };

  const handlePracticeInterview = () => {
    if (!concept) return;
    router.push(`/interview?concept=${concept.slug}`);
  };

  // Move focus to close button when panel opens
  useEffect(() => {
    if (concept) {
      const timer = setTimeout(() => firstFocusRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [concept]);

  // Escape key closes panel
  useEffect(() => {
    if (!concept) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [concept, onClose]);

  // Focus trap: Tab cycles within panel
  const handleFocusTrap = useCallback((e: KeyboardEvent) => {
    if (e.key !== 'Tab' || !panelRef.current) return;
    const focusable = panelRef.current.querySelectorAll<HTMLElement>(
      'button, a, input, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  useEffect(() => {
    if (!concept) return;
    document.addEventListener('keydown', handleFocusTrap);
    return () => document.removeEventListener('keydown', handleFocusTrap);
  }, [concept, handleFocusTrap]);

  return (
    <AnimatePresence>
      {concept && (
        <motion.div
          ref={panelRef}
          data-testid="concept-detail-panel"
          role="dialog"
          aria-modal="true"
          aria-label={`${concept.displayName} concept details`}
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed right-0 top-0 h-full w-full sm:w-80 bg-[#111118] border-l border-[#1E1E2E] z-40 flex flex-col shadow-2xl"
        >
          <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-[#1E1E2E]">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-2xl flex-shrink-0">{concept.icon}</span>
              <div className="min-w-0">
                <h3 data-testid="concept-detail-panel-title" className="text-sm font-bold text-white truncate">{concept.displayName}</h3>
                <p className="text-xs text-zinc-500 capitalize">{concept.level}</p>
              </div>
            </div>
            <button
              ref={firstFocusRef}
              type="button"
              data-testid="concept-detail-close"
              onClick={onClose}
              aria-label="Close concept details panel"
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 flex-shrink-0"
            >
              <X size={14} />
            </button>
          </div>

          <div className="flex-1 px-4 sm:px-5 py-4 overflow-y-auto space-y-5">
            <div>
              <div className="flex justify-between text-xs text-zinc-400 mb-2">
                <span>Confidence</span>
                <span className="font-mono tabular-nums">
                  {concept.evidenceCount > 0 ? `${Math.round(concept.confidence * 100)}%` : 'Not assessed'}
                </span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <motion.div
                  className={[
                    'h-full rounded-full',
                    concept.level === 'strong' ? 'bg-emerald-500' : '',
                    concept.level === 'solid' ? 'bg-blue-500' : '',
                    concept.level === 'developing' ? 'bg-amber-500' : '',
                    concept.level === 'weak' ? 'bg-red-500' : '',
                    concept.level === 'unknown' ? 'bg-zinc-700' : '',
                  ].join(' ')}
                  initial={{ width: 0 }}
                  animate={{ width: concept.evidenceCount > 0 ? `${Math.round(concept.confidence * 100)}%` : '0%' }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </div>
            </div>

            {concept.evidenceCount > 0 && (
              <div className="bg-zinc-900/50 rounded-lg p-3">
                <p className="text-xs text-zinc-400">
                  Based on <span className="text-white font-medium">{concept.evidenceCount} session signal{concept.evidenceCount !== 1 ? 's' : ''}</span>
                </p>
                {concept.lastSessionType && (
                  <p className="text-xs text-zinc-500 mt-1">
                    Last updated via {concept.lastSessionType} session
                  </p>
                )}
              </div>
            )}

            {concept.evidenceCount === 0 && (
              <div className="bg-zinc-900/30 rounded-lg p-3 border border-zinc-700/20">
                <p className="text-xs text-zinc-400">
                  No data yet. Complete the diagnostic assessment or start a practice session to track your progress here.
                </p>
              </div>
            )}

            {concept.level === 'weak' && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-950/20 border border-red-500/20">
                <TrendingDown size={14} className="text-red-400 mt-0.5 shrink-0" />
                <p className="text-xs text-red-300">This is a key growth area. Prioritize learning this concept.</p>
              </div>
            )}

            {concept.level === 'strong' && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/20">
                <TrendingUp size={14} className="text-emerald-400 mt-0.5 shrink-0" />
                <p className="text-xs text-emerald-300">Strong foundation. Challenge yourself with harder problems.</p>
              </div>
            )}
          </div>

          <div className="px-4 sm:px-5 pb-6 pt-3 border-t border-[#1E1E2E] space-y-2">
            <button
              type="button"
              data-testid="detail-panel-learn-button"
              onClick={handleStartLearn}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
            >
              <BookOpen size={14} />
              Learn with Kai
            </button>
            <button
              type="button"
              onClick={handlePracticeInterview}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium transition-colors"
            >
              <Play size={14} />
              Practice Interview
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
