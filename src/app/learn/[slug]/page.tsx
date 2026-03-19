/**
 * @page /learn/[slug]
 * @description Active Kai-Tutor session screen.
 *              Voice-first: Kai speaks first, user responds.
 * @phase Phase 2J
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Square, ArrowRight, Volume2 } from 'lucide-react';
import { useLearnSession } from '@/hooks/useLearnSession';
import { UpgradeModal } from '@/components/upgrade/UpgradeModal';

// NOTE: useTTS and useVAD/useSTT hooks come from the existing voice pipeline
// These are already in the codebase — import from there
// import { useTTS } from '@/hooks/useTTS';
// import { useVAD } from '@/hooks/useVAD';
// import { useSTT } from '@/hooks/useSTT';

export default function LearnSessionPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [micActive, setMicActive] = useState(false);

  // TTS integration — speak Kai's messages
  const speakMessage = async (text: string) => {
    // TODO: Connect to existing useTTS hook
    // For now: console log (TTS connected in voice pipeline phase)
    console.log('[Kai speaks]:', text);
  };

  const session = useLearnSession({
    conceptSlug: slug,
    onSpeakMessage: speakMessage,
    onSessionEnd: (results) => {
      router.push(`/learn/${slug}/results?sessionId=${results.sessionId}`);
    },
  });

  // Auto-start when page loads
  useEffect(() => {
    if (session.state === 'idle') {
      session.startSession();
    }
  }, []);

  // Handle limit reached error
  useEffect(() => {
    if (session.error === 'LIMIT_REACHED') {
      setShowUpgrade(true);
    }
  }, [session.error]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session.transcript]);

  const handleVoiceInput = (transcript: string) => {
    session.sendMessage(transcript);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#1E1E2E]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/learn')}
            className="text-zinc-500 hover:text-zinc-300 text-sm"
          >
            ← Learn
          </button>
          <span className="text-zinc-700">|</span>
          <span className="text-sm font-medium text-zinc-300 capitalize">
            {slug.replace(/-/g, ' ')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {session.state === 'active' && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
          )}
          {session.state === 'active' && (
            <button
              onClick={session.endSession}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-950/20 border border-transparent hover:border-red-500/20 transition-all"
            >
              <Square size={12} />
              End Session
            </button>
          )}
        </div>
      </div>

      {/* Transcript */}
      <div className="flex-1 overflow-y-auto px-4 py-6 max-w-2xl mx-auto w-full space-y-4">
        {/* Loading state */}
        {session.state === 'starting' && (
          <div className="flex items-center gap-2 text-zinc-500">
            <motion.div
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="flex gap-1"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            </motion.div>
            <span className="text-sm">Kai is preparing...</span>
          </div>
        )}

        {/* Messages */}
        <AnimatePresence initial={false}>
          {session.transcript.map((entry) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex gap-3 ${entry.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              {/* Avatar */}
              <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                entry.role === 'assistant'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-700 text-zinc-300'
              }`}>
                {entry.role === 'assistant' ? 'K' : 'U'}
              </div>

              {/* Bubble */}
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                entry.role === 'assistant'
                  ? 'bg-[#111118] border border-[#1E1E2E] text-zinc-200 rounded-tl-sm'
                  : 'bg-indigo-600/20 border border-indigo-500/20 text-zinc-200 rounded-tr-sm'
              }`}>
                {entry.content}
                {entry.role === 'assistant' && (
                  <button
                    onClick={() => speakMessage(entry.content)}
                    className="ml-2 text-zinc-600 hover:text-indigo-400 inline-flex items-center"
                    title="Replay"
                  >
                    <Volume2 size={12} />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Kai typing indicator */}
        {session.kaiTyping && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-3"
          >
            <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">K</div>
            <div className="bg-[#111118] border border-[#1E1E2E] rounded-2xl rounded-tl-sm px-4 py-3">
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
        <div ref={transcriptEndRef} />
      </div>

      {/* Voice input area */}
      <div className="border-t border-[#1E1E2E] px-4 py-6">
        <div className="max-w-2xl mx-auto flex flex-col items-center gap-4">
          {/* Mic button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setMicActive(!micActive)}
            disabled={session.state !== 'active' || session.kaiTyping}
            className={`
              relative w-16 h-16 rounded-full flex items-center justify-center transition-all
              focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0A0A0F]
              ${session.state !== 'active' || session.kaiTyping
                ? 'bg-zinc-900 text-zinc-600 cursor-not-allowed'
                : micActive
                  ? 'bg-emerald-600 text-white focus:ring-emerald-500 shadow-lg shadow-emerald-900/50'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 focus:ring-indigo-500'
              }
            `}
          >
            {/* Pulsing ring when active */}
            {micActive && (
              <motion.div
                className="absolute inset-0 rounded-full bg-emerald-500/30"
                animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
            {micActive ? <Mic size={22} /> : <MicOff size={22} />}
          </motion.button>

          <p className="text-xs text-zinc-500 text-center">
            {session.state === 'starting' && 'Starting session...'}
            {session.state === 'active' && !session.kaiTyping && !micActive && 'Tap mic to speak'}
            {session.state === 'active' && !session.kaiTyping && micActive && 'Listening... tap again to send'}
            {session.state === 'active' && session.kaiTyping && 'Kai is thinking...'}
            {session.state === 'ending' && 'Saving session...'}
          </p>
        </div>
      </div>

      {/* Upgrade modal */}
      <UpgradeModal
        open={showUpgrade}
        onOpenChange={(open) => { setShowUpgrade(open); if (!open) router.push('/learn'); }}
        payload={{ reason: "limit_reached" }}
      />
    </div>
  );
}