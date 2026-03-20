/**
 * @component ZoomTranscript
 * @description Voice-first live conversation display.
 *              Shows last Kai turn + live user transcript.
 *              Replaces scrolling chat log for voice sessions.
 *              Inspired by Zoom's live caption bar.
 * @phase Phase 2P
 */
'use client';

import { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { VoiceActivityIndicator } from './VoiceActivityIndicator';
import { SpeechBubble } from './SpeechBubble';
import { useZoomTranscript, useProgressiveReveal } from '@/hooks/useZoomTranscript';

interface ZoomTranscriptProps {
  /** Last complete message from Kai-Tutor */
  kaiMessage: string | null;
  /** Current live STT transcript (streaming) */
  userTranscript: string;
  /** TTS is currently playing */
  isKaiSpeaking: boolean;
  /** VAD detected user speech */
  isUserSpeaking: boolean;
  /** Waiting for AI response */
  isThinking: boolean;
  /** Concept being learned */
  conceptSlug: string;
  conceptIcon: string;
  /** Total exchanges so far */
  exchangeCount: number;
  /** Optional: show previous exchanges count */
  sessionHistoryCount?: number;
  className?: string;
}

export function ZoomTranscript({
  kaiMessage,
  userTranscript,
  isKaiSpeaking,
  isUserSpeaking,
  isThinking,
  conceptSlug,
  conceptIcon,
  exchangeCount,
  sessionHistoryCount = 0,
  className = '',
}: ZoomTranscriptProps) {
  const { displayedKaiMessage, isTransitioning } = useZoomTranscript(kaiMessage);

  // Progressive word reveal during TTS playback
  const revealedKaiText = useProgressiveReveal(displayedKaiMessage, isKaiSpeaking);

  // Determine voice state
  const voiceState =
    isThinking ? ('thinking' as const) :
    isKaiSpeaking ? ('kai-speaking' as const) :
    isUserSpeaking ? ('user-speaking' as const) :
    ('idle' as const);

  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div className={`flex flex-col items-center gap-6 ${className}`} data-testid="zoom-transcript">
      {/* History count (collapsed) */}
      {sessionHistoryCount > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2"
        >
          <div className="h-px flex-1 bg-zinc-800/60 max-w-16" />
          <span className="text-xs text-zinc-600 px-2">
            {sessionHistoryCount} earlier exchanges
          </span>
          <div className="h-px flex-1 bg-zinc-800/60 max-w-16" />
        </motion.div>
      )}

      {/* Kai's message */}
      <div className="w-full" ref={containerRef}>
        <AnimatePresence mode="wait">
          {displayedKaiMessage && (
            <motion.div
              key={displayedKaiMessage.slice(0, 20)} // key change triggers re-animation
              className="w-full"
            >
              <SpeechBubble
                role="assistant"
                text={isKaiSpeaking ? revealedKaiText : displayedKaiMessage}
                isFading={isTransitioning}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Center: Voice activity indicator */}
      <div className="py-4">
        <VoiceActivityIndicator
          state={voiceState}
          conceptIcon={conceptIcon}
          data-testid="voice-activity-indicator"
        />
      </div>

      {/* User's live transcript */}
      <div className="w-full min-h-[48px]">
        <AnimatePresence>
          {userTranscript && (
            <SpeechBubble
              role="user"
              text={userTranscript}
              isLive={isUserSpeaking}
            />
          )}
        </AnimatePresence>

        {/* Placeholder when user hasn't spoken */}
        {!userTranscript && !isKaiSpeaking && !isThinking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-end"
          >
            <p className="text-xs text-zinc-700 italic pr-1">
              Speak your answer…
            </p>
          </motion.div>
        )}
      </div>

      {/* Exchange counter */}
      <div className="flex items-center gap-1.5">
        {Array.from({ length: Math.min(exchangeCount, 20) }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: i * 0.02 }}
            className="w-1 h-1 rounded-full bg-indigo-500/60"
          />
        ))}
        {exchangeCount > 20 && (
          <span className="text-xs text-zinc-600">+{exchangeCount - 20}</span>
        )}
      </div>
    </div>
  );
}

ZoomTranscript.__defaultProps = {
  kaiMessage: null,
  userTranscript: '',
  isKaiSpeaking: false,
  isUserSpeaking: false,
  isThinking: false,
  conceptSlug: 'arrays-strings',
  conceptIcon: '📋',
  exchangeCount: 0,
};
