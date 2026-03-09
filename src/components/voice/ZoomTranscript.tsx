'use client';

import React, { useEffect, useRef } from 'react';

interface ZoomTranscriptProps {
    /** Last AI message content */
    lastAiMessage?: string;
    /** AI TTS is currently playing */
    isSpeaking: boolean;
    /** AI is generating a response */
    isProcessing: boolean;
    /** Finalized STT transcript text */
    transcript: string;
    /** In-progress interim STT text */
    interimTranscript: string;
    /** Mic is actively capturing audio */
    isListening: boolean;
    /** User explicitly stopped mic */
    micStoppedManually: boolean;
    /** Push-to-talk mode (VAD failed or browser STT) */
    isPushToTalk: boolean;
    /** Whisper transcription request is in-flight */
    isTranscribing?: boolean;
}

export function ZoomTranscript({
    lastAiMessage,
    isSpeaking,
    isProcessing,
    transcript,
    interimTranscript,
    isListening,
    micStoppedManually,
    isPushToTalk,
    isTranscribing = false,
}: ZoomTranscriptProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [lastAiMessage, transcript, interimTranscript]);

    // Determine user row display
    const userRowContent = getUserRowContent({
        isProcessing,
        isListening,
        transcript,
        interimTranscript,
        isPushToTalk,
        micStoppedManually,
        isTranscribing,
    });

    return (
        <div ref={scrollRef} className="flex flex-col h-full overflow-y-auto gap-2 p-2 scrollbar-thin scrollbar-thumb-slate-800">
            {/* Kai (AI) row */}
            {(lastAiMessage || isProcessing || isSpeaking) && (
                <div className="rounded-xl bg-zinc-800/60 border border-white/5 p-3 space-y-1.5">
                    <span className="text-[9px] font-black uppercase tracking-[0.15em] text-indigo-400">Kai</span>
                    {lastAiMessage && (
                        <p className="text-[11px] leading-relaxed text-slate-200 whitespace-pre-wrap">
                            {lastAiMessage}
                        </p>
                    )}
                    {isSpeaking && (
                        <div className="flex items-center gap-1.5 mt-1">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
                            </span>
                            <span className="text-[9px] text-indigo-400/80 font-semibold">speaking…</span>
                        </div>
                    )}
                    {isProcessing && !isSpeaking && (
                        <div className="flex items-center gap-1.5 mt-1">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                            </span>
                            <span className="text-[9px] text-amber-400/80 font-semibold">thinking…</span>
                        </div>
                    )}
                </div>
            )}

            {/* User row */}
            <div className="rounded-xl bg-zinc-900/40 border border-white/5 p-3 space-y-1.5">
                <span className="text-[9px] font-black uppercase tracking-[0.15em] text-emerald-400">You</span>
                {userRowContent}
            </div>
        </div>
    );
}

function getUserRowContent(opts: {
    isProcessing: boolean;
    isListening: boolean;
    transcript: string;
    interimTranscript: string;
    isPushToTalk: boolean;
    micStoppedManually: boolean;
    isTranscribing: boolean;
}): React.ReactNode {
    const { isProcessing, isListening, transcript, interimTranscript, isPushToTalk, micStoppedManually, isTranscribing } = opts;

    // Processing state — KAI is thinking
    if (isProcessing) {
        return (
            <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                </span>
                <span className="text-[10px] text-amber-400/80 italic">Kai is thinking…</span>
            </div>
        );
    }

    // Whisper transcription in-flight — show indicator so user knows not to click off
    if (micStoppedManually && isTranscribing) {
        return (
            <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500" />
                </span>
                <span className="text-[10px] text-sky-400/80 italic">transcribing…</span>
            </div>
        );
 }

    // Mic stopped manually with transcript — waiting for user action
    if (micStoppedManually && transcript) {
        return (
            <>
                <p className="text-[11px] leading-relaxed text-slate-200 whitespace-pre-wrap">{transcript}</p>
                {interimTranscript && (
                    <span className="text-[10px] text-slate-500 italic">{interimTranscript}</span>
                )}
                <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[9px] text-yellow-400/80 font-semibold">⏸ tap Send or press mic again</span>
                </div>
            </>
        );
    }

    // Listening with transcript and/or interim
    if (isListening && (transcript || interimTranscript)) {
        return (
            <>
                {transcript && (
                    <p className="text-[11px] leading-relaxed text-slate-200 whitespace-pre-wrap">{transcript}</p>
                )}
                {interimTranscript && (
                    <span className="text-[10px] text-slate-400 italic">{interimTranscript}</span>
                )}
                <div className="flex items-center gap-1.5 mt-1">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    <span className="text-[9px] text-emerald-400/80 font-semibold">listening</span>
                </div>
            </>
        );
    }

    // Listening but no transcript yet
    if (isListening) {
        return (
            <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-[10px] text-emerald-400/80 italic">listening…</span>
            </div>
        );
    }

    // Push-to-talk, mic off
    if (isPushToTalk) {
        return (
            <span className="text-[10px] text-slate-500 italic">tap mic to speak</span>
        );
    }

    // Default idle state
    return (
        <span className="text-[10px] text-slate-500 italic">Start speaking to see transcript…</span>
    );
}
