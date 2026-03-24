/**
 * @page /learn/diagnostic
 * @description MCQ-based technical diagnostic assessment
 * @phase Phase 5 - MCQ Implementation
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react';
import { DIAGNOSTIC_QUESTIONS, TOTAL_DIAGNOSTIC_QUESTIONS } from '@/lib/diagnostic/questions';

type AssessmentState = 'intro' | 'active' | 'submitting' | 'complete';

interface Answer {
  questionId: number;
  selectedValue: 1 | 2 | 3 | 4 | 5;
}

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

  const currentQuestion = DIAGNOSTIC_QUESTIONS[currentQuestionIndex];
  const isAnswered = selectedValue !== null;

  const handleSelectAnswer = (value: 1 | 2 | 3 | 4 | 5) => {
    setSelectedValue(value);
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
    if (currentQuestionIndex > 0) {
      const prevQuestion = DIAGNOSTIC_QUESTIONS[currentQuestionIndex - 1];
      const prevAnswer = answers.find(a => a.questionId === prevQuestion.id);
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      setSelectedValue(prevAnswer?.selectedValue || null);
    }
  };

  const handleSubmit = async (finalAnswers: Answer[]) => {
    setState('submitting');
    console.log('[Diagnostic] Submitting answers:', finalAnswers);

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
      console.log('[Diagnostic] API response:', { ok: res.ok, status: res.status, data });

      if (!res.ok || data.success === false) {
        const errorMsg = (data as { error?: string }).error || 'Failed to complete diagnostic';
        console.error('[Diagnostic] Submission failed:', errorMsg);
        throw new Error(errorMsg);
      }

      // Success: show completion screen
      setState('complete');
      localStorage.setItem('diagnosticCompletedAt', new Date().toISOString());
      console.log('[Diagnostic] Assessment complete, waiting 2s before redirect...');

      // Wait for user to see success message
      await new Promise(r => setTimeout(r, 2000));

      // Navigate to learn
      console.log('[Diagnostic] Redirecting to /learn');
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
    <main className="min-h-screen bg-gradient-to-br from-[#0A0A0F] to-[#1A1A2E] flex flex-col">
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
                    Question {currentQuestionIndex + 1} of {TOTAL_DIAGNOSTIC_QUESTIONS}
                  </span>
                  <div className="w-32 h-1 bg-zinc-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 transition-all"
                      style={{ width: `${((currentQuestionIndex + 1) / TOTAL_DIAGNOSTIC_QUESTIONS) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Question Card */}
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
                    className={`w-full py-4 px-6 rounded-lg font-medium text-white transition-all text-center ${
                      selectedValue === answer.value
                        ? answer.color + ' ring-2 ring-offset-2 ring-offset-[#0A0A0F]'
                        : 'bg-zinc-800 hover:bg-zinc-700 border border-zinc-700'
                    }`}
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
                <button
                  onClick={handleNext}
                  disabled={!isAnswered}
                  className="flex-1 py-3 px-6 rounded-lg font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {currentQuestionIndex === TOTAL_DIAGNOSTIC_QUESTIONS - 1 ? (
                    <>
                      Finish
                      <ChevronRight size={18} />
                    </>
                  ) : (
                    <>
                      Next
                      <ChevronRight size={18} />
                    </>
                  )}
                </button>
              </div>

              {/* Answer indicator */}
              <p className="text-center text-sm text-zinc-500 mt-4">
                {isAnswered ? '✓ Answer selected' : 'Select an answer to continue'}
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: finalMessages.map(m => ({ role: m.role, content: m.content })),
          sessionId,
          action: 'complete',
        }),
      });

      const data = await res.json().catch(() => ({} as { success?: boolean; error?: string; initializedWithFallback?: boolean }));

      console.log('[Diagnostic] API response:', { ok: res.ok, status: res.status, success: data.success, elapsedMs: Date.now() - startTime });

      if (!res.ok || data.success === false) {
        const errorMsg = (data as { error?: string }).error || `HTTP ${res.status}`;
        console.error('[Diagnostic] Completion failed:', errorMsg);
        throw new Error(errorMsg);
      }

      // Step 2: Show success message with 2s delay for user perception
      console.log('[Diagnostic] Completion successful, showing success screen...');
      setState('complete');
      localStorage.setItem('diagnosticCompletedAt', new Date().toISOString());
      console.log('[Diagnostic] localStorage timestamp set');
      
      // Delay before navigation (let user see success screen)
      await new Promise(r => setTimeout(r, 2000));
      console.log('[Diagnostic] 2s delay complete, initiating navigation...');

      // Step 3: Clear service worker caches to ensure fresh /learn load
      if (typeof window !== 'undefined') {
        try {
          if ('caches' in window) {
            const cacheNames = await caches.keys();
            console.log('[Diagnostic] Found caches:', cacheNames);
            for (const cacheName of cacheNames) {
              // Delete all caches to force fresh fetch (except keep static assets minimal)
              await caches.delete(cacheName);
            }
            console.log('[Diagnostic] Caches cleared');
          }
        } catch (cacheErr) {
          console.warn('[Diagnostic] Cache clearing failed (non-blocking):', cacheErr);
        }
      }

      // Step 4: Attempt navigation with multiple fallback strategies
      console.log('[Diagnostic] Attempting router.replace("/learn")...');
      
      try {
        // Primary method: Next.js router
        router.replace('/learn');
        console.log('[Diagnostic] router.replace() called successfully');
        
        // Safety: If router.replace didn't work after 3s, force navigation
        const safetyTimeoutId = window.setTimeout(() => {
          console.warn('[Diagnostic] Safety timeout: router.replace did not complete, forcing window.location');
          if (typeof window !== 'undefined' && window.location.pathname !== '/learn') {
            window.location.href = '/learn';
          }
        }, 3000);

        // Store for cleanup if needed
        if (typeof window !== 'undefined') {
          (window as unknown as { diagnosticSafetyTimeout?: unknown }).diagnosticSafetyTimeout = safetyTimeoutId;
        }
      } catch (routerErr) {
        console.error('[Diagnostic] router.replace threw error:', routerErr);
        console.log('[Diagnostic] Falling back to window.location.href');
        window.location.href = '/learn';
      }

      console.log('[Diagnostic] Completion flow finished', { elapsedMs: Date.now() - startTime });

    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[Diagnostic] Error in completion:', errMsg, err, { elapsedMs: Date.now() - startTime });
      
      // Retry logic: If first attempt failed due to network, retry once
      if (retryCount < 1) {
        console.log('[Diagnostic] Retrying (attempt 2/2)...');
        addMsg('assistant', `Let me try that again...`);
        await new Promise(r => setTimeout(r, 1000)); // Backoff
        await completeDiagnostic(finalMessages, retryCount + 1);
        return;
      }

      // Final failure: Show error and offer recovery options
      console.error('[Diagnostic] Final failure after retry');
      addMsg('assistant', `I encountered an issue: ${errMsg}. Let me redirect you to your learning path now...`);
      setState('active');
      setCanComplete(true);

      // Set up auto-redirect fallback after 5s (faster since we already retried)
      console.log('[Diagnostic] Setting 5s fallback timeout...');
      const timeoutId = window.setTimeout(() => {
        console.warn('[Diagnostic] Fallback timeout triggered - forcing redirect to /learn via window.location');
        window.location.href = '/learn';
      }, 5000);

      if (typeof window !== 'undefined') {
        (window as unknown as { diagnosticTimeoutId?: unknown }).diagnosticTimeoutId = timeoutId;
      }
    }
  };

  const userTurns = messages.filter((message) => message.role === 'user').length;
  const questionIndex = Math.min(totalQuestions, Math.max(1, userTurns + 1));
  const questionsLeft = Math.max(0, totalQuestions - userTurns);
  // Button is enabled when: all 8 questions answered OR explicit shouldComplete from API
  const canFinishDiagnostic = canComplete;

  const handleTextSend = async () => {
    const text = textInput.trim();
    if (!text || state !== 'active' || kaiThinking) return;
    setTextInput('');
    await sendToKai(text);
  };

  const toggleMic = () => {
    if (state !== 'active' || kaiThinking || audioState === 'speaking') return;

    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionCtorLike;
      webkitSpeechRecognition?: SpeechRecognitionCtorLike;
    };
    const SpeechRecognitionCtor =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      addMsg('assistant', 'Speech recognition is not available in your browser. Please use text input instead.');
      return;
    }

    if (audioState === 'listening') {
      recognitionRef.current?.stop();
      setAudioState('idle');
      setInterimVoiceText('');
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'en-IN';
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => {
      setAudioState('listening');
    };

    recognition.onresult = async (event: SpeechRecognitionEventLike) => {
      let finalText = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalText += event.results[i][0]?.transcript ?? '';
        } else {
          interim += event.results[i][0]?.transcript ?? '';
        }
      }
      setInterimVoiceText(interim);
      if (finalText.trim()) {
        setInterimVoiceText('');
        setAudioState('idle');
        recognition.stop();
        await sendToKai(finalText.trim());
      }
    };

    recognition.onerror = () => {
      setAudioState('idle');
      setInterimVoiceText('');
    };

    recognition.onend = () => {
      setAudioState('idle');
      setInterimVoiceText('');
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  return (
    <main className="min-h-screen bg-[#0A0A0F] flex flex-col">
      {/* Page Header */}
      <div className="shrink-0 max-w-5xl mx-auto px-4 py-8 w-full">
        <h1 className="text-2xl font-bold text-white">Diagnostic Assessment</h1>
        <p className="text-zinc-400 mt-1 text-sm">
          Let's calibrate your knowledge level. Answer honestly — no right or wrong answers.
        </p>
      </div>

      {/* Processing / Complete Overlay */}
      <AnimatePresence>
        {(state === 'processing' || state === 'complete') && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-[#0A0A0F]/95 flex flex-col items-center justify-center z-20 gap-4"
          >
            {state === 'processing' ? (
              <>
                <motion.div
                  className="w-12 h-12 rounded-full border-2 border-indigo-500 border-t-transparent"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                />
                <p className="text-zinc-300 font-medium">Calibrating your profile...</p>
                <p className="text-zinc-500 text-sm">Kai is analyzing your responses</p>
              </>
            ) : (
              <>
                <CheckCircle size={48} className="text-emerald-500" />
                <p className="text-white font-bold text-xl">Profile Ready!</p>
                <p className="text-zinc-400 text-sm">Taking you to your personalized learn mode...</p>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Message Transcript Area */}
      <div className="flex-1 min-h-0 overflow-y-auto max-w-2xl mx-auto px-4 pb-40 md:pb-24 w-full space-y-4">
        {messages.map(msg => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            data-testid={msg.role === 'assistant' ? 'message-assistant' : 'message-user'}
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                msg.role === 'assistant'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-700 text-zinc-300'
              }`}
            >
              {msg.role === 'assistant' ? 'K' : 'U'}
            </div>
            <div
              className={`max-w-xs sm:max-w-sm md:max-w-md rounded-2xl px-4 py-3 text-sm ${
                msg.role === 'assistant'
                  ? 'bg-zinc-800/50 border border-zinc-700/50 text-zinc-200 rounded-tl-none'
                  : 'bg-indigo-600/20 border border-indigo-500/30 text-zinc-200 rounded-tr-none'
              }`}
            >
              {msg.content}
            </div>
          </motion.div>
        ))}

        {/* Kai Thinking Indicator */}
        {kaiThinking && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs text-white font-bold shrink-0">
              K
            </div>
            <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-2xl rounded-tl-none px-4 py-3 flex gap-1">
              {[0, 0.2, 0.4].map((d, i) => (
                <motion.span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-zinc-500"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, delay: d, repeat: Infinity }}
                />
              ))}
            </div>
          </div>
        )}

        <div ref={transcriptEndRef} />
      </div>

      {/* Input Area */}
      <div className="shrink-0 sticky bottom-0 z-20 bg-[#0A0A0F]/95 backdrop-blur-sm border-t border-zinc-700/50 px-4 py-4 safe-area-bottom">
        <div className="max-w-2xl mx-auto space-y-3">
          {/* Status Badge */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {audioState === 'listening' && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0.5 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-emerald-400 flex items-center gap-1.5 text-xs font-medium"
                >
                  <motion.div
                    className="w-2 h-2 rounded-full bg-emerald-400"
                    animate={{ scale: [1, 1.5, 1] }}
                    transition={{ duration: 0.6, repeat: Infinity }}
                  />
                  Listening...
                </motion.div>
              )}
              {audioState === 'processing' && (
                <div className="text-amber-400 flex items-center gap-1.5 text-xs font-medium">
                  <Loader2 size={12} className="animate-spin" />
                  Processing...
                </div>
              )}
              {audioState === 'speaking' && (
                <div className="text-purple-400 flex items-center gap-1.5 text-xs font-medium">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                  >
                    <Volume2 size={12} />
                  </motion.div>
                  Kai is speaking...
                </div>
              )}
              {audioState === 'idle' && state === 'active' && (
                <span className="text-zinc-500 text-xs">Ready to respond</span>
              )}
            </div>
            <span data-testid="turn-counter" className="text-xs text-zinc-500" aria-live="polite">
              Question {questionIndex} of {totalQuestions} • {questionsLeft} left
            </span>
          </div>

          {/* Input Controls */}
          <div className="flex items-end gap-2">
            {/* Text Input */}
            <div
              className={`flex-1 bg-zinc-800/30 border rounded-xl overflow-hidden transition-colors ${
                state !== 'active' || kaiThinking
                  ? 'border-zinc-800/40 opacity-50'
                  : 'border-zinc-700/50 focus-within:border-indigo-500/40'
              }`}
            >
              <textarea
                data-testid="text-input"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleTextSend();
                  }
                }}
                placeholder={
                  state === 'active'
                    ? 'Type your answer or use voice'
                    : 'Diagnostic is preparing...'
                }
                rows={2}
                disabled={state !== 'active' || kaiThinking}
                className="w-full bg-transparent px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none"
                style={{ fontSize: '16px' }}
              />
            </div>

            {/* Mic Toggle */}
            <motion.button
              whileHover={{ scale: state === 'active' && !kaiThinking ? 1.05 : 1 }}
              whileTap={{ scale: state === 'active' && !kaiThinking ? 0.95 : 1 }}
              disabled={state !== 'active' || kaiThinking || audioState === 'speaking'}
              onClick={toggleMic}
              className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all relative ${
                audioState === 'listening'
                  ? 'bg-emerald-600 text-white'
                  : state !== 'active' || kaiThinking
                    ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
              aria-label={audioState === 'listening' ? 'Stop recording' : 'Start recording'}
            >
              {audioState === 'listening' && (
                <motion.div
                  className="absolute inset-0 rounded-lg bg-emerald-500/20"
                  animate={{ scale: [1, 1.3], opacity: [0.5, 0] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                />
              )}
              {audioState === 'listening' ? <Mic size={16} /> : <MicOff size={16} />}
            </motion.button>

            {/* Send Button */}
            <button
              data-testid="send-text-button"
              onClick={() => void handleTextSend()}
              disabled={!textInput.trim() || state !== 'active' || kaiThinking}
              className="shrink-0 w-10 h-10 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white transition-colors flex items-center justify-center"
              aria-label="Send message"
            >
              {kaiThinking ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>

            {/* Stop Speaking Button (shown only when AI is speaking) */}
            {audioState === 'speaking' && (
              <button
                onClick={() => setAudioState('idle')}
                className="shrink-0 w-10 h-10 rounded-lg bg-red-600 hover:bg-red-500 text-white transition-colors flex items-center justify-center"
                aria-label="Stop AI speech"
              >
                <Square size={16} />
              </button>
            )}

            {/* Finish Button */}
            <button
              data-testid="finish-diagnostic-button"
              onClick={() => void completeDiagnostic(messagesRef.current)}
              disabled={state !== 'active' || kaiThinking || !canFinishDiagnostic}
              className="shrink-0 px-4 h-10 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:cursor-not-allowed disabled:text-zinc-600 text-white font-medium text-sm transition-all flex items-center gap-2"
            >
              {state === 'processing' ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span className="hidden sm:inline">Init...</span>
                </>
              ) : (
                <span className="hidden sm:inline">Finish</span>
              )}
            </button>
          </div>

          {/* Voice Input Feedback */}
          {interimVoiceText && (
            <div className="text-xs text-zinc-500 italic">
              <span className="text-zinc-400">Hearing:</span> {interimVoiceText}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}