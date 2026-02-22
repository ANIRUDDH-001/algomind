'use client';

import React, { useEffect } from 'react';
import { notFound } from 'next/navigation';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { MicrophoneButton } from '@/components/voice/MicrophoneButton';
import { TranscriptViewer } from '@/components/voice/TranscriptViewer';
import {  } from '@/components/ui/card';

export default function VoiceTestPage() {
    if (process.env.NODE !== 'development') {
        notFound();
    }

    const {
        isListening,
        transcript,
        interimTranscript,
        startListening,
        stopListening,
        resetTranscript,
        isSupported,
        error
    } = useVoiceInput();

    // Handle keyboard shortcut (Space to toggle)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' && e.target === document.body) {
                e.preventDefault(); // Prevent scrolling
                if (isListening) {
                    stopListening();
                } else {
                    startListening();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isListening, startListening, stopListening]);

    return (
        <div className="container mx-auto p-8 max-w-4xl space-y-8">
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Voice Input Pipeline Test</h1>
                <p className="text-muted-foreground">Phase 3.1 Verification</p>
            </div>

            {!isSupported && (
                <div className="bg-destructive/10 text-destructive p-4 rounded-md border border-destructive/20 text-center">
                    Web Speech API is not supported in this browser. Please use Chrome or Edge.
                </div>
            )}

            {error && (
                <div className="bg-destructive/10 text-destructive p-4 rounded-md border border-destructive/20 text-center">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-8 items-start">
                {/* Controls */}
                <div className="flex flex-col items-center justify-center space-y-8 py-8 bg-card rounded-xl border shadow-sm">
                    <MicrophoneButton
                        isListening={isListening}
                        onClick={isListening ? stopListening : startListening}
                        error={error}
                        disabled={!isSupported}
                    />

                    <div className="text-sm text-center text-muted-foreground px-4">
                        <p>Try saying DSA terms:</p>
                        <ul className="mt-2 space-y-1 font-mono text-xs">
                            <li>&quot;binary search tree&quot;</li>
                            <li>&quot;dynamic programming&quot;</li>
                            <li>&quot;O(n squared)&quot;</li>
                        </ul>
                    </div>

                    <button
                        onClick={resetTranscript}
                        className="text-xs text-red-500 hover:underline"
                    >
                        Clear Transcript
                    </button>
                </div>

                {/* Transcript View */}
                <div className="h-[400px]">
                    <TranscriptViewer
                        transcript={transcript}
                        interimTranscript={interimTranscript}
                    />
                </div>
            </div>
        </div>
    );
}
