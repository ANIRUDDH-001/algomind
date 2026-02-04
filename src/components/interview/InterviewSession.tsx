import React, { useEffect, useState } from 'react';
import { useInterview } from '@/hooks/useInterview';
import { useAssessment } from '@/hooks/useAssessment';
import { useProgress } from '@/hooks/useProgress';
import { useAuth } from '@/components/auth/AuthProvider';
import { ConversationView } from './ConversationView';
import { MicrophoneButton } from '@/components/voice/MicrophoneButton';
import { MicPulse } from '@/components/voice/MicPulse';
import { TranscriptViewer } from '@/components/voice/TranscriptViewer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StopCircle, Send, Flag } from 'lucide-react';
import { cn } from "@/lib/utils";
import { AssessmentLoader } from '@/components/assessment/AssessmentLoader';
import { ReportCard } from '@/components/assessment/ReportCard';
import { SkillBadge } from '@/components/assessment/SkillBadge';
import { ProgressStore } from '@/lib/assessment/progress-store';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import type { Problem } from '@/lib/supabase/problems';

interface InterviewSessionProps {
    problem: Problem;
}

export function InterviewSession({ problem }: InterviewSessionProps) {
    const { user } = useAuth();
    const {
        state,
        messages,
        isProcessing,
        startInterview,
        submitUserResponse,
        voice
    } = useInterview();

    const { analyzeSession, isAnalyzing, result, reset: resetAssessment } = useAssessment();
    const { addSession } = useProgress();

    const [hasStarted, setHasStarted] = useState(false);
    const [showBadge, setShowBadge] = useState(false);
    const [lastBadgeSkill, setLastBadgeSkill] = useState<any>('pattern-recognition');
    const [error, setError] = useState<string | null>(null);

    const handleStart = () => {
        setHasStarted(true);
        startInterview(problem.title, problem.description);
    };

    const handleFinish = async () => {
        if (messages.length < 2) {
            setError("Please interact with the AI at least once before ending the session to get a valid analysis.");
            return;
        }

        console.log("Starting analysis flow...");
        // Trigger Analysis
        const transcript = messages.map(m => ({ role: m.role, content: m.content }));
        const assessment = await analyzeSession(`sess-${Date.now()}`, { title: problem.title, description: problem.description, difficulty: problem.difficulty }, transcript);

        if (assessment) {
            console.log("✅ Analysis successful, saving to progress store...");
            const store = new ProgressStore();
            const skillScores: any = {};
            Object.entries(assessment.skills).forEach(([id, s]) => {
                skillScores[id] = s.score;
            });

            const userId = user?.id || 'guest-user';
            console.log("💾 Saving session for user:", userId);

            await addSession({
                sessionId: assessment.sessionId,
                userId,
                problemId: problem.id,
                problemDifficulty: problem.difficulty,
                timestamp: new Date(),
                duration: 600, // mock
                skills: skillScores,
                overallScore: store.calculateWeightedScore(skillScores)
            });

            console.log("🎉 Session saved successfully!");
        }
    };

    // Demo Skill Badge logic: Trigger a badge on first user message as a "wow" factor
    useEffect(() => {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg && lastMsg.role === 'user' && !showBadge && messages.length > 2) {
            setLastBadgeSkill(messages.length > 4 ? 'algorithmic-thinking' : 'pattern-recognition');
            setShowBadge(true);
            const timer = setTimeout(() => setShowBadge(false), 4000);
            return () => clearTimeout(timer);
        }
    }, [messages]);

    if (result) {
        return <ReportCard assessment={result} onClose={resetAssessment} />;
    }

    return (
        <div className="h-full flex flex-col p-6 overflow-hidden bg-slate-950">
            {isAnalyzing && <AssessmentLoader />}
            {error && <ErrorBanner message={error} onClose={() => setError(null)} />}
            {voice.error && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-bounce">
                    <ErrorBanner
                        message={`Mic Problem: ${voice.error}. Try clicking the mic button to restart.`}
                        onClose={() => { }} // Hook handles clearing state usually
                    />
                </div>
            )}

            {/* Real-time Overlay for Badges */}
            <div className="fixed top-6 right-6 z-[60] flex flex-col gap-4 pointer-events-none">
                <SkillBadge skillId={lastBadgeSkill} points={2} shown={showBadge} />
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0 overflow-hidden">
                {/* Left Panel: Problem (3/12) */}
                <div className="lg:col-span-3 flex flex-col gap-4 min-h-0">
                    <Card className="flex-1 bg-slate-900/30 backdrop-blur-sm border-slate-800/50 overflow-hidden flex flex-col shadow-2xl">
                        <CardHeader className="bg-slate-950/40 border-b border-slate-800/50 py-3 shrink-0">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-sm font-bold text-white truncate">
                                    {problem.title}
                                </CardTitle>
                                <Badge className={cn(
                                    "text-[10px] px-2 py-0 h-5 shrink-0",
                                    problem.difficulty === 'easy' && 'bg-green-500/20 text-green-400 border-green-500/30',
                                    problem.difficulty === 'medium' && 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
                                    problem.difficulty === 'hard' && 'bg-red-500/20 text-red-400 border-red-500/30'
                                )}>
                                    {problem.difficulty}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 overflow-y-auto flex-1 text-slate-300 text-xs leading-relaxed scrollbar-thin scrollbar-thumb-slate-800 space-y-4">
                            {/* Problem Description */}
                            <div className="whitespace-pre-wrap">{problem.description}</div>

                            {/* Examples - LeetCode Style */}
                            {problem.examples && problem.examples.slice(0, 2).map((example, idx) => (
                                <div key={idx} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                                    <p className="text-xs font-bold text-slate-400 mb-2">Example {idx + 1}:</p>
                                    <div className="space-y-1 font-mono text-[11px]">
                                        <p><span className="text-slate-500">Input:</span> <span className="text-blue-400">{example.input}</span></p>
                                        <p><span className="text-slate-500">Output:</span> <span className="text-green-400">{example.output}</span></p>
                                        {example.explanation && (
                                            <p className="text-slate-400 font-sans mt-1"><span className="text-slate-500">Explanation:</span> {example.explanation}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    <Card className="shrink-0 bg-slate-900/30 backdrop-blur-sm border-slate-800/50 p-4">
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Status</span>
                                <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-400 capitalize text-[10px] px-2 py-0 h-5">
                                    {state.replace('-', ' ')}
                                </Badge>
                            </div>
                            {hasStarted && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleFinish}
                                    disabled={isAnalyzing}
                                    className="w-full h-8 text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-white hover:bg-red-500 border-red-500/30 transition-all duration-300 shadow-lg shadow-red-900/10"
                                >
                                    <Flag className="w-3 h-3 mr-1.5" /> End & Analyze
                                </Button>
                            )}
                        </div>
                    </Card>
                </div>

                {/* Center Panel: Interaction (5/12) */}
                <div className="lg:col-span-5 flex flex-col gap-4 min-h-0">
                    <Card className="flex-1 bg-slate-900/20 backdrop-blur-md border-slate-800/50 shadow-xl overflow-hidden relative flex flex-col">
                        <CardContent className="p-0 flex-1 flex flex-col">
                            {!hasStarted ? (
                                <div className="flex-1 flex items-center justify-center p-8">
                                    <Button
                                        size="lg"
                                        className="w-full max-w-sm bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white font-bold h-16 text-lg shadow-[0_0_20px_rgba(59,130,246,0.2)] transition-all duration-300"
                                        onClick={handleStart}
                                    >
                                        Begin Interview Experience
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex-1 relative flex flex-col items-center justify-center p-6 lg:p-10">
                                    <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
                                        <MicPulse
                                            state={
                                                voice.isListening ? 'listening' :
                                                    isProcessing ? 'processing' :
                                                        voice.isSpeaking ? 'speaking' :
                                                            'idle'
                                            }
                                        />
                                    </div>

                                    <div className="relative z-20 flex flex-col items-center gap-8 w-full">
                                        <div className="flex flex-col items-center gap-6">
                                            <div className="relative group">
                                                <MicrophoneButton
                                                    isListening={voice.isListening}
                                                    onClick={voice.isListening ? () => {
                                                        voice.stopListening();
                                                    } : voice.startListening}
                                                    disabled={isProcessing || voice.isSpeaking}
                                                    error={voice.error}
                                                    className={cn(
                                                        "transition-all duration-500 scale-[1.2] shadow-2xl",
                                                        voice.isListening && "ring-8 ring-blue-500/10 shadow-[0_0_50px_rgba(59,130,246,0.6)]"
                                                    )}
                                                />
                                            </div>

                                            <div className="text-center space-y-2 bg-slate-950/60 backdrop-blur-xl px-4 py-2 rounded-xl border border-slate-800/80 shadow-inner">
                                                <p className="text-xs font-bold text-white tracking-wide">
                                                    {voice.isListening ? "I'M LISTENING..." :
                                                        isProcessing ? "THINKING..." :
                                                            voice.isSpeaking ? "AI IS SPEAKING..." :
                                                                "READY FOR YOU"}
                                                </p>
                                                <div className="flex items-center justify-center gap-2">
                                                    <div className={cn(
                                                        "w-1 h-1 rounded-full animate-pulse",
                                                        voice.isListening ? "bg-blue-500" : "bg-slate-600"
                                                    )} />
                                                    <p className="text-[9px] uppercase tracking-widest text-slate-500 font-black">
                                                        {voice.isListening ? "Auto-Submit Active" : "Waiting for mic"}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* AI Speaking - Prominent Stop Section */}
                                        {voice.isSpeaking && (
                                            <div className="flex flex-col items-center gap-4 p-4 bg-purple-950/30 border border-purple-500/30 rounded-2xl animate-pulse">
                                                <div className="flex items-center gap-3">
                                                    <div className="relative">
                                                        <div className="absolute inset-0 bg-purple-600 rounded-full animate-ping opacity-50" />
                                                        <div className="relative w-4 h-4 bg-purple-500 rounded-full" />
                                                    </div>
                                                    <span className="text-sm font-bold text-purple-300">AI is speaking...</span>
                                                </div>
                                                <Button
                                                    size="lg"
                                                    onClick={voice.stopSpeaking}
                                                    className="bg-red-600 hover:bg-red-700 text-white font-bold text-sm px-8 shadow-lg shadow-red-900/30 transition-all"
                                                >
                                                    <StopCircle className="mr-2 h-5 w-5" /> Stop Speaking
                                                </Button>
                                            </div>
                                        )}

                                        <div className="w-full space-y-3 px-4">
                                            <div className="flex justify-between items-center px-1">
                                                <label className="text-[9px] text-slate-500 uppercase tracking-[0.2em] font-black">Live Transcript</label>
                                                {(voice.transcript || voice.interimTranscript) && (
                                                    <Badge variant="outline" className="text-[8px] border-emerald-500/30 bg-emerald-500/5 text-emerald-400 h-4">Active</Badge>
                                                )}
                                            </div>
                                            <div className="h-32 bg-slate-950/30 rounded-xl border border-slate-800/40 backdrop-blur-sm overflow-hidden">
                                                <TranscriptViewer
                                                    transcript={voice.transcript}
                                                    interimTranscript={voice.interimTranscript}
                                                    isEditable={false}
                                                />
                                            </div>

                                            {voice.transcript && !voice.isListening && (
                                                <Button
                                                    className="w-full mt-2 bg-blue-600 hover:bg-blue-500 text-white font-bold h-10 text-xs shadow-lg shadow-blue-900/20"
                                                    onClick={() => submitUserResponse(voice.transcript, { title: problem.title, content: problem.description })}
                                                    disabled={isProcessing}
                                                >
                                                    <Send className="w-3 h-3 mr-2" /> Send Message
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Right Panel: History (4/12) */}
                <div className="lg:col-span-4 flex flex-col h-full min-h-0">
                    <div className="mb-2 flex justify-between items-center px-1">
                        <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Interview History</h2>
                        {messages.length > 0 && (
                            <Badge variant="secondary" className="bg-slate-800/50 text-slate-400 text-[9px]">{messages.length} turns</Badge>
                        )}
                    </div>
                    <div className="flex-1 bg-slate-900/20 backdrop-blur-sm rounded-2xl border border-slate-800/50 overflow-hidden shadow-2xl">
                        <ConversationView
                            messages={messages}
                            isAISpeaking={voice.isSpeaking}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
