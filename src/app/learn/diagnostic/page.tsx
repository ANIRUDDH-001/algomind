/**
 * @page /learn/diagnostic
 * @description New user diagnostic onboarding — Kai-guided assessment.
 * @phase Phase 2J
 */
'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, CheckCircle, Send, Loader2 } from 'lucide-react';

type DiagnosticState = 'intro' | 'active' | 'processing' | 'complete';

interface MessageEntry {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

type SpeechRecognitionResultEntry = {
  transcript: string;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  [index: number]: SpeechRecognitionResultEntry;
};

type SpeechRecognitionResultListLike = {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void | Promise<void>) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionCtorLike = new () => SpeechRecognitionLike;

const DIAGNOSTIC_WELCOME = "Welcome to AlgoMind! I'm Kai, your AI tutor. I'll ask you a few quick questions to understand where you're at with Data Structures and Algorithms. There are no right or wrong answers — just be honest, and I'll calibrate your learning path. Ready to begin?";

export default function DiagnosticPage() {
  const router = useRouter();
  const [state, setState] = useState<DiagnosticState>('intro');
  const [messages, setMessages] = useState<MessageEntry[]>([]);
  const [sessionId] = useState(() => `diag-${Date.now()}`);
  const [kaiThinking, setKaiThinking] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [interimVoiceText, setInterimVoiceText] = useState('');
  const [canComplete, setCanComplete] = useState(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const exchangeCount = useRef(0);
  const messageIdCounter = useRef(0);
  const messagesRef = useRef<MessageEntry[]>([]);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const addMsg = (role: 'user' | 'assistant', content: string) => {
    const id = `msg-${Date.now()}-${messageIdCounter.current++}`;
    setMessages(prev => {
      const next = [...prev, { id, role, content }];
      messagesRef.current = next;
      return next;
    });
  };

  // Auto-start (guarded with ref to prevent double-mount in strict mode)
  const hasBootstrappedRef = useRef(false);
  useEffect(() => {
    if (hasBootstrappedRef.current) return;
    hasBootstrappedRef.current = true;

    // Immediately add welcome message and set active state
    addMsg('assistant', DIAGNOSTIC_WELCOME);
    setState('active');
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const sendToKai = async (userInput: string) => {
    addMsg('user', userInput);
    setKaiThinking(true);

    const updatedMessages = [
      ...messagesRef.current,
      { id: 'user-new', role: 'user' as const, content: userInput },
    ];

    try {
      const res = await fetch('/api/learn/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
          sessionId,
        }),
      });

      const data = await res.json();
      exchangeCount.current++;
      setCanComplete(Boolean(data.shouldComplete) || exchangeCount.current >= 8);

      if (data.response) {
        addMsg('assistant', data.response);
      }
    } catch {
      addMsg('assistant', "I ran into a small issue. Could you repeat that?");
    } finally {
      setKaiThinking(false);
    }
  };

  const completeDiagnostic = async (finalMessages: MessageEntry[]) => {
    setState('processing');
    try {
      const res = await fetch('/api/learn/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: finalMessages.map(m => ({ role: m.role, content: m.content })),
          sessionId,
          action: 'complete',
        }),
      });

      const data = await res.json().catch(() => ({} as { success?: boolean; error?: string }));

