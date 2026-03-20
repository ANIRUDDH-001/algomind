/**
 * @component VoiceModeToggle
 * @description Toggle between voice mode (ZoomTranscript) and text mode (chat log).
 *              Voice mode is the default on mobile, text mode on desktop.
 * @phase Phase 2P
 */
'use client';

import { motion } from 'framer-motion';
import { MessageSquare, Mic } from 'lucide-react';

interface VoiceModeToggleProps {
  isVoiceMode: boolean;
  onToggle: (voiceMode: boolean) => void;
}

export function VoiceModeToggle({ isVoiceMode, onToggle }: VoiceModeToggleProps) {
  return (
    <div className="flex items-center bg-zinc-900/60 rounded-lg p-0.5 border border-zinc-800/40">
      <button
        onClick={() => onToggle(true)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
          isVoiceMode
            ? 'bg-indigo-600/90 text-white shadow-sm'
            : 'text-zinc-500 hover:text-zinc-300'
        }`}
      >
        <Mic size={12} />
        Voice
      </button>
      <button
        onClick={() => onToggle(false)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
          !isVoiceMode
            ? 'bg-zinc-700 text-white shadow-sm'
            : 'text-zinc-500 hover:text-zinc-300'
        }`}
      >
        <MessageSquare size={12} />
        Text
      </button>
    </div>
  );
}
