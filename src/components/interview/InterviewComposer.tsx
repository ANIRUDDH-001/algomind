/**
 * @codesage
 * @file      src/components/interview/InterviewComposer.tsx
 * @purpose   Typed answer box for interviews (text-only mode, and "Type instead" while voice is on).
 * @tech      React, Tailwind CSS, Lucide
 * @connects  @/hooks/useDraftPersistence; rendered by InterviewSession
 * @apis      none
 * @db        none
 * @state     Draft text persisted per tab via useDraftPersistence
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
'use client';

import { useRef } from 'react';
import { Send } from 'lucide-react';
import { useDraftPersistence } from '@/hooks/useDraftPersistence';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface InterviewComposerProps {
    onSend: (text: string) => void;
    disabled?: boolean;
    placeholder?: string;
    autoFocus?: boolean;
    className?: string;
}

export function InterviewComposer({
    onSend,
    disabled = false,
    placeholder = 'Type your answer…',
    autoFocus = false,
    className,
}: InterviewComposerProps) {
    const [input, setInput, clearDraft] = useDraftPersistence('interview-composer');
    const ref = useRef<HTMLTextAreaElement>(null);

    const send = () => {
        const text = input.trim();
        if (!text || disabled) return;
        onSend(text);
        clearDraft();
        if (ref.current) ref.current.style.height = 'auto';
    };

    return (
        <div className={cn('flex gap-2 w-full', className)}>
            <textarea
                ref={ref}
                aria-label="Your answer"
                value={input}
                autoFocus={autoFocus}
                disabled={disabled}
                rows={1}
                placeholder={placeholder}
                onChange={(e) => {
                    e.target.style.height = 'auto';
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
                    setInput(e.target.value);
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        send();
                    }
                }}
                className="flex-1 resize-none rounded-xl bg-zinc-900/60 border border-white/10 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 min-h-[44px]"
            />
            <Button
                aria-label="Send"
                onClick={send}
                disabled={disabled || !input.trim()}
                className="h-[44px] w-[44px] p-0 rounded-xl shrink-0"
            >
                <Send className="w-4 h-4" />
            </Button>
        </div>
    );
}