      if (res.ok && data.success !== false) {
        setState('complete');
        router.replace('/learn');
      } else {
        const errorMsg = (data as { error?: string }).error || 'Failed to complete diagnostic';
        addMsg('assistant', `I encountered an issue: ${errorMsg}. Please try again, or you can skip to your learning path.`);
        setState('active');
        setCanComplete(true);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Network error';
      addMsg('assistant', `Connection issue: ${errMsg}. Please check your internet and try again.`);
      setState('active');
      setCanComplete(true);
    }
  };

  const handleTextSend = async () => {
    const text = textInput.trim();
    if (!text || state !== 'active' || kaiThinking) return;
    setTextInput('');
    await sendToKai(text);
  };

  const toggleMic = () => {
    if (state !== 'active' || kaiThinking) return;

    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionCtorLike;
      webkitSpeechRecognition?: SpeechRecognitionCtorLike;
    };
    const SpeechRecognitionCtor =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      // Show toast or error message if speech recognition not available
      addMsg('assistant', 'Speech recognition is not available in your browser. Please use text input instead.');
      setMicActive(false);
      return;
    }

    if (micActive) {
      recognitionRef.current?.stop();
      setMicActive(false);
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'en-IN';
    recognition.interimResults = true;
    recognition.continuous = false;

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
        setMicActive(false);
        recognition.stop();
        await sendToKai(finalText.trim());
      }
    };

    recognition.onerror = () => {
      setMicActive(false);
      setInterimVoiceText('');
    };

    recognition.onend = () => {
      setMicActive(false);
      setInterimVoiceText('');
    };

    recognitionRef.current = recognition;
    setMicActive(true);
    recognition.start();
  };

  return (
    <div className="h-full min-h-0 bg-[#0A0A0F] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 sm:px-5 py-4 border-b border-[#1E1E2E] flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
            <Link href="/learn" className="hover:text-zinc-300 transition-colors">Learn</Link>
            <span>/</span>
            <span className="text-zinc-300 truncate">Diagnostic</span>
          </div>
          <h1 className="text-sm font-semibold text-zinc-300">Diagnostic</h1>
        </div>
        {state === 'active' && (
          <span data-testid="turn-counter" className="text-xs text-zinc-500 shrink-0 whitespace-nowrap">~{Math.max(0, 12 - exchangeCount.current)} left</span>
        )}
      </div>

      {/* Processing / Complete overlay */}
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

      {/* Transcript */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-6 pb-32 md:pb-12 max-w-2xl mx-auto w-full space-y-4">
        {messages.map(msg => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            data-testid={msg.role === 'assistant' ? 'message-assistant' : 'message-user'}
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${msg.role === 'assistant' ? 'bg-indigo-600 text-white' : 'bg-zinc-700 text-zinc-300'}`}>
              {msg.role === 'assistant' ? 'K' : 'U'}
            </div>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm text-zinc-200 ${msg.role === 'assistant' ? 'bg-[#111118] border border-[#1E1E2E] rounded-tl-sm' : 'bg-indigo-600/20 border border-indigo-500/20 rounded-tr-sm'}`}>
              {msg.content}
            </div>
          </motion.div>
        ))}
        {kaiThinking && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs text-white font-bold">K</div>
            <div className="bg-[#111118] border border-[#1E1E2E] rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1">
              {[0, 0.2, 0.4].map((d, i) => (
                <motion.span key={i} className="w-1.5 h-1.5 rounded-full bg-zinc-500" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, delay: d, repeat: Infinity }} />
              ))}
            </div>
          </div>
        )}
        <div ref={transcriptEndRef} />
      </div>

      {/* Input area */}
      <div className="shrink-0 sticky bottom-0 z-20 bg-[#0A0A0F]/95 backdrop-blur-sm border-t border-[#1E1E2E] px-4 py-3 pt-4 safe-area-bottom">
        <div className="max-w-2xl mx-auto flex items-end gap-3">
          <div className={`flex-1 bg-[#111118] border rounded-xl overflow-hidden transition-colors ${
            state !== 'active' || kaiThinking
              ? 'border-zinc-800/40 opacity-50'
              : 'border-[#1E1E2E] focus-within:border-indigo-500/40'
          }`}>
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
              className="w-full bg-transparent px-4 py-3 text-base text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none"
              style={{ fontSize: '16px' }}
            />
          </div>

          <button
            data-testid="send-text-button"
            onClick={() => void handleTextSend()}
            disabled={!textInput.trim() || state !== 'active' || kaiThinking}
            className="shrink-0 p-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white transition-colors"
            aria-label="Send diagnostic answer"
          >
            {kaiThinking ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>

          <motion.button
            data-testid="send-button"
            whileHover={{ scale: state === 'active' && !kaiThinking ? 1.05 : 1 }}
            whileTap={{ scale: state === 'active' && !kaiThinking ? 0.95 : 1 }}
            disabled={state !== 'active' || kaiThinking}
            onClick={toggleMic}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all relative ${state !== 'active' || kaiThinking ? 'bg-zinc-900 text-zinc-600 cursor-not-allowed' : micActive ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
          >
            {micActive && <motion.div className="absolute inset-0 rounded-full bg-emerald-500/20" animate={{ scale: [1, 1.4], opacity: [0.5, 0] }} transition={{ duration: 1.2, repeat: Infinity }} />}
            {micActive ? <Mic size={18} /> : <MicOff size={18} />}
          </motion.button>
        </div>

        <div className="max-w-2xl mx-auto mt-3 flex items-center justify-between gap-3">
          <span className="text-xs text-zinc-500 flex-1">
            {kaiThinking ? 'Kai is thinking...' : micActive ? 'Listening...' : 'Type or tap mic to answer'}
            {interimVoiceText ? ` ${interimVoiceText}` : ''}
          </span>
          <button
            data-testid="finish-diagnostic-button"
            onClick={() => void completeDiagnostic(messagesRef.current)}
            disabled={state !== 'active' || kaiThinking || !canComplete}
            className="shrink-0 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-semibold text-sm flex items-center gap-2 transition-all"
          >
            {state === 'processing' ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Initializing...
              </>
            ) : (
              'Finish Diagnostic'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}