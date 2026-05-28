/**
 * @component VoiceActivityIndicator
 * @description Animated voice state indicator.
 *              Shows: idle / kai-speaking / user-speaking / thinking
 * @phase Phase 2P
 */
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Mic } from 'lucide-react';

type VoiceState = 'idle' | 'kai-speaking' | 'user-speaking' | 'thinking';

interface VoiceActivityIndicatorProps {
  state: VoiceState;
  conceptIcon?: React.ReactNode;
  className?: string;
}

const STATE_COLORS = {
  idle: 'border-zinc-700/50 bg-zinc-900/40',
  'kai-speaking': 'border-indigo-500/60 bg-indigo-950/40',
  'user-speaking': 'border-emerald-500/60 bg-emerald-950/30',
  thinking: 'border-amber-500/40 bg-amber-950/20',
};

const RING_COLORS = {
  idle: 'border-zinc-700/20',
  'kai-speaking': 'border-indigo-500/30',
  'user-speaking': 'border-emerald-500/40',
  thinking: 'border-amber-500/20',
};

export function VoiceActivityIndicator({ state, conceptIcon, className = '' }: VoiceActivityIndicatorProps) {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* Pulsing rings for active states */}
      <AnimatePresence>
        {(state === 'kai-speaking' || state === 'user-speaking') && (
          <>
            {[0, 1, 2].map(i => (
              <motion.div
                key={i}
                className={`absolute rounded-full border ${RING_COLORS[state]}`}
                initial={{ width: 56, height: 56, opacity: 0.6 }}
                animate={{
                  width: [56, 56 + 20 + i * 14, 56 + 20 + i * 14],
                  height: [56, 56 + 20 + i * 14, 56 + 20 + i * 14],
                  opacity: [0.6, 0, 0],
                }}
                transition={{
                  duration: 1.8,
                  repeat: Infinity,
                  delay: i * 0.5,
                  ease: 'easeOut',
                }}
              />
            ))}
          </>
        )}
      </AnimatePresence>

      {/* Core circle */}
      <motion.div
        className={`relative w-14 h-14 rounded-full border-2 flex items-center justify-center transition-colors duration-300 ${STATE_COLORS[state]}`}
        animate={state === 'thinking' ? { rotate: [0, 360] } : { rotate: 0 }}
        transition={state === 'thinking' ? { duration: 3, repeat: Infinity, ease: 'linear' } : {}}
      >
        {state === 'thinking' ? (
          <div className="w-5 h-5 border-2 border-amber-500/60 border-t-amber-400 rounded-full animate-spin" />
        ) : (
          conceptIcon
            ? conceptIcon
            : <Mic className="w-5 h-5 text-zinc-300" />
        )}
      </motion.div>

      {/* State label */}
      <AnimatePresence mode="wait">
        <motion.div
          key={state}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
          className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap"
        >
          <span className="text-xs text-zinc-600" data-testid="voice-state-label">
            {state === 'kai-speaking' && 'Kai speaking'}
            {state === 'user-speaking' && 'Listening…'}
            {state === 'thinking' && 'Thinking…'}
            {state === 'idle' && 'Tap to speak'}
          </span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
