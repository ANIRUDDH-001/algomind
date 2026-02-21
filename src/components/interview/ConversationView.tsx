import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Message } from '@/hooks/useInterview';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Bot, User, RotateCcw, AlertTriangle } from 'lucide-react';
import { InterruptionIndicator } from './InterruptionIndicator';
import { useVoiceActivityDetection } from '@/hooks/useVoiceActivityDetection';
import { InterruptionManager } from '@/lib/voice/interruption-manager';
import { useFeatureFlagWithSupport } from '@/hooks/useFeatureFlag';
import { voiceAnalytics } from '@/lib/analytics/voice-analytics';
import { Badge } from '@/components/ui/badge';

// ---------------------------------------------------------------------------
// Debug helper (dev mode only)
// ---------------------------------------------------------------------------

const IS_DEV =
    typeof process !== 'undefined' &&
    process.env.NODE_ENV === 'development';

function debugLog(...args: unknown[]) {
    if (IS_DEV) {
        console.debug('[VAD-CV]', ...args);
    }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ChunkProgress {
    /** Current sentence being spoken (1-based) */
    current: number;
    /** Total sentences discovered so far */
    total: number;
    /** Whether the AI is still generating more sentences */
    generating: boolean;
}

interface ConversationViewProps {
    messages: Message[];
    isAISpeaking: boolean;

    // ── Chunk progress (optional) ────────────────────────────────
    /** Sentence-level progress during chunked TTS playback. */
    chunkProgress?: ChunkProgress;

    // ── VAD integration (all optional for backwards compat) ──────
    /** Whether VAD-based interruptions are enabled (feature flag). */
    vadEnabled?: boolean;
    /** Called when the user interrupts AI speech via VAD. */
    onInterrupt?: () => void;
    /** Set of message indices that were interrupted. Controlled by parent. */
    interruptedMessageIndices?: Set<number>;
    /** Called when user wants the AI to continue its interrupted response. */
    onContinuePreviousResponse?: () => void;
    /** Called when VAD initialization fails. */
    onVadError?: (error: Error) => void;
    /** Called when the user starts speaking (even if AI is silent). Useful for waking up STT. */
    onUserSpeaking?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConversationView({
    messages,
    isAISpeaking,
    chunkProgress,
    vadEnabled: propVadEnabled = false,
    onInterrupt,
    interruptedMessageIndices,
    onContinuePreviousResponse,
    onVadError,
    onUserSpeaking,
}: ConversationViewProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    // ── VAD state (only used when vadEnabled) ────────────────────
    const [isInterrupting, setIsInterrupting] = useState(false);
    const interruptionManagerRef = useRef<InterruptionManager | null>(null);

    // ── Auto-scroll to bottom ────────────────────────────────────
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    // ── VAD Hook Integration ─────────────────────────────────────
    // Feature flags integration
    // We combine the prop (from parent/settings) with the global feature flag
    const { enabled: isVadFlagEnabled, supported: isVadSupported } = useFeatureFlagWithSupport('ENABLE_VAD_INTERRUPTIONS');

    // Effective VAD enabled state: Must be enabled globally AND supported AND enabled via prop (if applicable)
    // Note: If propVadEnabled is generally true/false based on user preference in parent, we might want to respect it.
    // For now, let's assume if the flag is disabled, VAD is dead.
    const isVadEnabled = isVadFlagEnabled && propVadEnabled;

    // VAD Hook
    const {
        isListening: isVadListening,
        error: vadError,
    } = useVoiceActivityDetection({
        enabled: isVadEnabled,
        autoStart: isVadEnabled,
        onSpeechStart: () => {
            if (isVadEnabled && interruptionManagerRef.current) {
                // IMPORTANT: The InterruptionManager determines if we should actually interrupt.
                // It checks confidence, grace periods, etc.
                const decision = interruptionManagerRef.current.handleUserSpeechStart();

                if (decision === 'INTERRUPT_IMMEDIATELY') {
                    debugLog('InterruptionManager decided to INTERRUPT');
                    handleInterruption();
                } else if (decision === 'ALLOW_INPUT') {
                    debugLog('InterruptionManager decided to ALLOW_INPUT (User speaking, AI silent)');
                    // Ensure STT is awake!
                    if (onUserSpeaking) onUserSpeaking();
                } else {
                    debugLog('InterruptionManager decided to WAIT/IGNORE', decision);
                }
            }
        },
        onSpeechEnd: () => {
            if (isVadEnabled && interruptionManagerRef.current) {
                interruptionManagerRef.current.handleUserSpeechEnd();
            }
        },
        onError: (err) => {
            voiceAnalytics.track('vad_error', { error: err.message });
            if (onVadError) onVadError(err);
        }
    });

    // ── Analytics: Track VAD Init ──────────────────────────────
    useEffect(() => {
        if (isVadEnabled) {
            voiceAnalytics.track('vad_init', {
                browser: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
                supported: isVadSupported
            });
        }
    }, [isVadEnabled, isVadSupported]);

    // ── VAD Error Handling ─────────────────────────────────────
    useEffect(() => {
        if (vadError && onVadError) {
            onVadError(vadError);
        }
    }, [vadError, onVadError]);

    // ── InterruptionManager setup ──────────────────────────
    const handleInterruption = useCallback(() => {
        if (!isVadEnabled) return;

        debugLog('User interrupted AI speech');
        voiceAnalytics.track('interruption', {
            timestamp: Date.now()
        });

        setIsInterrupting(true);

        // Cancel TTS via the InterruptionManager
        interruptionManagerRef.current?.cancelAISpeech();

        // Notify parent (InterviewSession) to stop speaking + capture partial content
        onInterrupt?.();

        // Reset interrupting state after a short delay
        setTimeout(() => setIsInterrupting(false), 2000);
    }, [isVadEnabled, onInterrupt]);

    useEffect(() => {
        if (!isVadEnabled) {
            // Cleanup
            if (interruptionManagerRef.current) {
                interruptionManagerRef.current.reset();
                interruptionManagerRef.current.removeAllListeners();
                interruptionManagerRef.current = null;
            }
            setTimeout(() => setIsInterrupting(false), 0);
            return;
        }

        // Initialize InterruptionManager
        const manager = new InterruptionManager({
            graceMs: 500,
            debounceMs: 1500,
            speechEndConfirmMs: 300,
        });
        interruptionManagerRef.current = manager;

        // Listen for SHOULD_INTERRUPT events
        const unsub = manager.on('interruption', () => {
            handleInterruption();
        });

        debugLog('InterruptionManager initialised');

        return () => {
            unsub();
            if (interruptionManagerRef.current) {
                interruptionManagerRef.current.reset();
                interruptionManagerRef.current.removeAllListeners();
                interruptionManagerRef.current = null;
            }
        };
    }, [isVadEnabled, handleInterruption]);

    // ── Sync isAISpeaking → InterruptionManager ──────────────────
    useEffect(() => {
        if (!isVadEnabled || !interruptionManagerRef.current) return;

        if (isAISpeaking) {
            debugLog('AI started speaking → handleAIResponseStart');
            interruptionManagerRef.current.handleAIResponseStart();
        } else {
            debugLog('AI stopped speaking → handleAIResponseComplete');
            interruptionManagerRef.current.handleAIResponseComplete();
            setTimeout(() => setIsInterrupting(false), 0);
        }
    }, [isAISpeaking, isVadEnabled]);

    // ── Check if last message was interrupted (for continue button) ──
    const lastMessage = messages[messages.length - 1];
    const showContinueButton =
        isVadEnabled &&
        !isAISpeaking &&
        lastMessage?.role === 'assistant' &&
        lastMessage?.status === 'interrupted' &&
        onContinuePreviousResponse;

    // ── Render ───────────────────────────────────────────────────
    return (
        <div
            ref={scrollRef}
            className="h-full overflow-y-auto p-4 space-y-4 bg-slate-950/20 scrollbar-thin scrollbar-thumb-slate-800"
            data-testid="conversation-view"
        >
            {/* Browser Support Warning */}
            {propVadEnabled && !isVadSupported && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="text-sm font-medium text-amber-500">Voice Interruption Unavailable</h4>
                        <p className="text-xs text-amber-500/80 mt-1">
                            Your browser doesn&apos;t support the features needed for voice activity detection.
                            Please use the manual controls.
                        </p>
                    </div>
                </div>
            )}

            {/* VAD Active Indicator (Debug/Info) */}
            {isVadEnabled && isVadListening && (
                <div className="flex justify-center mb-2">
                    <Badge variant="outline" className="text-[10px] text-green-500 border-green-900/30 bg-green-900/10">
                        🎤 VAD Active
                    </Badge>
                </div>
            )}

            {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50">
                    <Bot className="w-12 h-12 mb-2" />
                    <p>Interview starting...</p>
                </div>
            )}

            {messages.map((msg, index) => {
                const isInterruptedMsg =
                    msg.role === 'assistant' &&
                    (msg.status === 'interrupted' || interruptedMessageIndices?.has(index));

                return (
                    <div
                        key={msg.id || index}
                        className={cn(
                            "flex gap-3 max-w-[85%]",
                            msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
                        )}
                    >
                        <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                            msg.role === 'user' ? "bg-blue-600" : "bg-purple-600",
                            // Fade out AI avatar during interruption
                            isVadEnabled && isInterrupting && msg.role === 'assistant' && index === messages.length - 1
                                ? "opacity-40 transition-opacity duration-500"
                                : ""
                        )}>
                            {msg.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
                        </div>

                        <Card className={cn(
                            "p-3 text-sm leading-relaxed border-none",
                            msg.role === 'user'
                                ? "bg-blue-600/10 text-blue-100 rounded-tr-none"
                                : "bg-purple-600/10 text-purple-100 rounded-tl-none",
                            // Interrupted message styling — amber dashed left border
                            isInterruptedMsg
                                ? "border-l-2 !border-l-amber-500/50 !border-dashed bg-purple-600/5"
                                : ""
                        )}>
                            {/* Speaker name */}
                            <div className={cn(
                                "text-[10px] font-bold uppercase tracking-wider mb-1",
                                msg.role === 'user' ? "text-blue-400" : "text-purple-400"
                            )}>
                                {msg.role === 'user' ? 'You' : 'Kai'}
                            </div>

                            {/* Message content */}
                            {(() => {
                                const safeContent: string =
                                    typeof msg.content === 'string'
                                        ? msg.content
                                        : typeof msg.content === 'object' && msg.content !== null
                                            ? String(
                                                (msg.content as Record<string, unknown>).text
                                                ?? (msg.content as Record<string, unknown>).sentence
                                                ?? (msg.content as Record<string, unknown>).content
                                                ?? JSON.stringify(msg.content)
                                            )
                                            : String(msg.content ?? '');

                                return (
                                    <>
                                        {safeContent}

                                        {/* Interrupted badge + partial heard indicator */}
                                        {isVadEnabled && isInterruptedMsg && (
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                                    ⚡ Interrupted
                                                </span>
                                                {msg.partialContent && msg.partialContent.length < safeContent.length && (
                                                    <span className="text-[9px] text-amber-500/60">
                                                        {Math.round((msg.partialContent.length / safeContent.length) * 100)}% heard
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </>
                                );
                            })()}

                            {/* Timestamp */}
                            <div className="text-[10px] opacity-50 mt-1 text-right">
                                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </Card>
                    </div>
                );
            })}

            {/* Continue Previous Response button */}
            {showContinueButton && (
                <div className="flex justify-center">
                    <button
                        onClick={onContinuePreviousResponse}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium text-amber-300 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/40 transition-all duration-200"
                    >
                        <RotateCcw className="w-3 h-3" />
                        Continue previous response
                    </button>
                </div>
            )}

            {/* Typing/Speaking Indicator */}
            {isAISpeaking && !isInterrupting && (
                <div className="flex gap-3 max-w-[85%]">
                    <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center shrink-0 animate-pulse">
                        <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex items-center gap-2 h-8 px-2">
                        <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                            <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                            <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce"></span>
                        </div>
                        {chunkProgress && (
                            <span className="text-[10px] text-purple-400/70 whitespace-nowrap">
                                {chunkProgress.generating
                                    ? `Generating... (${chunkProgress.current}/${chunkProgress.total})`
                                    : `Sentence ${chunkProgress.current} of ${chunkProgress.total}`
                                }
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* VAD Interruption Indicator */}
            {isVadEnabled && isInterrupting && (
                <div className="flex justify-center">
                    <InterruptionIndicator isInterrupting={isInterrupting} />
                </div>
            )}
        </div>
    );
}
