/**
 * @codesage
 * @file      src/components/voice/SpeechBubble.tsx
 * @purpose   Single speech turn bubble (user or AI) used in transcripts.
 * @tech      React, TailwindCSS
 * @connects  None
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None observed
 * @audit     CODESAGE-v1
 */
'use client';

interface SpeechBubbleProps {
  role: 'assistant' | 'user';
  text: string;
  isLive?: boolean;      // true for live user transcript (streaming STT)
  isFading?: boolean;    // true when being replaced by new message
  isStreaming?: boolean; // true while assistant response is still arriving from server (SSE)
}

export function SpeechBubble({ role, text, isLive = false, isFading = false, isStreaming = false }: SpeechBubbleProps) {
  // Client-side defense: strip any think tags that survived server sanitization.
  // generateResponse() strips these centrally, but this guards edge cases.
  const safeText = text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
    .trim();

  const isKai = role === 'assistant';
  const enterClass = isKai ? 'bubble-in-left' : 'bubble-in-right';
  const animationClass = isFading ? 'bubble-fading' : enterClass;

  return (
    <div
      className={`flex ${isKai ? 'justify-start' : 'justify-end'} w-full ${animationClass}`}
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
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 live-dot-pulse" />
            <span className="text-xs text-zinc-500 font-medium">You</span>
          </div>
        )}

        {/* Message text */}
        <p className={`text-sm leading-relaxed ${isLive ? 'text-zinc-400' : ''}`}>
          {safeText}
          {isLive && (
            <span
              className="inline-block w-0.5 h-4 bg-emerald-400 ml-0.5 align-middle live-cursor-blink"
              aria-hidden="true"
            />
          )}
          {/* Server-stream cursor: shown while Kai's response is still arriving via SSE */}
          {isStreaming && isKai && !isLive && (
            <span
              className="inline-block w-0.5 h-4 bg-indigo-300 ml-0.5 align-middle animate-pulse"
              aria-hidden="true"
            />
          )}
        </p>
      </div>
    </div>
  );
}
