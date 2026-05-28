'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Mic, MicOff, Square, Volume2, Send, Loader2 } from 'lucide-react';
import { useLearnSession } from '@/hooks/useLearnSession';
import { useVAD } from '@/hooks/useVAD';
import { useSTT } from '@/hooks/useSTT';
import { useTTS } from '@/hooks/useTTS';
import { UpgradeModal } from '@/components/upgrade/UpgradeModal';
import { ZoomTranscript } from '@/components/voice/ZoomTranscript';
import { VoiceModeToggle } from '@/components/voice/VoiceModeToggle';

interface LearnSessionPageClientProps {
  slug: string;
}

export default function LearnSessionPageClient({ slug }: LearnSessionPageClientProps) {
  const router = useRouter();
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // UI state
  const [isVoiceMode, setIsVoiceMode] = useState(true);
  const [textInput, setTextInput] = useState('');
  const [userTranscript, setUserTranscript] = useState('');
  const [upgradeDismissed, setUpgradeDismissed] = useState(false);

  // VAD mode state
  const [vadMode, setVadMode] = useState<'onnx' | 'push-to-talk'>('push-to-talk');

  // VAD lifecycle ref
  const vadStarted = useRef(false);

  // Session hook
  const session = useLearnSession({
    conceptSlug: slug,
    onSpeakMessage: async (text: string) => {
      await speak(text);
    },
    onSessionEnd: (results) => {
      router.push(`/learn/${slug}/results?sessionId=${results.sessionId}`);
    },
  });

  // TTS
  const { speak, isSpeaking, stop: stopSpeaking } = useTTS({
    onSpeakStart: () => {
      // Gate mic while Kai is speaking to prevent echo
      if (vadStarted.current) {
        vadHook.stopListening();
      }
    },
    onSpeakEnd: () => {
      // Re-enable mic after Kai finishes
      if (vadStarted.current && session.state === 'active') {
        vadHook.startListening();
      }
    },
  });

  // STT
  const stt = useSTT({
    provider: 'whisper',
    language: 'en-IN',
    onTranscript: (text: string, isFinal: boolean) => {
      setUserTranscript(text);
      if (isFinal && text.trim()) {
        // Auto-send on final transcript from VAD
        if (vadMode === 'onnx') {
          if (session.state !== 'active' || session.kaiTyping) return;
          session.sendMessage(text);
          stt.resetTranscript();
          setUserTranscript('');
        }
      }
    },
  });

  // Voice send (from VAD transcript)
  const handleVoiceSend = useCallback((text: string) => {
    if (!text.trim() || session.state !== 'active' || session.kaiTyping) return;
    session.sendMessage(text);
    stt.resetTranscript();
    setUserTranscript('');
  }, [session.state, session.kaiTyping, session.sendMessage, stt.resetTranscript]);

  // VAD
  const vadHook = useVAD({
    enabled: true,
    onSpeechStart: () => {
      // Visual feedback: user started speaking
    },
    onSpeechEnd: async (audio: Float32Array) => {
      await stt.transcribeAudio(audio);
    },
    onError: (err) => {
      console.warn('[LearnVoice] VAD error:', err.message);
    },
    onFallback: () => {
      // VAD not available: stay in push-to-talk mode
      setVadMode('push-to-talk');
    },
  });

  // Update vadMode from hook
  useEffect(() => {
    setVadMode(vadHook.mode);
  }, [vadHook.mode]);

  // FIX: Correct dependency array: was [session] causing double-start
  useEffect(() => {
    if (session.state === 'idle') {
      session.startSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.state, session.startSession]);

  // Start VAD when session becomes active, and force-stop all audio/mic activity when it is not active
  useEffect(() => {
    if (session.state === 'active') {
      if (!vadStarted.current) {
        vadStarted.current = true;
        vadHook.startListening();
      }
    } else {
      if (vadStarted.current) {
        vadHook.stopListening(true);
        stt.stopListening();
        stopSpeaking();
        vadStarted.current = false;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.state]);

  // Stop VAD, STT, and TTS on unmount
  useEffect(() => {
    return () => {
      vadHook.stopListening(true);
      stt.stopListening();
      stopSpeaking();
      vadStarted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session.transcript]);

  // Escape shortcut
  useEffect(() => {
    const handler = () => {
      const shouldExit = window.confirm('Exit this learn session and return to the knowledge map?');
      if (shouldExit) router.push('/learn');
    };
    document.addEventListener('learn-escape-pressed', handler as EventListener);
    return () => document.removeEventListener('learn-escape-pressed', handler as EventListener);
  }, [router]);

  // Text input send
  const handleTextSend = useCallback(() => {
    const text = textInput.trim();
    if (!text || session.state !== 'active' || session.kaiTyping) return;
    session.sendMessage(text);
    setTextInput('');
  }, [textInput, session]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTextSend();
    }
  }, [handleTextSend]);

  // Push-to-talk: tap to start/stop
  const handleMicToggle = useCallback(() => {
    if (session.state !== 'active' || session.kaiTyping) return;

    if (vadMode === 'push-to-talk') {
      // Push-to-talk: first tap = start recording, second tap = send
      if (!stt.isListening) {
        stt.resetTranscript();
        setUserTranscript('');
        stt.startListening();
      } else {
        stt.stopListening();
        // Send whatever was captured
        const captured = stt.transcript + stt.interimTranscript;
        if (captured.trim()) {
          handleVoiceSend(captured.trim());
        }
      }
    }
    // In ONNX mode the VAD auto-manages start/stop: tap has no effect
  }, [vadMode, stt, session.state, session.kaiTyping, handleVoiceSend]);

  const isListening = vadHook.isListening || stt.isListening;
  const showUpgrade = session.error === 'LIMIT_REACHED' && !upgradeDismissed;

  // Render
  return (
    <div className="min-h-screen bg-[#0A0A0F] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#1E1E2E]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
              <Link href="/learn" className="hover:text-zinc-300 transition-colors shrink-0">Learn</Link>
              <span>/</span>
              <span className="text-zinc-300 capitalize truncate">{slug.replace(/-/g, ' ')}</span>
            </div>
            <button
              data-testid="back-button"
              onClick={() => router.push('/learn')}
              className="text-zinc-500 hover:text-zinc-300 text-sm"
            >
              ← Back to map
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {session.state === 'active' && (
            <VoiceModeToggle isVoiceMode={isVoiceMode} onToggle={setIsVoiceMode} />
          )}
          {session.state === 'active' && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
          )}
          {session.state === 'active' && (
            <button
              data-testid="finish-button"
              onClick={session.endSession}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-950/20 border border-transparent hover:border-red-500/20 transition-all"
            >
              <Square size={12} />
              End Session
            </button>
          )}
        </div>
      </div>

      {/* Conversation area */}
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

        {isVoiceMode ? (
          <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 min-h-[400px]">
            <ZoomTranscript
              kaiMessage={session.transcript.filter(m => m.role === 'assistant').at(-1)?.content ?? null}
              userTranscript={userTranscript || stt.interimTranscript}
              isKaiSpeaking={isSpeaking}
              isUserSpeaking={isListening}
              isThinking={session.kaiTyping}
              conceptSlug={slug}
              conceptIcon="📚"
              exchangeCount={Math.floor(session.transcript.length / 2)}
              sessionHistoryCount={Math.max(0, session.transcript.length - 2)}
              className="w-full max-w-lg"
            />
          </div>
        ) : (
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
                  entry.role === 'assistant' ? 'bg-indigo-600 text-white' : 'bg-zinc-700 text-zinc-300'
                }`}>
                  {entry.role === 'assistant' ? 'K' : 'U'}
                </div>
                <div
                  data-testid={entry.role === 'assistant' ? 'message-assistant' : 'message-user'}
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    entry.role === 'assistant'
                      ? 'bg-[#111118] border border-[#1E1E2E] text-zinc-200 rounded-tl-sm'
                      : 'bg-indigo-600/20 border border-indigo-500/20 text-zinc-200 rounded-tr-sm'
                  }`}
                >
                  {entry.content}
                  {entry.role === 'assistant' && (
                    <button
                      onClick={() => speak(entry.content)}
                      className="ml-2 text-zinc-600 hover:text-indigo-400 inline-flex items-center"
                      title="Replay audio"
                      aria-label="Replay Kai's message"
                    >
                      <Volume2 size={12} />
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}

        {session.kaiTyping && !isVoiceMode && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
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

        {session.error && session.error !== 'LIMIT_REACHED' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-4 my-2 p-4 rounded-xl flex items-start gap-3"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-bold text-red-300 mb-1">Connection lost</p>
              <p className="text-xs text-zinc-400">
                Kai couldn&apos;t respond. Your session progress is saved.
              </p>
            </div>
            <button
              onClick={() => {
                if (session.retryLastMessage) {
                  void session.retryLastMessage();
                  return;
                }
                window.location.reload();
              }}
              className="shrink-0 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors px-3 py-1.5 rounded-lg"
              style={{ background: 'var(--surface-3)' }}
            >
              Retry
            </button>
          </motion.div>
        )}
        <div ref={transcriptEndRef} />
      </div>

      {/* Input area: mic button (right) + text input */}
      <div className="border-t border-[#1E1E2E] px-4 py-4 safe-area-bottom">
        <div className="max-w-2xl mx-auto flex items-end gap-3">

          {/* Text input */}
          <div className={`flex-1 bg-[#111118] border rounded-xl overflow-hidden transition-colors ${
            session.state !== 'active' || session.kaiTyping
              ? 'border-zinc-800/40 opacity-50'
              : 'border-[#1E1E2E] focus-within:border-indigo-500/40'
          }`}>
            <textarea
              data-testid="text-input"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                session.state === 'starting' ? 'Starting session...'
                  : session.kaiTyping ? 'Kai is thinking...'
                    : 'Type your answer, or tap the mic to speak'
              }
              rows={2}
              disabled={session.state !== 'active' || session.kaiTyping}
              className="w-full bg-transparent px-4 py-3 text-base text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none"
              style={{ fontSize: '16px' }}
            />
          </div>

          {/* Send button (text) */}
          <button
            data-testid="send-text-button"
            onClick={handleTextSend}
            disabled={!textInput.trim() || session.state !== 'active' || session.kaiTyping}
            className="flex-shrink-0 p-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white transition-colors"
            aria-label="Send text message"
          >
            {session.kaiTyping
              ? <Loader2 size={18} className="animate-spin" />
              : <Send size={18} />}
          </button>

          {/* Mic button */}
          <motion.button
            data-testid="send-button"
            whileHover={{ scale: session.state === 'active' && !session.kaiTyping ? 1.05 : 1 }}
            whileTap={{ scale: session.state === 'active' && !session.kaiTyping ? 0.95 : 1 }}
            onClick={handleMicToggle}
            disabled={session.state !== 'active' || session.kaiTyping}
            className={
              `
              relative flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all
              focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0A0A0F]
              ${session.state !== 'active' || session.kaiTyping
                ? 'bg-zinc-900 text-zinc-600 cursor-not-allowed'
                : isListening
                  ? 'bg-emerald-600 text-white focus:ring-emerald-500 shadow-lg shadow-emerald-900/50'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 focus:ring-indigo-500'
              }
            `}
            aria-label={isListening ? 'Stop listening' : 'Start voice input'}
          >
            {isListening && (
              <motion.div
                className="absolute inset-0 rounded-full bg-emerald-500/30"
                animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
            {isListening ? <Mic size={18} /> : <MicOff size={18} />}
          </motion.button>
        </div>

        {/* Status line */}
        <p className="text-xs text-zinc-600 text-center mt-2">
          {session.state === 'starting' && 'Starting session...'}
          {session.state === 'active' && !session.kaiTyping && !isListening && vadMode === 'onnx' && 'Listening automatically • or type below'}
          {session.state === 'active' && !session.kaiTyping && !isListening && vadMode === 'push-to-talk' && 'Tap mic to speak • or type below'}
          {session.state === 'active' && !session.kaiTyping && isListening && 'Listening... tap mic to stop and send'}
          {session.state === 'active' && session.kaiTyping && 'Kai is thinking...'}
          {session.state === 'ending' && 'Saving session...'}
          {stt.isTranscribing && ' • Transcribing...'}
        </p>
      </div>

      <UpgradeModal
        open={showUpgrade}
        onOpenChange={(open) => {
          if (!open) setUpgradeDismissed(true);
        }}
        payload={{ reason: 'limit_reached' }}
      />
    </div>
  );
}