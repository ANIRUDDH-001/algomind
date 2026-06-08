/**
 * @codesage
 * @file      src/app/learn/diagnostic/page.tsx
 * @purpose   Client component for the diagnostic technical assessment that calibrates the user's knowledge profile.
 * @tech      Next.js, React, Framer Motion, Lucide React
 * @connects  Imports DIAGNOSTIC_QUESTIONS
 * @apis      POST /api/learn/diagnostic
 * @db        None
 * @state     React local state
 * @env       None
 * @issues    Removed console.logs
 * @audit     CODESAGE-v1
 */
// @ts-nocheck


'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, ChevronRight, ChevronLeft } from 'lucide-react';
import { DIAGNOSTIC_QUESTIONS, TOTAL_DIAGNOSTIC_QUESTIONS } from '@/lib/diagnostic/questions';

type AssessmentState = 'intro' | 'active' | 'submitting' | 'complete';

interface Answer {
  questionId: number;
  selectedValue: 1 | 2 | 3 | 4 | 5;
}

export default function DiagnosticPage() {
  const router = useRouter();
  const [state, setState] = useState<AssessmentState>('intro');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [selectedValue, setSelectedValue] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentQuestion = DIAGNOSTIC_QUESTIONS[currentQuestionIndex];
  const isAnswered = selectedValue !== null;
  const progressPercent = Math.round(((currentQuestionIndex + 1) / TOTAL_DIAGNOSTIC_QUESTIONS) * 100);

  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
      }
    };
  }, []);

  const handleSelectAnswer = (value: 1 | 2 | 3 | 4 | 5) => {
    if (isAdvancing) return;

    setSelectedValue(value);

    // Record answer immediately
    const updatedAnswers = answers.filter(a => a.questionId !== currentQuestion.id);
    const newAnswers = [...updatedAnswers, { questionId: currentQuestion.id, selectedValue: value }];
    setAnswers(newAnswers);

    // Auto-advance to next question (except last question)
    if (currentQuestionIndex < TOTAL_DIAGNOSTIC_QUESTIONS - 1) {
      setIsAdvancing(true);
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
      }
      autoAdvanceTimerRef.current = setTimeout(() => {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
        setSelectedValue(null);
        setIsAdvancing(false);
        autoAdvanceTimerRef.current = null;
      }, 800);
    }
  };

  const handleNext = () => {
    if (!isAnswered) return;

    // Record answer
    const updatedAnswers = answers.filter(a => a.questionId !== currentQuestion.id);
    setAnswers([...updatedAnswers, { questionId: currentQuestion.id, selectedValue: selectedValue! }]);

    // Move to next or finish
    if (currentQuestionIndex < TOTAL_DIAGNOSTIC_QUESTIONS - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedValue(null);
    } else {
      handleSubmit([...updatedAnswers, { questionId: currentQuestion.id, selectedValue: selectedValue! }]);
    }
  };

  const handleBack = () => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
      setIsAdvancing(false);
    }

    if (currentQuestionIndex > 0) {
      const prevQuestion = DIAGNOSTIC_QUESTIONS[currentQuestionIndex - 1];
      const prevAnswer = answers.find(a => a.questionId === prevQuestion.id);
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      setSelectedValue(prevAnswer?.selectedValue || null);
    }
  };

  const handleSubmit = async (finalAnswers: Answer[]) => {
    setState('submitting');

    try {
      const res = await fetch('/api/learn/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: finalAnswers,
          action: 'complete',
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.success === false) {
        const errorMsg = (data as { error?: string }).error || 'Failed to complete diagnostic';
        console.error('[Diagnostic] Submission failed:', errorMsg);
        throw new Error(errorMsg);
      }

      // Success: show completion screen
      setState('complete');
      localStorage.setItem('diagnosticCompletedAt', new Date().toISOString());

      // Wait for user to see success message
      await new Promise(r => setTimeout(r, 2000));

      // Navigate to learn
      try {
        router.replace('/learn');
      } catch (routerErr) {
        console.error('[Diagnostic] router.replace failed:', routerErr);
        window.location.href = '/learn';
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[Diagnostic] Submission error:', errMsg);

      // Fallback: redirect anyway after delay
      setTimeout(() => {
        console.warn('[Diagnostic] Fallback redirect to /learn');
        window.location.href = '/learn';
      }, 3000);

      setState('active');
    }
  };

  return (
    <main className="flex-1 bg-gradient-to-br from-[#0A0A0F] to-[#1A1A2E] flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="shrink-0 max-w-2xl mx-auto px-4 py-8 w-full">
        <h1 className="text-3xl font-bold text-white">Technical Assessment</h1>
        <p className="text-zinc-400 mt-2">Let's calibrate your knowledge level</p>
      </div>

      {/* Intro Screen */}
      <AnimatePresence>
        {state === 'intro' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-1 flex items-center justify-center px-4 pb-20"
          >
            <div className="max-w-md w-full bg-[#1A1A2E] border border-indigo-500/20 rounded-xl p-8 text-center">
              <h2 className="text-2xl font-bold text-white mb-4">Ready to begin?</h2>
              <p className="text-zinc-400 mb-6">
                Answer 8 quick questions to build your personalized learning profile. No right or wrong answers.
              </p>
              <p className="text-sm text-zinc-500 mb-8">
                ~3 minutes to complete
              </p>
              <button
                onClick={() => setState('active')}
                className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                Start Assessment
                <ChevronRight size={18} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Question Screen */}
      <AnimatePresence>
        {state === 'active' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex items-center justify-center px-4 pb-20"
          >
            <div className="w-full max-w-2xl">
              {/* Progress Bar */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-zinc-400">
                    Question {currentQuestionIndex + 1} of {TOTAL_DIAGNOSTIC_QUESTIONS} • {progressPercent}%
                  </span>
                  <div className="w-32 h-1 bg-zinc-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 transition-all"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Question Card */}
              <div aria-live="polite" aria-atomic="true" className="sr-only">
                {`Question ${currentQuestionIndex + 1}: ${currentQuestion.title}${currentQuestion.description ? `. ${currentQuestion.description}` : ''}`}
              </div>
              <motion.div
                key={currentQuestion.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-[#1A1A2E] border border-indigo-500/20 rounded-lg p-8 mb-8"
              >
                <h2 className="text-2xl font-bold text-white mb-3">{currentQuestion.title}</h2>
                {currentQuestion.description && (
                  <p className="text-zinc-300 mb-6">{currentQuestion.description}</p>
                )}
              </motion.div>

              {/* Answer Options */}
              <motion.div
                className="space-y-3 mb-8"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                {currentQuestion.answers.map((answer) => (
                  <button
                    key={answer.value}
                    onClick={() => handleSelectAnswer(answer.value)}
                    disabled={isAdvancing}
                    className={`w-full py-4 px-6 rounded-lg font-medium text-white transition-all text-center ${
                      selectedValue === answer.value
                        ? answer.color + ' ring-2 ring-offset-2 ring-offset-[#0A0A0F]'
                        : 'bg-zinc-800 hover:bg-zinc-700 border border-zinc-700'
                    } ${
                      isAdvancing ? 'opacity-60 cursor-not-allowed' : ''
                    } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0F]`}
                  >
                    <span className="inline-block mr-3 font-bold">
                      {answer.value}
                    </span>
                    {answer.label}
                  </button>
                ))}
              </motion.div>

              {/* Navigation */}
              <div className="flex gap-4">
                <button
                  onClick={handleBack}
                  disabled={currentQuestionIndex === 0}
                  className="flex-1 py-3 px-6 rounded-lg font-medium text-white bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  <ChevronLeft size={18} />
                  Back
                </button>
                {currentQuestionIndex === TOTAL_DIAGNOSTIC_QUESTIONS - 1 && (
                  <button
                    onClick={handleNext}
                    disabled={!isAnswered}
                    className="flex-1 py-3 px-6 rounded-lg font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    Finish
                    <ChevronRight size={18} />
                  </button>
                )}
              </div>

              {/* Answer indicator */}
              <p className="text-center text-sm text-zinc-500 mt-4">
                {isAnswered ? (currentQuestionIndex < TOTAL_DIAGNOSTIC_QUESTIONS - 1 ? '✓ Answer recorded - advancing in 0.8s...' : '✓ Answer selected - tap Finish to complete') : 'Select an answer to continue'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Submitting Screen */}
      <AnimatePresence>
        {state === 'submitting' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[#0A0A0F]/95 flex flex-col items-center justify-center gap-4 z-20"
          >
            <motion.div
              className="w-12 h-12 rounded-full border-2 border-indigo-500 border-t-transparent"
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
            />
            <p className="text-zinc-300 font-medium">Analyzing your responses...</p>
            <p className="text-zinc-500 text-sm">Building your profile</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Complete Screen */}
      <AnimatePresence>
        {state === 'complete' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[#0A0A0F]/95 flex flex-col items-center justify-center gap-4 z-20"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            >
              <CheckCircle size={64} className="text-emerald-500" />
            </motion.div>
            <p className="text-white font-bold text-2xl">Profile Ready!</p>
            <p className="text-zinc-400 text-sm">Taking you to your personalized learning path...</p>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}