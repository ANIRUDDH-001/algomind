/**
 * @codesage
 * @file      src/hooks/useZoomTranscript.ts
 * @purpose   Manages the display state for ZoomTranscript and provides a progressive word-by-word reveal hook.
 * @tech      React
 * @connects  Exported for UI components rendering transcripts
 * @apis      none
 * @db        none
 * @state     React component state for displayed message and animated reveal counter
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

'use client';

import { useState, useEffect, useRef } from 'react';

export interface ZoomTranscriptState {
  displayedKaiMessage: string | null;
  previousKaiMessage: string | null;
  isTransitioning: boolean;
  wordCount: number;
}

export function useZoomTranscript(kaiMessage: string | null): ZoomTranscriptState {
  const [displayedKaiMessage, setDisplayedKaiMessage] = useState<string | null>(kaiMessage);
  const [previousKaiMessage, setPreviousKaiMessage] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const prevMessageRef = useRef<string | null>(null);

  useEffect(() => {
    if (kaiMessage && kaiMessage !== prevMessageRef.current) {
      // New message arrived — animate transition
      setPreviousKaiMessage(prevMessageRef.current);
      setIsTransitioning(true);

      const timer = setTimeout(() => {
        setDisplayedKaiMessage(kaiMessage);
        setIsTransitioning(false);
        prevMessageRef.current = kaiMessage;
      }, 200); // fade duration

      return () => clearTimeout(timer);
    }
  }, [kaiMessage]);

  return {
    displayedKaiMessage,
    previousKaiMessage,
    isTransitioning,
    wordCount: displayedKaiMessage?.split(' ').length ?? 0,
  };
}

/**
 * Hook that tracks Kai speaking state for word-by-word reveal animation.
 * When TTS is playing, words are revealed progressively.
 */
export function useProgressiveReveal(text: string | null, isKaiSpeaking: boolean) {
  const [revealedWordCount, setRevealedWordCount] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!text || !isKaiSpeaking) return;

    // Progressive reveal: ~3 words per second while TTS plays
    const words = text.split(' ');
    const resetTimer = setTimeout(() => setRevealedWordCount(0), 0);
    let count = 0;

    intervalRef.current = setInterval(() => {
      count += 1;
      setRevealedWordCount((prev) => Math.max(prev, count));
      if (count >= words.length) {
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    }, 320); // ~3 words/second

    return () => {
      clearTimeout(resetTimer);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [text, isKaiSpeaking]);

  if (!text) return '';
  if (!isKaiSpeaking) return text;
  const words = text.split(' ');
  return words.slice(0, revealedWordCount).join(' ');
}
