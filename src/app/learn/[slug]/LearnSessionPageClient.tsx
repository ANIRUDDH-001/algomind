'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, ArrowLeft, Volume2, Mic, MicOff, Send, 
  Code2, BookOpen, Lightbulb, Square, AlertCircle, Loader2 
} from 'lucide-react';
import { useLearnSession } from '@/hooks/useLearnSession';
import { useVAD } from '@/hooks/useVAD';
import { useSTT } from '@/hooks/useSTT';
import { useTTS } from '@/hooks/useTTS';
import { UpgradeModal } from '@/components/upgrade/UpgradeModal';

interface LearnSessionPageClientProps {
  slug: string;
}

const CONCEPT_HIGHLIGHTS = [
  { word: 'Two-Sum', definition: 'Find two numbers in an array that add up to a specific target sum.', color: 'indigo' },
  { word: 'Time Complexity', definition: 'How the execution time of an algorithm scales as the input size grows.', color: 'amber' },
  { word: 'brute force', definition: 'A straightforward approach that solves a problem by searching all possibilities.', color: 'blue' },
  { word: 'O(N^2)', definition: 'Quadratic time. Operations scale quadratically. Very slow for large inputs.', color: 'amber' },
  { word: 'O(N)', definition: 'Linear time. Operations scale 1:1 with input size. Highly optimal.', color: 'emerald' },
  { word: 'O(1)', definition: 'Constant time. Lookup takes the same time regardless of data structure size.', color: 'emerald' },
  { word: 'Hash Map', definition: 'A key-value lookup data structure that resolves keys in O(1) average time.', color: 'indigo' },
  { word: 'complement', definition: 'The value needed to reach target sum, calculated as target - current_value.', color: 'blue' },
  { word: 'Arrays & Strings', definition: 'Core sequential data structures in computer science.', color: 'indigo' },
  { word: 'space complexity', definition: 'The amount of memory an algorithm needs to run relative to input size.', color: 'amber' },
  { word: 'recursion', definition: 'A programming technique where a function calls itself.', color: 'indigo' },
  { word: 'pointer', definition: 'A reference to a memory address or index in an array.', color: 'blue' }
] as const;

