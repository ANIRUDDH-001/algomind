/* eslint-disable react-hooks/purity */
'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useInterview } from '@/hooks/useInterview';
import { useRouter } from 'next/navigation';
import { ConversationView } from '@/components/interview/ConversationView';
import { MicrophoneButton } from '@/components/voice/MicrophoneButton';
import { MicPulse } from '@/components/voice/MicPulse';
import { CodeEditor } from '@/components/interview/CodeEditor';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, Code, StopCircle, ArrowRight } from 'lucide-react';
import type { Problem } from '@/lib/supabase/problems';
import { recordLearnSession } from '@/app/actions/learn';
import { useAuth } from '@/components/auth/AuthProvider';

interface LearnSessionClientProps {
    problem: Problem;
    sessionCount: number;
    fromSessionId?: string;
}

export function LearnSessionClient({ problem, sessionCount, fromSessionId }: LearnSessionClientProps) {
    const router = useRouter();
    const { user } = useAuth();

    const [hasStarted, setHasStarted] = useState(false);
    const startTimeRef = useRef<number>(Date.now());
    const initialGreetingSent = useRef(false);

    const {
        messages,
        isProcessing,
        voice,
        submitUserResponse,
        loadTranscript,
        handleInterruption,
        startInterview
    } = useInterview({
        config: { mode: 'practice' } as any,
        apiEndpoint: '/api/learn/chat',
    });

    // Start immediately
    useEffect(() => {
        if (!hasStarted && !initialGreetingSent.current) {
            setHasStarted(true);
            initialGreetingSent.current = true;

            // Initialize interview context
            startInterview(problem.title, problem.description || '', undefined, undefined, undefined, problem.id);

            // Inject the first assistant message manually and speak it
            const introMsg = `Namaste! Main Kai hoon, aapka DSA tutor. Aaj hum ${problem.title} samjhenge.`;
            // Add a small delay so state machine is ready
            setTimeout(() => {
                loadTranscript([{ role: 'assistant', content: introMsg, timestamp: new Date() }]);
                if (voice.speak) voice.speak(introMsg);
            }, 500);
        }
    }, [hasStarted, problem.title, problem.description, problem.id, loadTranscript, voice, startInterview]);

    const handlePracticeMode = async () => {
        if (user) {
            const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
            await recordLearnSession({
                userId: user.id,
                problemId: problem.id,
                conceptsCovered: problem.tags || [],
                duration
            });
        }
        router.push(`/interview?problemId=${problem.id}&learnSessionId=current`);
    };

    const renderProblemCardContent = () => {
        return (
            <Card className="h-full flex flex-col shadow-2xl border-none bg-transparent">
                <CardHeader className="bg-black/20 rounded-2xl border border-white/5 py-3 shrink-0 mb-4">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <CardTitle className="text-sm font-bold text-white truncate">
                                {problem.title}
                            </CardTitle>
                            <Badge className="bg-indigo-500/15 text-indigo-400 border-indigo-500/25 text-[10px] px-2 py-0 h-5">
                                {problem.difficulty}
                            </Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0 flex-1 text-zinc-300 text-[13px] lg:text-[14px] leading-relaxed space-y-3 lg:space-y-4 min-h-0 overflow-y-auto custom-scrollbar">
                    <div className="whitespace-pre-wrap font-medium">{problem.description}</div>
                    <div className="space-y-3 pt-2">
                        {problem.examples && problem.examples.map((example, idx) => (
                            <div key={idx} className="rounded-xl p-3 lg:p-4 border border-white/5 shadow-inner group transition-colors bg-zinc-900/40">
                                <p className="text-[12px] font-black uppercase tracking-wider text-zinc-500 mb-2 group-hover:text-indigo-400 transition-colors">Example {idx + 1}:</p>
                                <div className="space-y-2 font-mono text-xs">
                                    <div className="flex flex-col sm:flex-row sm:gap-2">
                                        <span className="text-zinc-500 shrink-0">Input:</span>
                                        <span className="text-indigo-300 break-all">{example.input}</span>
                                    </div>
                                    <div className="flex flex-col sm:flex-row sm:gap-2">
                                        <span className="text-zinc-500 shrink-0">Output:</span>
                                        <span className="text-emerald-400 break-all">{example.output}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    };

    return (
        <div className="h-[100dvh] flex flex-col w-full bg-[#0a0a0a] overflow-hidden">
            {/* Header */}
            <div className="h-16 shrink-0 border-b border-white/5 bg-black/40 flex items-center justify-between px-6">
                <div className="flex items-center gap-3">
                    <Badge variant="outline" className="border-indigo-500/30 bg-indigo-500/10 text-indigo-400 px-3 py-1">
                        🌟 Learning Mode
                    </Badge>
                    <span className="text-zinc-500 text-xs font-medium">
                        Kai remembers {sessionCount} previous session{sessionCount !== 1 ? 's' : ''}
                    </span>
                </div>
                <Button
                    onClick={handlePracticeMode}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-9 text-xs shadow-lg shadow-indigo-900/20"
                >
                    Practice in English <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* LEFT PANEL - Conversation */}
                <div className="w-[55%] flex flex-col border-r border-white/5 bg-black/20 p-6 relative">
                    <div className="flex-1 min-h-0 border rounded-2xl bg-zinc-900/40 border-white/5 overflow-hidden flex flex-col">
                        <ConversationView
                            messages={messages}
                            isAISpeaking={voice.isSpeaking}
                            vadEnabled={true}
                            onInterrupt={() => {
                                voice.stopSpeaking();
                                handleInterruption();
                            }}
                            onContinuePreviousResponse={() => {
                                submitUserResponse('Please continue.', { title: problem.title, content: problem.description || '' });
                            }}
                            onUserSpeaking={() => {
                                if (!voice.isListening && !isProcessing && !voice.isSpeaking) {
                                    voice.startListening();
                                }
                            }}
                        />
                    </div>

                    {/* Controls */}
                    <div className="shrink-0 pt-6 flex flex-col items-center justify-center gap-4">
                        <div className="flex items-center justify-center gap-4 relative">
                            <MicrophoneButton
                                isListening={voice.isListening}
                                onClick={() => {
                                    if (voice.isListening) {
                                        voice.stopListening();
                                    } else if (!isProcessing && !voice.isSpeaking) {
                                        voice.startListening();
                                    }
                                }}
                                disabled={isProcessing || voice.isSpeaking}
                            />
                            <div className="absolute top-1/2 -translate-y-1/2 -right-16">
                                <MicPulse
                                    size="compact"
                                    state={voice.isListening ? 'listening' : isProcessing ? 'processing' : voice.isSpeaking ? 'speaking' : 'idle'}
                                />
                            </div>
                        </div>
                        {voice.isSpeaking && (
                            <Button
                                size="sm"
                                onClick={voice.stopSpeaking}
                                className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs h-8 shadow-xl shadow-red-900/40 transition-all rounded-full"
                            >
                                <StopCircle className="mr-1.5 h-4 w-4" /> Stop Kai
                            </Button>
                        )}
                    </div>
                </div>

                {/* RIGHT PANEL - Problem & Code */}
                <div className="w-[45%] flex flex-col bg-[#0a0a0a]">
                    <div className="h-1/2 p-6 border-b border-white/5">
                        {renderProblemCardContent()}
                    </div>
                    <div className="h-1/2 p-4">
                        <Card className="h-full flex flex-col shadow-2xl rounded-2xl overflow-hidden border border-white/5 bg-zinc-900/40">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                                <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
                                    <Code className="w-4 h-4" /> Code Visualization
                                </div>
                                <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-[10px]">Read-Only</Badge>
                            </div>
                            <div className="flex-1 flex flex-col p-4 opacity-70 pointer-events-none">
                                <CodeEditor
                                    onCodeChange={() => { }}
                                    defaultLanguage="python"
                                    initialCode={`# Kai will help you visualize the code here.\n# Follow along with audio instructions.\n\n`}
                                    readOnly={true}
                                />
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
