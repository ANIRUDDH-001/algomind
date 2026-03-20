'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Square, Volume2 } from 'lucide-react';
import { useLearnSession } from '@/hooks/useLearnSession';
import { UpgradeModal } from '@/components/upgrade/UpgradeModal';

interface LearnSessionPageClientProps {
  slug: string;
}

export default function LearnSessionPageClient({ slug }: LearnSessionPageClientProps) {
  const router = useRouter();
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const [micActive, setMicActive] = useState(false);

  const speakMessage = async (text: string) => {
    console.log('[Kai speaks]:', text);
  };

  const session = useLearnSession({
    conceptSlug: slug,
    onSpeakMessage: speakMessage,
    onSessionEnd: (results) => {
      router.push(`/learn/${slug}/results?sessionId=${results.sessionId}`);
    },
  });

  useEffect(() => {
    if (session.state === 'idle') {
      session.startSession();
    }
  }, [session]);

  const showUpgrade = session.error === 'LIMIT_REACHED';

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session.transcript]);

  useEffect(() => {
    const onEscapeShortcut = () => {
      const shouldExit = window.confirm('Exit this learn session and return to the knowledge map?');
      if (shouldExit) {
        router.push('/learn');
      }
    };

    document.addEventListener('learn-escape-pressed', onEscapeShortcut as EventListener);
    return () => document.removeEventListener('learn-escape-pressed', onEscapeShortcut as EventListener);
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#1E1E2E]">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
              <Link href="/learn" className="hover:text-zinc-300 transition-colors">Learn</Link>
              <span>/</span>
              <span className="text-zinc-300 capitalize">{slug.replace(/-/g, ' ')}</span>
            </div>
            <button
              onClick={() => router.push('/learn')}
              className="text-zinc-500 hover:text-zinc-300 text-sm"
            >
              ← Back to map
            </button>
          </div>
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

      <div className="flex-1 overflow-y-auto px-4 py-6 max-w-2xl mx-auto w-full space-y-4">
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

        <AnimatePresence initial={false}>
          {session.transcript.map((entry) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex gap-3 ${entry.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                entry.role === 'assistant'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-700 text-zinc-300'
              }`}>
                {entry.role === 'assistant' ? 'K' : 'U'}
              </div>

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

        {session.kaiTyping && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-3"
          >
            <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0">K</div>
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

      <div className="border-t border-[#1E1E2E] px-4 py-6">
        <div className="max-w-2xl mx-auto flex flex-col items-center gap-4">
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

      <UpgradeModal
        open={showUpgrade}
        onOpenChange={(open) => {
          if (!open) router.push('/learn');
        }}
        payload={{ reason: 'limit_reached' }}
      />
    </div>
  );
}