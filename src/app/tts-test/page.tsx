'use client';

import React, { useState } from 'react';
import { useVoiceOutput } from '@/hooks/useVoiceOutput';
import { SpeakerControls } from '@/components/voice/SpeakerControls';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const SAMPLE_TEXT = `In computer science, a binary search tree (BST) is a sorted binary tree where each node has a value greater than all nodes in its left subtree and less than those in its right subtree.

\`\`\`javascript
function binarySearch(arr, target) {
  let left = 0;
  let right = arr.length - 1;
  // ... implementation details
}
\`\`\`

The time complexity for searching in a balanced BST is O(log n).`;

export default function TTSTestPage() {
    const {
        speak,
        pause,
        resume,
        stop,
        isSpeaking,
        isPaused,
        availableVoices,
        currentVoice,
        setVoice,
        setRate,
        rate
    } = useVoiceOutput();

    const [text, setText] = useState(SAMPLE_TEXT);

    return (
        <div className="container mx-auto p-8 max-w-2xl space-y-8">
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Voice Output (TTS) Test</h1>
                <p className="text-muted-foreground">Phase 3.2 Verification</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Synthesizer Control</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <SpeakerControls
                        isSpeaking={isSpeaking}
                        isPaused={isPaused}
                        onPause={pause}
                        onResume={resume}
                        onStop={stop}
                        availableVoices={availableVoices}
                        currentVoice={currentVoice}
                        onVoiceChange={setVoice}
                        rate={rate}
                        onRateChange={setRate}
                    />

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Test Text (Markdown aware)</label>
                        <Textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            rows={8}
                            className="font-mono text-sm"
                        />
                    </div>

                    <Button
                        onClick={() => speak(text)}
                        disabled={isSpeaking && !isPaused}
                        className="w-full"
                    >
                        {isSpeaking ? "Restart Speech" : "Speak Text"}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
