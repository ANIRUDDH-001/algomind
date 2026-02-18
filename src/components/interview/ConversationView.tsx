import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Message } from '@/hooks/useInterview';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Bot, User, RotateCcw } from 'lucide-react';
import { InterruptionIndicator } from './InterruptionIndicator';
import { useVoiceActivityDetection } from '@/hooks/useVoiceActivityDetection';
import { InterruptionManager } from '@/lib/voice/interruption-manager';

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
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConversationView({
    messages,
    isAISpeaking,
    chunkProgress,
    vadEnabled = false,
    onInterrupt,
    interruptedMessageIndices,
    onContinuePreviousResponse,
    onVadError,
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
    // We use the hook unconditionally, but it respects `enabled: vadEnabled`
    // and won't load heavy assets unless enabled.
    const {
        isListening: isVadListening,
        error: vadError,
        startListening: startVad,
        stopListening: stopVad,
    } = useVoiceActivityDetection({
        enabled: vadEnabled,
        autoStart: vadEnabled, // Auto-start if enabled
        onSpeechStart: () => {
            if (vadEnabled && interruptionManagerRef.current) {
                // We only have basic VAD here (no confidence yet in hook output from this event?)
                // But InterruptionManager handles simple 'speech start'
                const decision = interruptionManagerRef.current.handleUserSpeechStart();
                // logic is inside InterruptionManager listener usually, but here we trigger it
            }
        },
        onSpeechEnd: () => {
            if (vadEnabled && interruptionManagerRef.current) {
                interruptionManagerRef.current.handleUserSpeechEnd();
            }
        },
        onError: (err) => {
            if (onVadError) onVadError(err);
        }
    });

    // ── VAD Error Handling ─────────────────────────────────────
    useEffect(() => {
        if (vadError && onVadError) {
            onVadError(vadError);
        }
    }, [vadError, onVadError]);


    // ── InterruptionManager setup ──────────────────────────
    const handleInterruption = useCallback(() => {
        if (!vadEnabled) return;

        debugLog('User interrupted AI speech');
        setIsInterrupting(true);

        // Cancel TTS via the InterruptionManager
        interruptionManagerRef.current?.cancelAISpeech();

        // Notify parent (InterviewSession) to stop speaking + capture partial content
        onInterrupt?.();

        // Reset interrupting state after a short delay
        setTimeout(() => setIsInterrupting(false), 2000);
    }, [vadEnabled, onInterrupt]);

    useEffect(() => {
        if (!vadEnabled) {
            // Cleanup
            if (interruptionManagerRef.current) {
                interruptionManagerRef.current.reset();
                interruptionManagerRef.current.removeAllListeners();
                interruptionManagerRef.current = null;
            }
            setIsInterrupting(false);
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
    }, [vadEnabled, handleInterruption]);

    // ── Sync isAISpeaking → InterruptionManager ──────────────────
    useEffect(() => {
        if (!vadEnabled || !interruptionManagerRef.current) return;

        if (isAISpeaking) {
            debugLog('AI started speaking → handleAIResponseStart');
            interruptionManagerRef.current.handleAIResponseStart();
        } else {
            debugLog('AI stopped speaking → handleAIResponseComplete');
            interruptionManagerRef.current.handleAIResponseComplete();
            setIsInterrupting(false);
        }
    }, [isAISpeaking, vadEnabled]);

    // ── Check if last message was interrupted (for continue button) ──
    const lastMessage = messages[messages.length - 1];
    const showContinueButton =
        vadEnabled &&
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
                            vadEnabled && isInterrupting && msg.role === 'assistant' && index === messages.length - 1
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
                            {msg.content}

                            {/* Interrupted badge + partial heard indicator */}
                            {vadEnabled && isInterruptedMsg && (
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                        ⚡ Interrupted
                                    </span>
                                    {msg.partialContent && msg.partialContent.length < msg.content.length && (
                                        <span className="text-[9px] text-amber-500/60">
                                            {Math.round((msg.partialContent.length / msg.content.length) * 100)}% heard
                                        </span>
                                    )}
                                </div>
                            )}

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
            {vadEnabled && isInterrupting && (
                <div className="flex justify-center">
                    <InterruptionIndicator isInterrupting={isInterrupting} />
                </div>
            )}
        </div>
    );
}
