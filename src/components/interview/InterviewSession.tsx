import React, { useEffect, useState } from 'react';
import { useInterview } from '@/hooks/useInterview';
import { useAssessment } from '@/hooks/useAssessment';
import { useProgress } from '@/hooks/useProgress';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { ConversationView } from './ConversationView';
import { MicrophoneButton } from '@/components/voice/MicrophoneButton';
import { MicPulse } from '@/components/voice/MicPulse';
import { TranscriptViewer } from '@/components/voice/TranscriptViewer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { StopCircle, Send, Flag, BookOpen, Mic, MessageSquare, ArrowLeft } from 'lucide-react';
import { cn } from "@/lib/utils";
import { AssessmentLoader } from '@/components/assessment/AssessmentLoader';
import { ReportCard } from '@/components/assessment/ReportCard';
import { SkillBadge } from '@/components/assessment/SkillBadge';
import { ProgressStore } from '@/lib/assessment/progress-store';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import type { Problem } from '@/lib/supabase/problems';

interface InterviewSessionProps {
    problem: Problem;
    initialTranscript?: { role: string; content: string }[];
    readOnly?: boolean;
}

export function InterviewSession({ problem, initialTranscript, readOnly = false }: InterviewSessionProps) {
    const router = useRouter();
    const { user } = useAuth();
    const {
        state,
        messages,
        isProcessing,
        startInterview,
        resetInterview,
        submitUserResponse,
        loadTranscript,
        voice
    } = useInterview();

    const { analyzeSession, isAnalyzing, result, reset: resetAssessment } = useAssessment();
    const { addSession } = useProgress();

    const [hasStarted, setHasStarted] = useState(false);
    const [showBadge, setShowBadge] = useState(false);
    const [lastBadgeSkill, setLastBadgeSkill] = useState<any>('pattern-recognition');
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('interview');

    // Track session start time for duration calculation
    const startTimeRef = React.useRef<number>(0);
    // Track if transcript has been loaded to prevent infinite loops
    const transcriptLoadedRef = React.useRef(false);

    // Debugging and Reset on Problem Change
    console.log('[InterviewSession RENDER] Props:', {
        problemId: problem.id,
        initialTranscriptLen: initialTranscript?.length,
        readOnly
    });

    useEffect(() => {
        console.log('Rendering InterviewSession for problem:', problem.id, problem.title);
        // Reset local and hook state when problem changes
        setHasStarted(false);
        setError(null);
        resetInterview();
        transcriptLoadedRef.current = false; // Reset loaded state
    }, [problem.id, problem.title, resetInterview]);

    // Handle Read-Only Mode / Resume Session
    useEffect(() => {
        console.log('[InterviewSession] Checking transcript load:', {
            readOnly,
            hasInitialTranscript: !!initialTranscript,
            transcriptLength: initialTranscript?.length,
            alreadyLoaded: transcriptLoadedRef.current
        });

        if (readOnly && initialTranscript && initialTranscript.length > 0 && !transcriptLoadedRef.current) {
            console.log('📖 [SESSION] Loading read-only transcript:', initialTranscript.length, 'messages');
            const msgs = initialTranscript.map(t => ({
                role: t.role as 'user' | 'assistant' | 'system',
                content: t.content,
                timestamp: new Date() // Placeholder as we don't store per-msg timestamp yet
            }));
            loadTranscript(msgs);
            setHasStarted(true);
            transcriptLoadedRef.current = true;
        }
    }, [readOnly, initialTranscript, loadTranscript]);

    const handleStart = () => {
        setHasStarted(true);
        startTimeRef.current = Date.now(); // Record start time
        console.log('⏱️ [SESSION] Started at:', new Date().toISOString());
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

            // Calculate actual session duration
            const actualDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);
            console.log('⏱️ [SESSION] Duration:', actualDuration, 'seconds');
            console.log('📝 [SESSION] Transcript entries:', transcript.length);
            console.log("💾 Saving session for user:", userId);

            await addSession({
                sessionId: assessment.sessionId,
                userId,
                problemId: problem.id,
                problemDifficulty: problem.difficulty,
                timestamp: new Date(),
                duration: actualDuration,
                skills: skillScores,
                overallScore: store.calculateWeightedScore(skillScores),
                transcript: transcript
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

    // --- Sub-components to avoid code duplication between Mobile/Desktop ---

    const ProblemCardContent = ({ isMobile = false }: { isMobile?: boolean }) => {
        // Debug: Log the external_url on render
        const leetcodeUrl = problem.external_url || `https://leetcode.com/problemset/all/?search=${encodeURIComponent(problem.title)}`;
        console.log('🔗 [LINK DEBUG] Problem external_url:', problem.external_url);
        console.log('🔗 [LINK DEBUG] Final leetcode URL:', leetcodeUrl);

        return (
            <Card className={cn(
                "bg-slate-900/30 backdrop-blur-sm border-slate-800/50 overflow-hidden flex flex-col shadow-2xl",
                !isMobile ? "h-full" : "h-auto"
            )}>
                <CardHeader className="bg-slate-950/40 border-b border-slate-800/50 py-3 shrink-0">
                    <div className="flex flex-col gap-1">
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
                        <a
                            href={leetcodeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => {
                                console.log('🔗 [LINK DEBUG] Link clicked!');
                                console.log('🔗 [LINK DEBUG] href:', leetcodeUrl);
                                console.log('🔗 [LINK DEBUG] event:', e);
                                // Don't prevent default - let the link open
                            }}
                            className="relative z-50 cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-lg text-[11px] font-bold text-blue-400 hover:text-blue-300 hover:border-blue-500/50 hover:from-blue-600/30 hover:to-purple-600/30 transition-all shadow-lg shadow-blue-500/10"
                        >
                            🔗 Practice on LeetCode
                        </a>
                    </div>
                </CardHeader>
                <CardContent className={cn(
                    "p-3 lg:p-5 flex-1 text-slate-300 text-sm lg:text-[15px] leading-relaxed space-y-3 lg:space-y-6 min-h-0",
                    !isMobile ? "overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent" : "overflow-visible"
                )}>
                    <div className="whitespace-pre-wrap font-medium">{problem.description}</div>
                    <div className="space-y-3 lg:space-y-4 pt-2">
                        {problem.examples && problem.examples.map((example, idx) => (
                            <div key={idx} className="bg-slate-800/40 rounded-xl p-3 lg:p-4 border border-slate-700/50 shadow-inner group hover:border-blue-500/30 transition-colors">
                                <p className="text-[12px] lg:text-[13px] font-black uppercase tracking-wider text-slate-500 mb-2 lg:mb-3 group-hover:text-blue-400 transition-colors">Example {idx + 1}:</p>
                                <div className="space-y-2 font-mono text-xs lg:text-sm">
                                    <div className="flex flex-col sm:flex-row sm:gap-2">
                                        <span className="text-slate-500 shrink-0 select-none">Input:</span>
                                        <span className="text-blue-300 break-all">{example.input}</span>
                                    </div>
                                    <div className="flex flex-col sm:flex-row sm:gap-2">
                                        <span className="text-slate-500 shrink-0 select-none">Output:</span>
                                        <span className="text-emerald-400 break-all">{example.output}</span>
                                    </div>
                                    {example.explanation && (
                                        <div className="pt-2 mt-2 border-t border-slate-700/30">
                                            <p className="text-slate-400 font-sans text-[12px] lg:text-[13px] leading-normal">
                                                <span className="text-slate-500 font-bold uppercase text-[10px] tracking-widest block mb-1">Explanation</span>
                                                {example.explanation}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card >
        );
    };


    const InteractionArea = ({ isMobile = false }) => (
        <Card className={cn(
            "bg-slate-900/20 backdrop-blur-md border-slate-800/50 shadow-xl overflow-hidden relative flex flex-col",
            !isMobile ? "flex-1 h-full min-h-0 lg:min-h-[300px]" : "h-auto min-h-[400px] shrink-0"
        )}>
            <CardContent className="p-0 flex-1 flex flex-col h-full">
                {!hasStarted ? (
                    <div className="flex-1 flex items-center justify-center p-6 lg:p-8">
                        <Button
                            size="lg"
                            className="w-full max-w-sm bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white font-bold h-14 lg:h-16 text-base lg:text-lg shadow-[0_0_20px_rgba(59,130,246,0.2)] transition-all duration-300"
                            onClick={handleStart}
                        >
                            Begin Interview Experience
                        </Button>
                    </div>
                ) : (
                    <div className="flex-1 relative flex flex-col items-center justify-center p-4 lg:p-10 h-full">
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

                        <div className="relative z-20 flex flex-col items-center gap-6 lg:gap-8 w-full max-w-md mx-auto h-full justify-center">
                            {/* Top-right Status Badge - moved from fixed position */}
                            <div className="absolute top-2 right-2 z-30">
                                <div className="bg-slate-800/90 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-slate-700 text-xs">
                                    <div className="flex items-center gap-2">
                                        {voice.isSpeaking && (
                                            <span className="flex items-center gap-1.5 text-purple-400">
                                                <span className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
                                                AI Speaking
                                            </span>
                                        )}
                                        {voice.isListening && !voice.isSpeaking && (
                                            <span className="flex items-center gap-1.5 text-blue-400">
                                                <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                                                Listening
                                            </span>
                                        )}
                                        {isProcessing && !voice.isSpeaking && (
                                            <span className="flex items-center gap-1.5 text-yellow-400">
                                                <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                                                Processing
                                            </span>
                                        )}
                                        {!voice.isSpeaking && !voice.isListening && !isProcessing && (
                                            <span className="flex items-center gap-1.5 text-green-400">
                                                <span className="w-2 h-2 bg-green-400 rounded-full" />
                                                Ready
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Status Indicator */}
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

                            {/* Microphone / Interactions */}
                            {!readOnly && (
                                <div className="flex justify-center pb-6">
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
                                        className={cn(
                                            "transition-all duration-300 scale-[1.2] lg:scale-[1.4] shadow-2xl",
                                            voice.isListening && "ring-4 lg:ring-8 ring-blue-500/10 shadow-[0_0_50px_rgba(59,130,246,0.6)]"
                                        )}
                                    />
                                </div>
                            )}

                            {/* Read-Only Banner */}
                            {readOnly && (
                                <div className="flex justify-center pb-6">
                                    <div className="bg-slate-800/80 px-4 py-2 rounded-full border border-slate-700 text-slate-400 text-sm font-medium flex items-center gap-2">
                                        <BookOpen className="w-4 h-4" />
                                        Session Completed (Read-Only)
                                    </div>
                                </div>
                            )}

                            {/* Stop AI Speaking Button - High Visibility */}
                            {voice.isSpeaking && (
                                <div className="z-50 w-full flex justify-center animate-in fade-in slide-in-from-bottom-4 duration-300">
                                    <Button
                                        size="lg"
                                        onClick={voice.stopSpeaking}
                                        className="bg-red-600 hover:bg-red-700 text-white font-bold text-sm h-12 shadow-xl shadow-red-900/40 transition-all px-8 rounded-full"
                                    >
                                        <StopCircle className="mr-2 h-5 w-5" /> Stop Speaking
                                    </Button>
                                </div>
                            )}

                            {/* Transcript Area */}
                            <div className="w-full space-y-3 px-1 lg:px-4 flex-1 min-h-0 flex flex-col">
                                <div className="flex justify-between items-center px-1">
                                    <label className="text-[9px] text-slate-500 uppercase tracking-[0.2em] font-black">Live Transcript</label>
                                    {(voice.transcript || voice.interimTranscript) && (
                                        <Badge variant="outline" className="text-[8px] border-emerald-500/30 bg-emerald-500/5 text-emerald-400 h-4">Active</Badge>
                                    )}
                                </div>
                                <div className="flex-1 min-h-[100px] bg-slate-950/30 rounded-xl border border-slate-800/40 backdrop-blur-sm overflow-hidden flex flex-col relative">
                                    <div className="absolute inset-0 p-1">
                                        <TranscriptViewer
                                            transcript={voice.transcript}
                                            interimTranscript={voice.interimTranscript}
                                            isEditable={false}
                                        />
                                    </div>
                                </div>

                                {voice.transcript && !voice.isListening && (
                                    <Button
                                        className="w-full mt-2 bg-blue-600 hover:bg-blue-500 text-white font-bold h-12 lg:h-10 text-xs shadow-lg shadow-blue-900/20"
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
    );

    const ControlsCard = () => (
        <Card className="shrink-0 bg-slate-900/30 backdrop-blur-sm border-slate-800/50 p-2.5 lg:p-4">
            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Status</span>
                    <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-400 capitalize text-[10px] px-2 py-0 h-5">
                        {state.replace('-', ' ')}
                    </Badge>
                </div>
                {(hasStarted || readOnly) && (
                    !readOnly ? (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleFinish}
                            disabled={isAnalyzing}
                            className="w-full h-10 lg:h-8 text-[11px] lg:text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-white hover:bg-red-500 border-red-500/30 transition-all duration-300 shadow-lg shadow-red-900/10"
                        >
                            <Flag className="w-4 h-4 lg:w-3 lg:h-3 mr-1.5" /> End & Analyze
                        </Button>
                    ) : (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push('/dashboard?tab=history')}
                            className="w-full h-10 lg:h-8 text-[11px] lg:text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:bg-slate-800 border-slate-700 transition-all duration-300"
                        >
                            <ArrowLeft className="w-4 h-4 lg:w-3 lg:h-3 mr-1.5" /> Back
                        </Button>
                    )
                )}
            </div>
        </Card>
    );

    const HistoryArea = ({ isMobile = false }: { isMobile?: boolean }) => (
        <div className={cn("flex flex-col", !isMobile ? "h-full" : "h-auto min-h-[60vh]")}>
            <div className="mb-2 flex justify-between items-center px-1">
                <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Interview History</h2>
                {messages.length > 0 && (
                    <Badge variant="secondary" className="bg-slate-800/50 text-slate-400 text-[9px]">{messages.length} turns</Badge>
                )}
            </div>
            <div className={cn(
                "bg-slate-900/20 backdrop-blur-sm rounded-2xl border border-slate-800/50 shadow-2xl",
                !isMobile ? "flex-1 overflow-hidden min-h-[200px] lg:min-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent" : "h-auto overflow-visible min-h-[200px]"
            )}>
                <ConversationView
                    messages={messages}
                    isAISpeaking={voice.isSpeaking}
                />
            </div>
        </div>
    );

    // --- Main Render ---

    return (
        <div className="min-h-[100dvh] lg:h-full flex flex-col bg-slate-950 pt-16 lg:pt-6">
            {isAnalyzing && <AssessmentLoader />}
            {error && <ErrorBanner message={error} onClose={() => setError(null)} />}
            {voice.error && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-bounce">
                    <ErrorBanner
                        message={`Mic Problem: ${voice.error}. Try clicking the mic button to restart.`}
                        onClose={() => { }}
                    />
                </div>
            )}

            {/* Real-time Overlay for Badges */}
            <div className="fixed top-6 right-6 z-[60] flex flex-col gap-4 pointer-events-none">
                <SkillBadge skillId={lastBadgeSkill} points={2} shown={showBadge} />
            </div>


            {/* Force Mobile Scrollbars Style - Touch Friendly Indicator Look */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media (max-width: 1024px) {
                    .mobile-scroll::-webkit-scrollbar {
                        width: 4px; /* Thin, like a native indicator */
                        background: transparent;
                    }
                    .mobile-scroll::-webkit-scrollbar-thumb {
                        background: rgba(148, 163, 184, 0.5); /* slate-400/50 - Subtle but visible */
                        border-radius: 10px; /* Fully rounded caps */
                    }
                }
            `}} />

            {/* MOBILE LAYOUT (< 1024px) - Tabbed Interface with FIXED VIEWPORT */}
            <div
                className="lg:hidden fixed top-16 bottom-[72px] left-0 right-0 z-0 bg-slate-950"
                onTouchStart={(e) => {
                    const touch = e.touches[0];
                    e.currentTarget.dataset.touchStartX = touch.clientX.toString();
                    e.currentTarget.dataset.touchStartY = touch.clientY.toString();
                }}
                onTouchEnd={(e) => {
                    const touch = e.changedTouches[0];
                    const startX = parseFloat(e.currentTarget.dataset.touchStartX || '0');
                    const startY = parseFloat(e.currentTarget.dataset.touchStartY || '0');
                    const diffX = touch.clientX - startX;
                    const diffY = touch.clientY - startY;

                    // Only trigger if horizontal swipe is dominant (> 60px) and more horizontal than vertical
                    if (Math.abs(diffX) > 60 && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
                        const tabs = ['problem', 'interview', 'chat'];
                        const currentIndex = tabs.indexOf(activeTab);

                        if (diffX > 0 && currentIndex > 0) {
                            setActiveTab(tabs[currentIndex - 1]); // Swipe Right -> Previous Tab
                        } else if (diffX < 0 && currentIndex < tabs.length - 1) {
                            setActiveTab(tabs[currentIndex + 1]); // Swipe Left -> Next Tab
                        }
                    }
                }}
            >
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full">
                    {/* 
                        FIXED VIEWPORT CONTAINER 
                        Content will scroll INSIDE this box, independent of Navbars.
                        No more overlap. No more massive padding hacks.
                    */}
                    <div className="w-full h-full relative">

                        {/* INTERVIEW TAB */}
                        <TabsContent value="interview" className="w-full h-full m-0 data-[state=inactive]:hidden overflow-y-auto mobile-scroll">
                            <div className="p-3 pb-6 min-h-full">
                                <InteractionArea isMobile={true} />
                                <div className="mt-4">
                                    <ControlsCard />
                                </div>
                            </div>
                        </TabsContent>

                        {/* PROBLEM TAB */}
                        <TabsContent value="problem" className="w-full h-full m-0 data-[state=inactive]:hidden overflow-y-auto mobile-scroll">
                            <div className="p-3 pb-6 min-h-full">
                                <ProblemCardContent isMobile={true} />
                            </div>
                        </TabsContent>

                        {/* CHAT TAB */}
                        <TabsContent value="chat" className="w-full h-full m-0 data-[state=inactive]:hidden overflow-y-auto mobile-scroll">
                            <div className="p-2 pb-6 min-h-full">
                                <HistoryArea isMobile={true} />
                            </div>
                        </TabsContent>
                    </div>

                    {/* Bottom Floating Tab Bar - Fixed Outside the scroll area */}
                    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-gradient-to-t from-slate-950 via-slate-950 to-transparent">
                        <div className="bg-slate-950 border border-slate-800 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-1.5 ring-1 ring-white/10">
                            <TabsList className="w-full h-12 bg-transparent grid grid-cols-3 gap-1">
                                <TabsTrigger value="problem" className="flex flex-col items-center justify-center gap-1 h-full text-slate-500 data-[state=active]:bg-slate-900 data-[state=active]:text-blue-400 rounded-xl transition-all data-[state=active]:shadow-lg hover:text-slate-300">
                                    <BookOpen className="w-4 h-4" />
                                    <span className="text-[10px] font-bold">Problem</span>
                                </TabsTrigger>
                                <TabsTrigger value="interview" className="flex flex-col items-center justify-center gap-1 h-full text-slate-500 data-[state=active]:bg-slate-900 data-[state=active]:text-blue-400 rounded-xl transition-all data-[state=active]:shadow-lg hover:text-slate-300">
                                    <Mic className="w-4 h-4" />
                                    <span className="text-[10px] font-bold">Interview</span>
                                </TabsTrigger>
                                <TabsTrigger value="chat" className="flex flex-col items-center justify-center gap-1 h-full text-slate-500 data-[state=active]:bg-slate-900 data-[state=active]:text-blue-400 rounded-xl transition-all data-[state=active]:shadow-lg hover:text-slate-300">
                                    <MessageSquare className="w-4 h-4" />
                                    <span className="text-[10px] font-bold">Chat</span>
                                </TabsTrigger>
                            </TabsList>
                        </div>
                    </div>
                </Tabs>
            </div>

            {/* DESKTOP LAYOUT (>= 1024px) - Draggable Resizable Interface */}
            <div className="hidden lg:flex flex-1 flex-col p-4 overflow-hidden h-full max-h-[calc(100vh-64px)]">
                <ResizablePanelGroup direction="horizontal" className="h-full rounded-xl border border-slate-800/50 bg-slate-950/30">

                    {/* Left Panel: Problem */}
                    <ResizablePanel defaultSize="25" minSize="20" maxSize="40" id="panel-problem">
                        <div className="flex flex-col gap-4 h-full p-2">
                            <div className="flex-1 min-h-0 overflow-hidden">
                                <ProblemCardContent />
                            </div>
                            <ControlsCard />
                        </div>
                    </ResizablePanel>

                    <ResizableHandle withHandle className="bg-slate-800/50 hover:bg-blue-500/50 transition-colors w-1.5" />

                    {/* Center Panel: Interaction */}
                    <ResizablePanel defaultSize="50" minSize="30" id="panel-interaction">
                        <div className="h-full p-2">
                            <InteractionArea />
                        </div>
                    </ResizablePanel>

                    <ResizableHandle withHandle className="bg-slate-800/50 hover:bg-blue-500/50 transition-colors w-1.5" />

                    {/* Right Panel: History */}
                    <ResizablePanel defaultSize="25" minSize="20" maxSize="40" id="panel-history">
                        <div className="h-full p-2">
                            <HistoryArea />
                        </div>
                    </ResizablePanel>

                </ResizablePanelGroup>
            </div>
        </div>
    );
}
