/**
 * @page /learn/diagnostic
 * @description New user diagnostic onboarding — Kai-guided assessment.
 * @phase Phase 2J
 */
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, CheckCircle, Send, Loader2, Volume2, Square } from 'lucide-react';

type DiagnosticState = 'intro' | 'active' | 'processing' | 'complete';
type AudioState = 'idle' | 'listening' | 'speaking' | 'processing';

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
  onstart?: (() => void) | null;
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
  const [audioState, setAudioState] = useState<AudioState>('idle');
  const [messages, setMessages] = useState<MessageEntry[]>([]);
  const [sessionId] = useState(() => `diag-${Date.now()}`);
  const [kaiThinking, setKaiThinking] = useState(false);
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
    setAudioState('processing');

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
        setAudioState('speaking');
      }
    } catch {
      addMsg('assistant', "I ran into a small issue. Could you repeat that?");
      setAudioState('idle');
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
    <div className="h-screen bg-[#0A0A0F] flex flex-col overflow-hidden">
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
      <div className="flex-1 min-h-0 overflow-y-auto max-w-2xl mx-auto px-4 pb-32 md:pb-12 w-full space-y-4">
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
            <span className="text-xs text-zinc-500">
              ~{Math.max(0, 12 - exchangeCount.current)} questions left
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
              disabled={state !== 'active' || kaiThinking || !canComplete}
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
    </div>
  );
}