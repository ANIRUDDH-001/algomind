import React, { useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface TranscriptViewerProps {
    transcript: string;
    interimTranscript: string;
}

export function TranscriptViewer({
    transcript,
    interimTranscript,
}: TranscriptViewerProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when text changes
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [transcript, interimTranscript]);

    return (
        <Card className="w-full h-full border-none bg-transparent shadow-none">
            <CardContent className="p-3 h-full flex flex-col">
                <div
                    ref={scrollRef}
                    className="h-full overflow-y-auto pr-2 space-y-1 font-medium text-[11px] leading-relaxed scrollbar-thin scrollbar-thumb-slate-800"
                >
                    {transcript ? (
                        <span className="text-slate-200">{transcript}</span>
                    ) : (
                        <span className="text-slate-500 italic">Start speaking to see transcript...</span>
                    )}

                    {interimTranscript && (
                        <span className="text-slate-500 italic ml-1">{interimTranscript}</span>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
