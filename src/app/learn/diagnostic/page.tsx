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
import { Mic, MicOff, CheckCircle } from 'lucide-react';

type DiagnosticState = 'intro' | 'active' | 'processing' | 'complete';

interface MessageEntry {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const DIAGNOSTIC_WELCOME = "Welcome to AlgoMind! I'm Kai, your AI tutor. I'll ask you a few quick questions to understand where you're at with Data Structures and Algorithms. There are no right or wrong answers — just be honest, and I'll calibrate your learning path. Ready to begin?";

export default function DiagnosticPage() {
  const router = useRouter();
  const [state, setState] = useState<DiagnosticState>('intro');
  const [messages, setMessages] = useState<MessageEntry[]>([]);
  const [sessionId] = useState(() => `diag-${Date.now()}`);
  const [kaiThinking, setKaiThinking] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const exchangeCount = useRef(0);
  const messageIdCounter = useRef(0);

  const addMsg = (role: 'user' | 'assistant', content: string) => {
    const id = `msg-${Date.now()}-${messageIdCounter.current++}`;
    setMessages(prev => [...prev, { id, role, content }]);
  };

  // Auto-start
  useEffect(() => {
    setTimeout(() => {
      addMsg('assistant', DIAGNOSTIC_WELCOME);
      setState('active');
    }, 800);
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendToKai = async (userInput: string) => {
    addMsg('user', userInput);
    setKaiThinking(true);

    const updatedMessages = [
      ...messages,
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

      if (data.response) {
        addMsg('assistant', data.response);

        // Kai signals end with specific phrase
        if (data.response.includes('calibrate your AlgoMind profile') || exchangeCount.current >= 12) {
          setTimeout(() => completeDiagnostic(updatedMessages), 1500);
        }
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

      if (res.ok) {
        setState('complete');
        setTimeout(() => router.push('/learn'), 2500);
      }
    } catch {
      setState('active');
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex flex-col">
      {/* Header */}
      <div className="px-4 sm:px-5 py-4 border-b border-[#1E1E2E] flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
            <Link href="/learn" className="hover:text-zinc-300 transition-colors">Learn</Link>
            <span>/</span>
            <span className="text-zinc-300 truncate">Diagnostic</span>
          </div>
          <h1 className="text-sm font-semibold text-zinc-300">Diagnostic</h1>
        </div>
        {state === 'active' && (
          <span data-testid="turn-counter" className="text-xs text-zinc-500 flex-shrink-0 whitespace-nowrap">~{Math.max(0, 12 - exchangeCount.current)} left</span>
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
      <div className="flex-1 overflow-y-auto px-4 py-6 max-w-2xl mx-auto w-full space-y-4">
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

      {/* Mic input */}
      <div className="border-t border-[#1E1E2E] px-4 py-6 flex flex-col items-center gap-3 safe-area-bottom">
        <motion.button
          data-testid="send-button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          disabled={state !== 'active' || kaiThinking}
          onClick={() => setMicActive(!micActive)}
          className={`w-16 h-16 rounded-full flex items-center justify-center transition-all relative ${state !== 'active' || kaiThinking ? 'bg-zinc-900 text-zinc-600 cursor-not-allowed' : micActive ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
        >
          {micActive && <motion.div className="absolute inset-0 rounded-full bg-emerald-500/20" animate={{ scale: [1, 1.4], opacity: [0.5, 0] }} transition={{ duration: 1.2, repeat: Infinity }} />}
          {micActive ? <Mic size={22} /> : <MicOff size={22} />}
        </motion.button>
        <p className="text-xs text-zinc-500">{kaiThinking ? 'Kai is thinking...' : micActive ? 'Listening...' : 'Tap to answer'}</p>
      </div>
    </div>
  );
}