export default function LearnSessionPageClient({ slug }: LearnSessionPageClientProps) {
  const router = useRouter();
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // UI state
  const [mounted, setMounted] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [userTranscript, setUserTranscript] = useState('');
  const [upgradeDismissed, setUpgradeDismissed] = useState(false);
  const [hoveredConcept, setHoveredConcept] = useState<string | null>(null);
  const [tooltipContent, setTooltipContent] = useState<string | null>(null);

  // VAD mode state
  const [vadMode, setVadMode] = useState<'onnx' | 'push-to-talk'>('push-to-talk');

  // VAD lifecycle ref
  const vadStarted = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Session hook
  const session = useLearnSession({
    conceptSlug: slug,
    onSpeakMessage: async (text: string) => {
      await speak(text);
    },
    onSessionEnd: (results) => {
      router.push(`/learn/${slug}/results?sessionId=${results.sessionId}`);
    },
  });

  // TTS
  const { speak, isSpeaking, stop: stopSpeaking } = useTTS({
    onSpeakStart: () => {
      // Gate mic while Kai is speaking to prevent echo
      if (vadStarted.current) {
        vadHook.stopListening();
      }
    },
    onSpeakEnd: () => {
      // Re-enable mic after Kai finishes
      if (vadStarted.current && session.state === 'active') {
        vadHook.startListening();
      }
    },
  });

  // STT
  const stt = useSTT({
    provider: 'whisper',
    language: 'en-IN',
    onTranscript: (text: string, isFinal: boolean) => {
      setUserTranscript(text);
      if (isFinal && text.trim()) {
        // Auto-send on final transcript from VAD
        if (vadMode === 'onnx') {
          if (session.state !== 'active' || session.kaiTyping) return;
          session.sendMessage(text);
          stt.resetTranscript();
          setUserTranscript('');
        }
      }
    },
  });

  // Voice send (from VAD transcript)
  const handleVoiceSend = useCallback((text: string) => {
    if (!text.trim() || session.state !== 'active' || session.kaiTyping) return;
    session.sendMessage(text);
    stt.resetTranscript();
    setUserTranscript('');
  }, [session.state, session.kaiTyping, session.sendMessage, stt.resetTranscript]);

  // VAD
  const vadHook = useVAD({
    enabled: true,
    onSpeechStart: () => {
      // Visual feedback: user started speaking
    },
    onSpeechEnd: async (audio: Float32Array) => {
      await stt.transcribeAudio(audio);
    },
    onError: (err) => {
      console.warn('[LearnVoice] VAD error:', err.message);
    },
    onFallback: () => {
      // VAD not available: stay in push-to-talk mode
      setVadMode('push-to-talk');
    },
  });

  // Update vadMode from hook
  useEffect(() => {
    setVadMode(vadHook.mode);
  }, [vadHook.mode]);

  // FIX: Correct dependency array: was [session] causing double-start
  useEffect(() => {
    if (session.state === 'idle') {
      session.startSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.state, session.startSession]);

  // Start VAD when session becomes active, and force-stop all audio/mic activity when it is not active
  useEffect(() => {
    if (session.state === 'active') {
      if (!vadStarted.current) {
        vadStarted.current = true;
        vadHook.startListening();
      }
    } else {
      if (vadStarted.current) {
        vadHook.stopListening(true);
        stt.stopListening();
        stopSpeaking();
        vadStarted.current = false;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.state]);

  // Stop VAD, STT, and TTS on unmount
  useEffect(() => {
    return () => {
      vadHook.stopListening(true);
      stt.stopListening();
      stopSpeaking();
      vadStarted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session.transcript]);

  // Escape shortcut
  useEffect(() => {
    const handler = () => {
      const shouldExit = window.confirm('Exit this learn session and return to the knowledge map?');
      if (shouldExit) router.push('/learn');
    };
    document.addEventListener('learn-escape-pressed', handler as EventListener);
    return () => document.removeEventListener('learn-escape-pressed', handler as EventListener);
  }, [router]);

  // Text input send
  const handleTextSend = useCallback(() => {
    const text = textInput.trim();
    if (!text || session.state !== 'active' || session.kaiTyping) return;
    session.sendMessage(text);
    setTextInput('');
  }, [textInput, session]);

  const isListening = vadHook.isListening || stt.isListening;

  // Manual Mic toggle to start/stop listening state explicitly
  const handleMicToggle = useCallback(() => {
    if (session.state !== 'active' || session.kaiTyping) return;

    if (isListening) {
      // Force stop all mic hardware & VAD
      vadHook.stopListening(true);
      stt.stopListening();
      vadStarted.current = false; // Turn off auto VAD restart logic

      // Retrieve any captured text in push-to-talk mode
      const captured = stt.transcript + stt.interimTranscript;
      if (captured.trim()) {
        handleVoiceSend(captured.trim());
      }
    } else {
      // Reset and trigger recording manually
      stt.resetTranscript();
      setUserTranscript('');
      
      if (vadMode === 'onnx') {
        vadStarted.current = true;
        vadHook.startListening();
      } else {
        stt.startListening();
      }
    }
  }, [isListening, vadMode, vadHook, stt, session.state, session.kaiTyping, handleVoiceSend]);

  const showUpgrade = session.error === 'LIMIT_REACHED' && !upgradeDismissed;

  // Dynamic Keyword Highlighter
  const renderContentWithHighlights = (content: string) => {
    let text = content;
    
    // Extract any python/js code blocks first to render them cleanly outside text highlights
    const codeRegex = /```(python|javascript|js)?\n([\s\S]+?)\n```/;
    const codeMatch = text.match(codeRegex);
    let cleanText = text;
    let extractedCode: string | null = null;
    
    if (codeMatch) {
      cleanText = text.replace(codeRegex, '').trim();
      extractedCode = codeMatch[2];
    }

    const words = CONCEPT_HIGHLIGHTS.map(h => h.word);
    const regex = new RegExp(`(${words.map(w => w.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')).join('|')})`, 'g');
    const parts = cleanText.split(regex);

    const getHighlightClass = (color: string) => {
      switch (color) {
        case 'indigo': return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/20';
        case 'emerald': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20';
        case 'amber': return 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20';
        default: return 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20';
      }
    };

    const parsedText = parts.map((part, i) => {
      const highlight = CONCEPT_HIGHLIGHTS.find(h => h.word.toLowerCase() === part.toLowerCase());
      if (highlight) {
        return (
          <span
            key={i}
            onMouseEnter={() => {
              setHoveredConcept(highlight.word);
              setTooltipContent(highlight.definition);
            }}
            onMouseLeave={() => {
              setHoveredConcept(null);
              setTooltipContent(null);
            }}
            className={`cursor-help px-2 py-0.5 rounded-md border text-xs font-semibold inline-block transition-all ${getHighlightClass(highlight.color)}`}
          >
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });

    return { parsedText, extractedCode };
  };

  if (!mounted) return null;

  return (
    <div 
      className="h-full bg-[#07070B] flex flex-col relative overflow-hidden noise-overlay"
      style={{
        backgroundImage: `
          radial-gradient(at 15% 15%, rgba(99, 102, 241, 0.07) 0px, transparent 35%),
          radial-gradient(at 85% 85%, rgba(139, 92, 246, 0.07) 0px, transparent 35%),
          linear-gradient(rgba(255, 255, 255, 0.008) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.008) 1px, transparent 1px)
        `,
        backgroundSize: '100% 100%, 100% 100%, 36px 36px, 36px 36px'
      }}
    >
      {/* Header */}
      <header className="flex-shrink-0 bg-[#07070B]/85 backdrop-blur-md border-b border-[#1E1E2E]/45 px-6 py-4 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <button
            data-testid="back-button"
            onClick={() => router.push('/learn')}
            className="p-2 rounded-lg bg-zinc-900/50 border border-white/5 hover:border-zinc-700 text-zinc-400 hover:text-white transition-all"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Link href="/learn" className="hover:text-zinc-300 transition-colors">Learn</Link>
              <span>/</span>
              <span className="text-zinc-300 capitalize truncate">{slug.replace(/-/g, ' ')}</span>
            </div>
            <h1 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles size={16} className="text-amber-400 shrink-0" />
              Socratic Interactive Canvas
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {session.state === 'active' && (
            <div className="flex items-center gap-2.5 bg-zinc-900/40 border border-white/5 px-3.5 py-1.5 rounded-full">
              <span className="text-xs font-semibold text-zinc-400">
                Exchange {Math.floor(session.transcript.length / 2)} / 20
              </span>
              <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all" 
                  style={{ width: `${Math.min(100, (session.transcript.length / 40) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {session.state === 'active' && (
            <button
              data-testid="finish-button"
              onClick={session.endSession}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-950/20 border border-transparent hover:border-red-500/20 transition-all font-semibold"
            >
              <Square size={12} />
              End Session
            </button>
          )}
        </div>
      </header>

      {/* Main Centered Content Feed (Clean centered S-curve layout) */}
      <main className="flex-1 overflow-y-auto px-6 py-8 space-y-6 z-10">
        <div className="max-w-2xl mx-auto w-full space-y-8 pb-24">
          
          {session.state === 'starting' && (
            <div className="flex items-center justify-center py-12 gap-3 text-zinc-500">
              <Loader2 size={16} className="animate-spin text-indigo-400" />
              <span className="text-sm font-semibold">Kai is preparing your personalized canvas...</span>
            </div>
          )}

          <AnimatePresence initial={false}>
            {session.transcript.map((entry) => {
              const isKai = entry.role === 'assistant';
              const { parsedText, extractedCode } = renderContentWithHighlights(entry.content);

              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 w-full ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {/* Kai Avatar on Left */}
                  {isKai && (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 relative bg-indigo-950 border border-indigo-500/20 text-indigo-400 shadow-md mt-1">
                      K
                      {isSpeaking && (
                        <span className="absolute inset-0 rounded-full border border-indigo-400 animate-ping opacity-60" />
                      )}
                    </div>
                  )}

                  {/* Socratic Thought Card or Standard Bubble with 80% limit inside centered column */}
                  <div className={`space-y-3 max-w-[82%] ${entry.role === 'user' ? 'text-right' : ''}`}>
                    <div
                      className={`rounded-2xl px-5 py-4 text-sm leading-relaxed border transition-all text-left ${
                        isKai
                          ? 'bg-[#12121A] border-[#1E1E2E]/20 text-zinc-200 shadow-sm relative overflow-hidden'
                          : 'bg-indigo-600/10 border-indigo-500/15 text-zinc-200 ml-auto'
                      }`}
                    >
                      {isKai && (
                        <div className="flex items-center gap-1.5 text-xs text-amber-400 font-semibold mb-2">
                          <Lightbulb size={12} className="shrink-0" />
                          Socratic Guidance
                        </div>
                      )}
                      
                      <p>{parsedText}</p>

                      {isKai && (
                        <div className="mt-3 flex items-center gap-2 border-t border-white/5 pt-2.5">
                          <button 
                            onClick={() => speak(entry.content)}
                            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors bg-indigo-950/40 px-2.5 py-1 rounded-md border border-indigo-500/10"
                            title="Replay speech"
                          >
                            <Volume2 size={12} />
                            Listen
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Code Card Rendering (if code is detected) */}
                    {extractedCode && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.99 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="rounded-xl overflow-hidden border border-white/5 shadow-2xl bg-[#0E0E14] font-mono text-xs text-zinc-300 shadow-black/40 text-left"
                      >
                        <div className="bg-zinc-950/60 px-4 py-2 border-b border-white/5 flex items-center justify-between">
                          <span className="text-zinc-500 flex items-center gap-1.5">
                            <Code2 size={12} /> Python Optimal Solution
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                            O(N) Sweep
                          </span>
                        </div>
                        <div className="p-4 overflow-x-auto leading-relaxed relative">
                          {extractedCode.split('\n').map((line, idx) => {
                            const isCritical = line.includes('>>>') || line.includes('constant O(1)');
                            const cleanLine = line.replace('# >>> ', '');
                            return (
                              <div 
                                key={idx} 
                                className={`flex px-2 py-0.5 rounded ${
                                  isCritical 
                                    ? 'bg-emerald-500/10 border-l-2 border-emerald-500 text-emerald-300 font-semibold my-1' 
                                    : ''
                                }`}
                              >
                                <span className="w-6 text-zinc-600 select-none text-right mr-4">{idx + 1}</span>
                                <span>{cleanLine}</span>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* User Avatar on Right */}
                  {!isKai && (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-zinc-800 border border-zinc-700/50 text-zinc-300 mt-1">
                      U
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>

          {session.kaiTyping && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-950 border border-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold shrink-0">K</div>
              <div className="bg-[#12121A] border border-[#1E1E2E]/20 rounded-2xl rounded-tl-sm px-4 py-3">
                <motion.div className="flex gap-1.5">
                  {[0, 0.2, 0.4].map((delay, i) => (
                    <motion.span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-zinc-500"
                      animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                      transition={{ duration: 1, delay, repeat: Infinity }}
                    />
                  ))}
                </motion.div>
              </div>
            </motion.div>
          )}

          {session.error && session.error !== 'LIMIT_REACHED' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl flex items-start gap-3 bg-red-950/20 border border-red-500/10"
            >
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-bold text-red-300 mb-1">Connection lost</p>
                <p className="text-xs text-zinc-400">
                  Kai couldn&apos;t respond. Your session progress is saved.
                </p>
              </div>
              <button
                onClick={() => {
                  if (session.retryLastMessage) {
                    void session.retryLastMessage();
                    return;
                  }
                  window.location.reload();
                }}
                className="shrink-0 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors px-3 py-1.5 rounded-lg bg-zinc-900 border border-white/5"
              >
                Retry
              </button>
            </motion.div>
          )}
          <div ref={transcriptEndRef} />
        </div>
      </main>

      {/* Floating Concept Tooltip Box */}
      <AnimatePresence>
        {tooltipContent && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 max-w-sm w-full bg-[#161622] border border-white/10 rounded-xl p-4 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex gap-2 items-start">
              <BookOpen size={16} className="text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-white mb-1">Concept: {hoveredConcept}</h4>
                <p className="text-xs text-zinc-400 leading-normal">{tooltipContent}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sticky Bottom Footer Input Bar (Integrated Text Box + Mic Button) */}
      <footer className="flex-shrink-0 bg-[#07070B]/95 backdrop-blur-md border-t border-[#1E1E2E]/40 px-6 py-4 safe-area-bottom z-30">
        <div className="max-w-2xl mx-auto flex items-center gap-3 w-full">
          
          <div className="flex-1 bg-[#12121A] border border-white/5 rounded-2xl flex items-center px-4 py-2 focus-within:border-indigo-500/30 transition-all shadow-inner">
            <input
              data-testid="text-input"
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && textInput.trim()) {
                  handleTextSend();
                }
              }}
              placeholder={isListening ? "Listening... speak now" : "Type your DSA answer here, or tap the mic..."}
              className="flex-1 bg-transparent border-0 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-0 py-1"
              disabled={session.state !== 'active' || session.kaiTyping || isListening}
            />

            {/* Live voice visualizer in input bar */}
            {isListening && (
              <div className="flex gap-0.5 items-center justify-center shrink-0 mr-3">
                {[0.3, 0.6, 0.4, 0.8, 0.3].map((height, i) => (
                  <motion.div
                    key={i}
                    className="w-0.5 bg-emerald-400 rounded-full"
                    animate={{ height: ['4px', `${12 * height}px`, '4px'] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }}
                  />
                ))}
              </div>
            )}

            {/* Integrated Mic Button on the Right */}
            <button
              data-testid="send-button"
              onClick={handleMicToggle}
              disabled={session.state !== 'active' || session.kaiTyping}
              className={`p-2 rounded-xl transition-all shrink-0 mr-2 relative ${
                isListening
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-white/5'
              }`}
              title={isListening ? "Stop listening" : "Start speaking"}
            >
              {isListening && (
                <motion.span
                  className="absolute inset-0 bg-emerald-500/30 rounded-xl"
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                />
              )}
              {isListening ? <Mic size={14} className="animate-pulse" /> : <MicOff size={14} />}
            </button>

            {/* Send Message Button */}
            <button
              data-testid="send-text-button"
              onClick={handleTextSend}
              disabled={!textInput.trim() || session.state !== 'active' || session.kaiTyping || isListening}
              className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-900 disabled:text-zinc-600 text-white transition-colors shrink-0"
              title="Send message"
            >
              <Send size={14} />
            </button>

          </div>

        </div>
      </footer>

      <UpgradeModal
        open={showUpgrade}
        onOpenChange={(open) => {
          if (!open) setUpgradeDismissed(true);
        }}
        payload={{ reason: 'limit_reached' }}
      />
    </div>
  );
}