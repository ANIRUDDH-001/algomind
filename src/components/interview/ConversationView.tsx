import React, { useEffect, useRef } from 'react';
import { Message } from '@/hooks/useInterview';
import { cn } from '@/lib/utils';
import { Bot, User } from 'lucide-react';

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
    isProcessing: boolean;
    /** Sentence-level progress during chunked TTS playback. */
    chunkProgress?: ChunkProgress;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConversationView({
    messages,
    isAISpeaking,
    isProcessing: _isProcessing,
    chunkProgress,
}: ConversationViewProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    // ── Auto-scroll to bottom ────────────────────────────────────
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    // ── Render ───────────────────────────────────────────────────
    return (
        <div
            ref={scrollRef}
            className="h-full overflow-y-auto p-4 space-y-4 custom-scrollbar"
            style={{ background: 'rgba(10,10,15,0.5)' }}
            data-testid="conversation-view"
        >
            {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50">
                    <Bot className="w-12 h-12 mb-2" />
                    <p>Interview starting...</p>
                </div>
            )}

            {messages.map((msg, index) => {
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
                            msg.role === 'user' ? "" : ""
                        )}
                            style={{ background: msg.role === 'user' ? 'var(--accent-primary)' : 'var(--accent-secondary)' }}>
                            {msg.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
                        </div>

                        <div className={cn(
                            "p-3 text-sm leading-relaxed rounded-xl",
                            msg.role === 'user'
                                ? "text-zinc-100 rounded-tr-none"
                                : "text-zinc-200 rounded-tl-none"
                        )}
                            style={msg.role === 'user'
                                ? { background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }
                                : { background: 'var(--surface-2)', border: '1px solid var(--surface-edge)' }}>
                            {/* Speaker name */}
                            <div className={cn(
                                "text-[10px] font-bold uppercase tracking-wider mb-1",
                                msg.role === 'user' ? "text-indigo-400" : "text-violet-400"
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

                                return safeContent;
                            })()}

                            {/* Streaming cursor */}
                            {msg.status === 'streaming' && (
                                <span className="inline-block w-1.5 h-4 bg-indigo-400 ml-0.5 animate-pulse rounded-sm" />
                            )}

                            {/* Timestamp */}
                            <div className="text-[10px] opacity-50 mt-1 text-right">
                                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    </div>
                );
            })}

            {/* Typing/Speaking Indicator */}
            {isAISpeaking && (
                <div className="flex gap-3 max-w-[85%]">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 animate-pulse"
                        style={{ background: 'var(--accent-secondary)' }}>
                        <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex items-center gap-2 h-8 px-2">
                        <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                            <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                            <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce"></span>
                        </div>
                        {chunkProgress && (
                            <span className="text-[10px] text-violet-400/70 whitespace-nowrap">
                                {chunkProgress.generating
                                    ? `Generating... (${chunkProgress.current}/${chunkProgress.total})`
                                    : `Sentence ${chunkProgress.current} of ${chunkProgress.total}`
                                }
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
