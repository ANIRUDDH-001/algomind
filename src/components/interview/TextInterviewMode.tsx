'use client';

import React, { useRef } from 'react';
import { Send } from 'lucide-react';
import { ConversationView } from './ConversationView';
import { Message } from '@/hooks/useInterview';
import { useDraftPersistence } from '@/hooks/useDraftPersistence';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TextInterviewModeProps {
    messages: Message[];
    isProcessing: boolean;
    isAISpeaking: boolean;
    onSendMessage: (content: string) => void;
    className?: string;
}

export function TextInterviewMode({
    messages,
    isProcessing,
    isAISpeaking,
    onSendMessage,
    className
}: TextInterviewModeProps) {
    const [input, setInput, clearDraft] = useDraftPersistence('interview-text');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const textarea = e.target;
        textarea.style.height = 'auto';
        textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`;
        setInput(textarea.value);
    };

    const handleSend = () => {
        if (!input.trim() || isProcessing) return;
        onSendMessage(input.trim());
        clearDraft();
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className={cn("flex flex-col h-full bg-slate-950/20", className)}>
            <div className="flex-1 min-h-0">
                <ConversationView
                    messages={messages}
                    isAISpeaking={isAISpeaking}
                    isProcessing={false}
                />
            </div>

            <div className="p-4 bg-slate-900/40 border-t border-slate-800/50 backdrop-blur-sm">
                <div className="flex gap-2 max-w-4xl mx-auto">
                    <div className="relative flex-1">
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={handleInput}
                            onKeyDown={handleKeyPress}
                            placeholder="Type your response..."
                            disabled={isProcessing}
                            className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 pr-12 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all resize-none min-h-[44px] overflow-hidden"
                            rows={1}
                        />
                    </div>
                    <Button
                        onClick={handleSend}
                        disabled={!input.trim() || isProcessing}
                        className={cn(
                            "rounded-xl h-[44px] w-[44px] p-0 shrink-0 transition-all duration-300",
                            input.trim() && !isProcessing
                                ? "bg-blue-600 hover:bg-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.3)]"
                                : "bg-slate-800 text-slate-500"
                        )}
                    >
                        {isProcessing ? (
                            <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Send className="w-4 h-4" />
                        )}
                    </Button>
                </div>
                <p className="text-[10px] text-slate-500 mt-2 text-center uppercase tracking-widest font-black">
                    Press Enter to send
                </p>
            </div>
        </div>
    );
}
