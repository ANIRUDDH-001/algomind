// @ts-nocheck
// 
'use client';

/**
 * @codesage
 * @file      src/app/learn/[slug]/LearnSessionPageClient.tsx
 * @purpose   Main client interface for interactive Socratic learning sessions with voice and text chat.
 * @description Manages the complex UI state for the learning workspace, including transcription, voice input/output, interactive chat logs with code highlighting, and problem metadata display.
 * @tech      Next.js, React, Framer Motion, Lucide React
 * @connects  Imports hooks useLearnSession, useUnifiedVoice, components UpgradeModal, ResizablePanelGroup
 * @apis      None
 * @db        None
 * @state     React local state, custom hooks state
 * @env       None
 * @issues    Removed unused icons (Layers, Play, Award) from lucide-react import
 * @audit     CODESAGE-v1
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, BookOpen, Code2, Send, Mic, Cpu, Clock,
  ChevronDown, ChevronUp, Lightbulb, AlertCircle, Loader2, Volume2, MicOff, MessageSquare
} from 'lucide-react';

import { useLearnSession } from '@/hooks/useLearnSession';
import { useUnifiedVoice } from '@/hooks/useUnifiedVoice';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';
import { cn } from '@/lib/utils';
import { UpgradeModal } from '@/components/upgrade/UpgradeModal';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { TOPIC_DATA } from './topic-data';

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
  const [upgradeDismissed, setUpgradeDismissed] = useState(false);
  const [hoveredConcept, setHoveredConcept] = useState<string | null>(null);
  const [tooltipContent, setTooltipContent] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'cognitive'>('details');
  const [codeExpanded, setCodeExpanded] = useState(true);

  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [mobileTab, setMobileTab] = useState<'problem' | 'chat'>('chat');
  const { handlers: swipeHandlers } = useSwipeNavigation({
      tabs: ['problem', 'chat'],
      activeTab: mobileTab,
      onTabChange: (tab) => setMobileTab(tab as 'problem' | 'chat'),
  });

  // Double-mount protection for React StrictMode
  const hasStartedRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Voice Hook
  const voice = useUnifiedVoice({
    sttProvider: 'whisper',
    language: 'en-IN',
    enabled: true,
    onTranscript: (text, isFinal) => {
        if (isFinal && text.trim() && voice.vadMode === 'onnx') {
            if (session.state !== 'active' || session.kaiTyping) return;
            session.sendMessage(text);
            voice.resetTranscript();
        }
    }
  });

  // Session hook
  const session = useLearnSession({
    conceptSlug: slug,
    onSpeakMessage: async (text: string) => {
      await voice.speak(text);
    },
    onSessionEnd: (results) => {
      router.push(`/learn/${slug}/results?sessionId=${results.sessionId}`);
    },
  });

  // Fix StrictMode double-start bug
  useEffect(() => {
    if (session.state === 'idle' && !hasStartedRef.current) {
      hasStartedRef.current = true;
      session.startSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.state]);

  // Sync Voice State
  useEffect(() => {
      if (session.state === 'active' && !session.kaiTyping) {
          voice.start();
      } else {
          voice.stop(true);
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.state, session.kaiTyping]);

  useEffect(() => {
      return () => {
          voice.stop(true);
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
  const handleTextSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = textInput.trim();
    if (!text || session.state !== 'active' || session.kaiTyping) return;
    session.sendMessage(text);
    setTextInput('');
  };

  const isListening = voice.state === 'listening';

  const handleMicToggle = useCallback(() => {
    if (session.state !== 'active' || session.kaiTyping) return;

    if (isListening) {
      voice.stop(true);
      const captured = voice.transcript + voice.interimTranscript;
      if (captured.trim()) {
        session.sendMessage(captured.trim());
        voice.resetTranscript();
      }
    } else {
      voice.start();
    }
  }, [isListening, voice, session]);

  const showUpgrade = session.error === 'LIMIT_REACHED' && !upgradeDismissed;

  const renderContentWithHighlights = (content: string) => {
    const text = content;
    
    // Extract any python/js code blocks first
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

  const renderProblemArea = () => (
                  <section className="h-full flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-1 relative">
                    
                    {/* Metadata Selector Tabs */}
                    <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-2.5 flex gap-2 shrink-0">
                        <button
                            onClick={() => setActiveTab('details')}
                            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                                activeTab === 'details'
                                ? 'bg-zinc-900 text-white border border-zinc-800'
                                : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                        >
                            Problem Info
                        </button>
                        <button
                            onClick={() => setActiveTab('cognitive')}
                            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                                activeTab === 'cognitive'
                                ? 'bg-zinc-900 text-white border border-zinc-800'
                                : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                        >
                            Cognitive Focus
                        </button>
                    </div>

                    {activeTab === 'details' ? (
                        <div className="bg-zinc-950/60 border border-zinc-900 rounded-2xl p-5 space-y-4 shrink-0">
                            <div className="flex justify-between items-start">
                                <span className="px-2 py-1 rounded bg-indigo-500/10 text-indigo-400 text-[10px] font-bold uppercase">Concept Focus</span>
                                <span className="text-[11px] text-zinc-500 font-mono">ID: {slug}</span>
                            </div>

                            <div>
                                <h3 className="text-base font-bold text-white mb-1.5 capitalize">{slug.replace(/-/g, ' ')}</h3>
                                <p className="text-xs text-zinc-400 leading-relaxed">
                                    {TOPIC_DATA[slug]?.description || "Master the core principles of this concept through an interactive Socratic dialogue. Kai will guide you step-by-step."}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-zinc-950/60 border border-zinc-900 rounded-2xl p-5 space-y-4 shrink-0">
                            <span className="text-xs font-bold uppercase text-zinc-400 tracking-wider flex items-center gap-1.5">
                                <Cpu className="w-4 h-4 text-indigo-400" /> Skill Calibration
                            </span>
                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-zinc-400">Understanding:</span>
                                        <span className="text-indigo-400 font-bold">{Math.floor((session.transcript.length / 40) * 100)}%</span>
                                    </div>
                                    <div className="h-1.5 rounded-full bg-zinc-900 overflow-hidden">
                                        <div className="h-full bg-indigo-500 transition-all" style={{ width: `${Math.min(100, (session.transcript.length / 40) * 100)}%` }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Collapsible DSA reference implementation workspace */}
                    <div className="bg-zinc-950/60 border border-zinc-900 rounded-2xl overflow-hidden flex flex-col shrink-0">
                        <button 
                        onClick={() => setCodeExpanded(!codeExpanded)}
                        className="px-5 py-4 flex items-center justify-between text-xs font-bold text-zinc-400 hover:text-white transition-colors"
                        >
                        <span className="flex items-center gap-2">
                            <Code2 className="w-4 h-4 text-indigo-400" />
                            Algorithm Reference Snippet
                        </span>
                        {codeExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>

                        {codeExpanded && (
                        <div className="p-4 bg-zinc-950 border-t border-zinc-900 text-[11px] font-mono text-zinc-300 overflow-x-auto leading-relaxed">
                            <pre>{TOPIC_DATA[slug]?.referenceCode || `// Reference implementation\nvoid referenceImplementation() {\n}`}</pre>
                        </div>
                        )}
                    </div>

                    <div className="mt-auto p-4 rounded-xl bg-zinc-950 border border-zinc-900 flex items-center justify-between text-xs shrink-0 sticky bottom-0">
                        <span className="text-zinc-500">Need a hint? Ask Kai for one.</span>
                        <button 
                            onClick={() => {
                                if (session.state === 'active' && !session.kaiTyping) {
                                    session.sendMessage("Can you give me a hint about what to do next?");
                                }
                            }}
                            disabled={session.state !== 'active' || session.kaiTyping}
                            className="text-indigo-400 hover:text-indigo-300 font-bold disabled:opacity-50"
                        >
                            Get Hint
                        </button>
                    </div>

                  </section>
  );

  const renderChatArea = () => (
                <section className="h-full flex flex-col justify-between bg-zinc-950/40 border border-zinc-900 rounded-3xl p-6 relative overflow-hidden">
                    
                    {/* Conversational log */}
                    <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar mb-4 relative">
                        {session.state === 'starting' && (
                            <div className="flex items-center justify-center py-12 gap-3 text-zinc-500">
                            <Loader2 size={16} className="animate-spin text-indigo-400" />
                            <span className="text-sm font-semibold">Kai is preparing your personalized canvas...</span>
                            </div>
                        )}

                        <AnimatePresence initial={false}>
                            {session.transcript.map((entry) => {
                            const isKai = entry.role === 'assistant';
                            const isThought = isKai && entry.content.includes('Socratic');
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
                                    {voice.state === 'speaking' && (
                                        <span className="absolute inset-0 rounded-full border border-indigo-400 animate-ping opacity-60" />
                                    )}
                                    </div>
                                )}

                                {/* Socratic Thought Card or Standard Bubble */}
                                <div className={`space-y-3 max-w-[82%] ${entry.role === 'user' ? 'text-right' : ''}`}>
                                    <div
                                    className={`rounded-2xl px-5 py-4 text-sm leading-relaxed border transition-all text-left ${
                                        isThought
                                        ? 'bg-[#12121D]/90 border-amber-500/10 text-zinc-200 shadow-md relative overflow-hidden'
                                        : isKai
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
                                            onClick={() => voice.speak(entry.content)}
                                            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors bg-indigo-950/40 px-2.5 py-1 rounded-md border border-indigo-500/10"
                                            title="Replay speech"
                                        >
                                            <Volume2 size={12} />
                                            Listen
                                        </button>
                                        </div>
                                    )}
                                    </div>

                                    {/* Code Card Rendering */}
                                    {extractedCode && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.99 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="rounded-xl overflow-hidden border border-white/5 shadow-2xl bg-[#0E0E14] font-mono text-xs text-zinc-300 shadow-black/40 text-left"
                                    >
                                        <div className="bg-zinc-950/60 px-4 py-2 border-b border-white/5 flex items-center justify-between">
                                        <span className="text-zinc-500 flex items-center gap-1.5">
                                            <Code2 size={12} /> Optimal Solution
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

                    {/* Interactive Chat Input Area (Option 4 / Option 3 hybrid) */}
                    <form onSubmit={handleTextSend} className="space-y-4 border-t border-zinc-900 pt-4 shrink-0">
                        {isListening && (
                        <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5">
                            <div className="flex items-center gap-2 text-emerald-400 text-xs">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                            <span>Recording voice input... speak clearly.</span>
                            </div>
                            <button
                            type="button"
                            onClick={() => voice.stop(true)}
                            className="text-[10px] uppercase font-bold text-red-400 hover:text-red-300"
                            >
                            Cancel
                            </button>
                        </div>
                        )}

                        <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={handleMicToggle}
                            disabled={session.state !== 'active' || session.kaiTyping}
                            className={`p-3.5 rounded-xl border transition-all shrink-0 ${
                            isListening 
                                ? 'bg-emerald-600 border-emerald-500 text-white animate-pulse'
                                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                            }`}
                            title="Mock Mic Input"
                        >
                            {isListening ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                        </button>

                        <input
                            data-testid="text-input"
                            type="text"
                            value={textInput}
                            onChange={(e) => setTextInput(e.target.value)}
                            placeholder={isListening ? 'Listening for speech...' : 'Type answer here or click mic to dictate...'}
                            disabled={isListening || session.state !== 'active' || session.kaiTyping}
                            className="flex-1 px-4 py-3 rounded-xl bg-zinc-950 border border-zinc-900 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
                        />

                        <button
                            type="submit"
                            disabled={!textInput.trim() || session.state !== 'active' || session.kaiTyping}
                            className={`p-3.5 rounded-xl text-white transition-all shrink-0 ${
                            textInput.trim()
                                ? 'bg-indigo-600 hover:bg-indigo-500 hover:translate-y-[-1px]'
                                : 'bg-zinc-900 border border-zinc-800 text-zinc-600 cursor-not-allowed'
                            }`}
                        >
                            <Send className="w-5 h-5" />
                        </button>
                        </div>

                        <div className="flex justify-between items-center text-[10px] text-zinc-500">
                        <span>Tip: Hit Send or press Enter to trigger Kai.</span>
                        <span>Input Mode: Audio Dictation + Text Hybrid</span>
                        </div>
                    </form>

                </section>
  );

  if (!mounted) return null;

  return (
    <div className="h-[100dvh] bg-[#09090d] text-zinc-100 flex flex-col justify-between overflow-hidden relative noise-overlay">
      
      {/* Header (Option 3) */}
      <header className="glass border-b border-zinc-900 sticky top-0 z-30 px-6 py-4 shrink-0">
        <div className="mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              href="/learn" 
              className="p-2 rounded-lg bg-zinc-900 border border-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white tracking-wide capitalize">{slug.replace(/-/g, ' ')}</span>
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-bold text-indigo-400">
                  Dual Layout
                </span>
              </div>
              <span className="text-xs text-zinc-500">Socratic Interactive Canvas</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {session.state === 'active' && (
              <>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-900 text-xs text-zinc-400">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Exchange: <strong>{Math.floor(session.transcript.length / 2)} / 20</strong></span>
                </div>
                <button
                  data-testid="finish-button"
                  onClick={session.endSession}
                  className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-950/20 border border-transparent hover:border-red-500/20 transition-all font-semibold"
                >
                  End Session
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Sandbox split grid */}
      <main className={cn("w-full flex-1 flex flex-col relative z-10 overflow-hidden", isDesktop ? "p-4 h-full" : "h-full")}>
        {isDesktop ? (
          <ResizablePanelGroup direction="horizontal" className="h-full w-full gap-4">
              <ResizablePanel defaultSize={33} minSize={20}>
                  {renderProblemArea()}
              </ResizablePanel>
              <ResizableHandle className="bg-transparent w-2" />
              <ResizablePanel defaultSize={67} minSize={40}>
                  {renderChatArea()}
              </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <div 
            className="flex-1 w-full h-full relative" 
            {...swipeHandlers} 
            style={{ touchAction: 'pan-y' }}
          >
            <div className="absolute inset-0 flex flex-col overflow-hidden pb-14">
              {mobileTab === 'problem' && (
                <div className="flex-1 w-full h-full overflow-y-auto p-4 animate-in fade-in slide-in-from-left-4">
                  {renderProblemArea()}
                </div>
              )}
              {mobileTab === 'chat' && (
                <div className="flex-1 w-full h-full p-2 animate-in fade-in slide-in-from-right-4">
                  {renderChatArea()}
                </div>
              )}
            </div>
            
            <div
              role="tablist"
              className="absolute bottom-0 left-0 right-0 z-50 flex border-t"
              style={{
                background: 'var(--surface-1, #09090d)',
                borderColor: 'var(--surface-edge, #27272a)',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)'
              }}
            >
              {[
                { id: 'problem', label: 'Problem', icon: BookOpen },
                { id: 'chat', label: 'Chat', icon: MessageSquare },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setMobileTab(id as 'problem' | 'chat')}
                  className={cn(
                    "flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-all text-[10px] font-bold uppercase tracking-wider",
                    mobileTab === id ? "text-indigo-400" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  <Icon className={cn("w-5 h-5 transition-all", mobileTab === id ? "text-indigo-400" : "text-zinc-500")} />
                  <span>{label}</span>
                  {mobileTab === id && <div className="w-1 h-1 rounded-full bg-indigo-400 mt-0.5" />}
                </button>
              ))}
            </div>
          </div>
        )}
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