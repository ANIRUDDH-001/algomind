import React, { useEffect, useRef } from 'react';
import { Message } from '@/hooks/useInterview';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Bot, User } from 'lucide-react';

interface ConversationViewProps {
    messages: Message[];
    isAISpeaking: boolean;
}

export function ConversationView({ messages, isAISpeaking }: ConversationViewProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    return (
        <div
            ref={scrollRef}
            className="h-full overflow-y-auto p-4 space-y-4 bg-slate-950/20 scrollbar-thin scrollbar-thumb-slate-800"
        >
            {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50">
                    <Bot className="w-12 h-12 mb-2" />
                    <p>Interview starting...</p>
                </div>
            )}

            {messages.map((msg, index) => (
                <div
                    key={index}
                    className={cn(
                        "flex gap-3 max-w-[85%]",
                        msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
                    )}
                >
                    <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                        msg.role === 'user' ? "bg-blue-600" : "bg-purple-600"
                    )}>
                        {msg.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
                    </div>

                    <Card className={cn(
                        "p-3 text-sm leading-relaxed border-none",
                        msg.role === 'user'
                            ? "bg-blue-600/10 text-blue-100 rounded-tr-none"
                            : "bg-purple-600/10 text-purple-100 rounded-tl-none"
                    )}>
                        {msg.content}

                        {/* Timestamp */}
                        <div className="text-[10px] opacity-50 mt-1 text-right">
                            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </Card>
                </div>
            ))}

            {/* Typing/Speaking Indicator */}
            {isAISpeaking && (
                <div className="flex gap-3 max-w-[85%]">
                    <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center shrink-0 animate-pulse">
                        <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex items-center gap-1 h-8 px-2">
                        <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                        <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                        <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce"></span>
                    </div>
                </div>
            )}
        </div>
    );
}
