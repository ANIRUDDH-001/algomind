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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { StopCircle, Send, Flag, BookOpen, Mic, MessageSquare } from 'lucide-react';
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
        resetInterview,
        submitUserResponse,
        voice
    } = useInterview();

    const { analyzeSession, isAnalyzing, result, reset: resetAssessment } = useAssessment();
    const { addSession } = useProgress();

    const [hasStarted, setHasStarted] = useState(false);
    const [showBadge, setShowBadge] = useState(false);
    const [lastBadgeSkill, setLastBadgeSkill] = useState<any>('pattern-recognition');
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('interview');

    // Debugging and Reset on Problem Change
    useEffect(() => {
        console.log('Rendering InterviewSession for problem:', problem.id, problem.title);
        // Reset local and hook state when problem changes
        setHasStarted(false);
        setError(null);
        resetInterview();
    }, [problem.id, problem.title, resetInterview]);

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

    // --- Sub-components to avoid code duplication between Mobile/Desktop ---

    const ProblemCardContent = () => (
        <Card className="bg-slate-900/30 backdrop-blur-sm border-slate-800/50 overflow-hidden flex flex-col shadow-2xl h-full">
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
            <CardContent className="p-3 lg:p-5 overflow-y-auto flex-1 text-slate-300 text-sm lg:text-[15px] leading-relaxed space-y-3 lg:space-y-6">
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
        </Card>
    );

    const InteractionArea = ({ isMobile = false }) => (
        <Card className="flex-1 bg-slate-900/20 backdrop-blur-md border-slate-800/50 shadow-xl overflow-hidden relative flex flex-col h-full min-h-[300px]">
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

                            {/* Main Mic Button */}
                            <div className="relative group my-2">
                                <MicrophoneButton
                                    isListening={voice.isListening}
                                    onClick={voice.isListening ? () => {
                                        voice.stopListening();
                                    } : voice.startListening}
                                    disabled={isProcessing || voice.isSpeaking}
                                    error={voice.error}
                                    className={cn(
                                        "transition-all duration-500 scale-[1.2] lg:scale-[1.4] shadow-2xl",
                                        voice.isListening && "ring-4 lg:ring-8 ring-blue-500/10 shadow-[0_0_50px_rgba(59,130,246,0.6)]"
                                    )}
                                />
                            </div>

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
                {hasStarted && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleFinish}
                        disabled={isAnalyzing}
                        className="w-full h-10 lg:h-8 text-[11px] lg:text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-white hover:bg-red-500 border-red-500/30 transition-all duration-300 shadow-lg shadow-red-900/10"
                    >
                        <Flag className="w-4 h-4 lg:w-3 lg:h-3 mr-1.5" /> End & Analyze
                    </Button>
                )}
            </div>
        </Card>
    );

    const HistoryArea = () => (
        <div className="flex flex-col h-full">
            <div className="mb-2 flex justify-between items-center px-1">
                <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Interview History</h2>
                {messages.length > 0 && (
                    <Badge variant="secondary" className="bg-slate-800/50 text-slate-400 text-[9px]">{messages.length} turns</Badge>
                )}
            </div>
            <div className="flex-1 bg-slate-900/20 backdrop-blur-sm rounded-2xl border border-slate-800/50 overflow-hidden shadow-2xl min-h-[200px] lg:min-h-[300px]">
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

            {/* MOBILE LAYOUT (< 1024px) - Tabbed Interface */}
            <div
                className="lg:hidden flex-1 flex flex-col overflow-hidden"
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

                    // Only trigger if horizontal swipe is dominant and significant
                    if (Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY)) {
                        const tabs = ['problem', 'interview', 'chat'];
                        const currentIndex = tabs.indexOf(activeTab);

                        if (diffX > 0 && currentIndex > 0) {
                            // Swipe Right -> Go left (e.g. Interview -> Problem)
                            setActiveTab(tabs[currentIndex - 1]);
                        } else if (diffX < 0 && currentIndex < tabs.length - 1) {
                            // Swipe Left -> Go right (e.g. Interview -> Chat)
                            setActiveTab(tabs[currentIndex + 1]);
                        }
                    }
                }}
            >
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col h-full">
                    {/* Tab Content Area - Takes available space */}
                    <div className="flex-1 overflow-hidden relative p-3">
                        <TabsContent value="interview" className="h-full m-0 data-[state=inactive]:hidden flex flex-col gap-3 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="flex-1 min-h-0">
                                <InteractionArea isMobile={true} />
                            </div>
                            <div className="shrink-0 mb-28"> {/* Increased bottom padding to clear floating bar */}
                                <ControlsCard />
                            </div>
                        </TabsContent>

                        <TabsContent value="problem" className="h-full m-0 data-[state=inactive]:hidden overflow-hidden mb-28 animate-in fade-in slide-in-from-left-4 duration-300">
                            <ProblemCardContent />
                        </TabsContent>

                        <TabsContent value="chat" className="h-full m-0 data-[state=inactive]:hidden mb-28 px-1 animate-in fade-in slide-in-from-right-4 duration-300">
                            <HistoryArea />
                        </TabsContent>
                    </div>

                    {/* Bottom Floating Tab Bar */}
                    <div className="fixed bottom-6 left-4 right-4 z-50">
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
