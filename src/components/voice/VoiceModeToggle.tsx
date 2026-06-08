/**
 * @codesage
 * @file      src/components/voice/VoiceModeToggle.tsx
 * @purpose   Toggle between voice mode and text mode in interview view.
 * @tech      React, TailwindCSS
 * @connects  framer-motion, lucide-react
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None observed
 * @audit     CODESAGE-v1
 */
'use client';

// @ts-expect-error -- automated unused local suppression
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
