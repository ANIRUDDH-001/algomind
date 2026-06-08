/**
 * @codesage
 * @file      src/components/interview/TextInterviewMode.tsx
 * @purpose   Chat-based interface for the technical interview (non-voice mode).
 * @tech      React, Tailwind CSS, Lucide
 * @connects  @/hooks/useDraftPersistence
 * @apis      None
 * @db        None
 * @state     Local draft persistence
 * @env       None
 * @issues    None observed
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

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
        <div className={cn("flex flex-col h-full", className)} style={{ background: 'rgba(10,10,15,0.3)' }}>
            <div className="flex-1 min-h-0">
                <ConversationView
                    messages={messages}
                    isAISpeaking={isAISpeaking}
                    isProcessing={false}
                />
            </div>

            <div className="p-4 backdrop-blur-sm" style={{ background: 'rgba(17,17,24,0.8)', borderTop: '1px solid var(--surface-edge)' }}>
                <div className="flex gap-2 max-w-4xl mx-auto">
                    <div
                        className="relative flex-1"
                        style={{ border: '1px solid var(--surface-edge)', borderRadius: '0.75rem', background: 'var(--surface-base)' }}
                        onFocusCapture={(e) => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'; }}
                        onBlurCapture={(e) => { e.currentTarget.style.borderColor = 'var(--surface-edge)'; }}
                    >
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={handleInput}
                            onKeyDown={handleKeyPress}
                            placeholder="Type your response..."
                            disabled={isProcessing}
                            className="w-full bg-transparent rounded-xl px-4 py-3 pr-12 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none transition-all resize-none min-h-[44px] overflow-hidden"
                            style={{ outline: 'none' }}
                            rows={1}
                        />
                    </div>
                    <Button
                        onClick={handleSend}
                        disabled={!input.trim() || isProcessing}
                        className={cn(
                            "rounded-xl h-[44px] w-[44px] p-0 shrink-0 transition-all duration-300",
                            input.trim() && !isProcessing
                                ? "text-white shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:brightness-110"
                                : "text-zinc-600"
                        )}
                        style={input.trim() && !isProcessing
                            ? { background: 'var(--accent-primary)' }
                            : { background: 'var(--surface-2)' }}
                    >
                        {isProcessing ? (
                            <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Send className="w-4 h-4" />
                        )}
                    </Button>
                </div>
                <p className="text-[10px] text-zinc-500 mt-2 text-center uppercase tracking-widest font-black">
                    Press Enter to send
                </p>
            </div>
        </div>
    );
}
