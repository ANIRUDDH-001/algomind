/**
 * @component SpeechBubble
 * @description A single speech turn bubble for ZoomTranscript.
 *              Kai's bubbles come from left, User's from right.
 * @phase Phase 2P
 */
'use client';

import { motion } from 'framer-motion';

interface SpeechBubbleProps {
  role: 'assistant' | 'user';
  text: string;
  isLive?: boolean;     // true for live user transcript (streaming)
  isFading?: boolean;   // true when being replaced by new message
}

export function SpeechBubble({ role, text, isLive = false, isFading = false }: SpeechBubbleProps) {
  const isKai = role === 'assistant';

  return (
    <motion.div
      initial={{ opacity: 0, x: isKai ? -12 : 12, y: 8 }}
      animate={{ opacity: isFading ? 0 : 1, x: 0, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: isFading ? 0.2 : 0.3, ease: 'easeOut' }}
      className={`flex ${isKai ? 'justify-start' : 'justify-end'} w-full`}
      data-testid={isKai ? 'kai-message-bubble' : 'user-transcript-bubble'}
    >
      <div
        className={`max-w-[88%] px-5 py-3.5 rounded-2xl relative ${
          isKai
            ? 'bg-[#111118] border border-[#1E1E2E] text-zinc-100 rounded-tl-sm'
            : isLive
              ? 'bg-zinc-800/60 border border-zinc-700/40 text-zinc-300 rounded-tr-sm border-dashed'
              : 'bg-indigo-600/90 text-white rounded-tr-sm'
        }`}
      >
        {/* Live indicator for streaming user transcript */}
        {isLive && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <motion.div
              className="w-1.5 h-1.5 rounded-full bg-emerald-400"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            />
            <span className="text-xs text-zinc-500 font-medium">You</span>
          </div>
        )}

        {/* Message text */}
        <p className={`text-sm leading-relaxed ${isLive ? 'text-zinc-400' : ''}`}>
          {text}
          {isLive && (
            <motion.span
              className="inline-block w-0.5 h-4 bg-emerald-400 ml-0.5 align-middle"
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            />
          )}
        </p>
      </div>
    </motion.div>
  );
}
