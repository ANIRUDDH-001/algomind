/**
 * @hook useLearnSession
 * @description Manages the full lifecycle of a Kai-Tutor learn session.
 *              Handles API calls, transcript, session state, and TTS.
 * @phase Phase 2J
 */
'use client';

import { useState, useCallback, useRef } from 'react';

export type LearnSessionState = 'idle' | 'starting' | 'active' | 'ending' | 'complete' | 'error';

export interface LearnTranscriptEntry {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  at: string;
}

export interface LearnSessionResults {
  sessionId: string;
  conceptSlug: string;
  durationSeconds: number;
  assessment: {
    understood: string[];
    struggled: string[];
    notes: string;
    confidenceDelta: number;
  };
}

interface UseLearnSessionOptions {
  conceptSlug: string;
  onSpeakMessage?: (text: string) => Promise<void>;  // TTS integration
  onSessionStart?: (sessionId: string) => void;
  onSessionEnd?: (results: LearnSessionResults) => void;
}

export function useLearnSession(options: UseLearnSessionOptions) {
  const { conceptSlug, onSpeakMessage, onSessionStart, onSessionEnd } = options;

  const [state, setState] = useState<LearnSessionState>('idle');
  const [transcript, setTranscript] = useState<LearnTranscriptEntry[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [results, setResults] = useState<LearnSessionResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const [kaiTyping, setKaiTyping] = useState(false);

  const startTimeRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const addTranscriptEntry = useCallback((entry: Omit<LearnTranscriptEntry, 'id'>) => {
    setTranscript(prev => [
      ...prev,
      { ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` }
    ]);
  }, []);

  // Build messages array for API from transcript
  const buildMessages = useCallback((t: LearnTranscriptEntry[]) =>
    t.map(e => ({ role: e.role, content: e.content })),
  []);

  /**
   * Start the learn session — creates DB row and gets Kai's opening message.
   */
  const startSession = useCallback(async () => {
    if (state !== 'idle') return;
    setState('starting');
    startTimeRef.current = Date.now();

    try {
      const res = await fetch('/api/learn/concept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conceptSlug,
          messages: [],
          action: 'start',
        }),
      });

      if (res.status === 429) {
        const data = await res.json();
        setState('error');
        setError('LIMIT_REACHED');
        return;
      }

      if (!res.ok) throw new Error(`Session start failed: ${res.status}`);

      const data = await res.json();
      setSessionId(data.sessionId);
      onSessionStart?.(data.sessionId);

      // Add Kai's opening message to transcript
      if (data.response) {
        addTranscriptEntry({ role: 'assistant', content: data.response, at: new Date().toISOString() });
        await onSpeakMessage?.(data.response);
      }

      setState('active');
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Failed to start session');
    }
  }, [state, conceptSlug, onSessionStart, onSpeakMessage, addTranscriptEntry]);

  const handleSessionResults = useCallback(async (data: {
    sessionId?: string;
    assessment?: LearnSessionResults['assessment'];
  }) => {
    const durationSeconds = startTimeRef.current
      ? Math.round((Date.now() - startTimeRef.current) / 1000)
      : 0;

    const sessionResults: LearnSessionResults = {
      sessionId: sessionId ?? data.sessionId ?? '',
      conceptSlug,
      durationSeconds,
      assessment: data.assessment ?? { understood: [], struggled: [], notes: '', confidenceDelta: 0 },
    };

    setResults(sessionResults);
    setState('complete');
    onSessionEnd?.(sessionResults);
  }, [sessionId, conceptSlug, onSessionEnd]);

  /**
   * Send a user message and get Kai's response.
   */
  const sendMessage = useCallback(async (userMessage: string) => {
    if (state !== 'active' || !sessionId || kaiTyping) return;
    if (!userMessage.trim()) return;

    // Add user message immediately
    const userEntry: Omit<LearnTranscriptEntry, 'id'> = {
      role: 'user',
      content: userMessage,
      at: new Date().toISOString(),
    };
    const updatedTranscript = [...transcript, { ...userEntry, id: `u-${Date.now()}` }];
    setTranscript(updatedTranscript);
    setKaiTyping(true);
    setError(null);

    abortControllerRef.current = new AbortController();

    try {
      const res = await fetch('/api/learn/concept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conceptSlug,
          messages: buildMessages(updatedTranscript),
          sessionId,
          action: 'turn',
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) throw new Error(`Turn failed: ${res.status}`);
      const data = await res.json();

      if (data.response) {
        addTranscriptEntry({ role: 'assistant', content: data.response, at: new Date().toISOString() });
        await onSpeakMessage?.(data.response);
      }

      setError(null);
      setLastFailedMessage(null);

      // Auto-end if session limit reached
      if (data.sessionComplete) {
        await handleSessionResults(data);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError('Failed to send message');
      setLastFailedMessage(userMessage);
    } finally {
      setKaiTyping(false);
    }
  }, [state, sessionId, kaiTyping, transcript, conceptSlug, buildMessages, addTranscriptEntry, onSpeakMessage, handleSessionResults]);

  const retryLastMessage = useCallback(async () => {
    if (state !== 'active' || !sessionId || kaiTyping || !lastFailedMessage) return;

    setKaiTyping(true);
    setError(null);
    abortControllerRef.current = new AbortController();

    try {
      const res = await fetch('/api/learn/concept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conceptSlug,
          messages: buildMessages(transcript),
          sessionId,
          action: 'turn',
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) throw new Error(`Turn failed: ${res.status}`);
      const data = await res.json();

      if (data.response) {
        addTranscriptEntry({ role: 'assistant', content: data.response, at: new Date().toISOString() });
        await onSpeakMessage?.(data.response);
      }

      setError(null);
      setLastFailedMessage(null);

      if (data.sessionComplete) {
        await handleSessionResults(data);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError('Failed to send message');
    } finally {
      setKaiTyping(false);
    }
  }, [state, sessionId, kaiTyping, lastFailedMessage, conceptSlug, buildMessages, transcript, addTranscriptEntry, onSpeakMessage, handleSessionResults]);

  /**
   * End the session explicitly.
   */
  const endSession = useCallback(async () => {
    if (state !== 'active' || !sessionId) return;
    setState('ending');

    try {
      const res = await fetch('/api/learn/concept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conceptSlug,
          messages: buildMessages(transcript),
          sessionId,
          action: 'end',
        }),
      });

      if (!res.ok) throw new Error(`Session end failed: ${res.status}`);
      const data = await res.json();
      await handleSessionResults(data);
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Failed to end session');
    }
  }, [state, sessionId, conceptSlug, transcript, buildMessages, handleSessionResults]);

  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
    setState('idle');
    setTranscript([]);
    setSessionId(null);
    setResults(null);
    setError(null);
    setLastFailedMessage(null);
    setKaiTyping(false);
    startTimeRef.current = null;
  }, []);

  return {
    state,
    transcript,
    sessionId,
    results,
    error,
    kaiTyping,
    startSession,
    sendMessage,
    retryLastMessage,
    endSession,
    reset,
  };
}