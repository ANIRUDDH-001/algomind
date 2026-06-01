/**
 * @codesage
 * @file      src/components/voice/LiveTranscript.tsx
 * @purpose   Zoom-style live transcript overlay for voice sessions.
 * @tech      React, Framer Motion, TailwindCSS
 * @connects  framer-motion
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None observed
 * @audit     CODESAGE-v1
 */
'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface TranscriptEntry {
  role: 'user' | 'assistant';
  content: string;
  isInterim?: boolean;   // true for live speech-to-text (not yet submitted)
}

interface LiveTranscriptProps {
  entries: TranscriptEntry[];
  interimTranscript?: string;   // live STT text (not yet sent)
  isVisible?: boolean;
  className?: string;
}

export function LiveTranscript({ entries, interimTranscript, isVisible = true, className = '' }: LiveTranscriptProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const displayEntries = entries.slice(-2);

  // Auto-scroll
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [displayEntries, interimTranscript]);

  const hasContent = displayEntries.length > 0 || (interimTranscript && interimTranscript.trim().length > 0);

  return (
    <AnimatePresence>
      {isVisible && hasContent && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.2 }}
          className={`
            pointer-events-none select-none
            bg-black/80 backdrop-blur-sm rounded-xl
            px-4 py-3 max-w-xl w-full
            ${className}
          `}
        >
          <div ref={containerRef} className="space-y-2 overflow-hidden max-h-32">
            {/* Previous messages (sliding window) */}
            {displayEntries.map((entry, i) => (
              <motion.div
                key={`${entry.role}-${i}-${(entry.content || '').slice(0, 20)}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: i === displayEntries.length - 1 ? 1 : 0.4 }}
                className={`text-sm leading-relaxed ${
                  entry.role === 'assistant' ? 'text-zinc-300' : 'text-white'
                }`}
              >
                <span className={`text-xs font-semibold mr-2 ${
                  entry.role === 'assistant' ? 'text-indigo-400' : 'text-emerald-400'
                }`}>
                  {entry.role === 'assistant' ? 'Kai' : 'You'}
                </span>
                {entry.content}
              </motion.div>
            ))}

            {/* Interim transcript (live speech) */}
            <AnimatePresence>
              {interimTranscript && interimTranscript.trim() && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-sm text-zinc-400 italic leading-relaxed"
                >
                  <span className="text-xs font-semibold text-emerald-400 not-italic mr-2">You</span>
                  {interimTranscript}
                  <motion.span
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                    className="inline-block w-0.5 h-4 bg-emerald-400 ml-0.5 align-middle"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}