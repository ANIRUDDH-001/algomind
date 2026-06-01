/**
 * @codesage
 * @file      src/components/interview/layouts/DesktopLayout.tsx
 * @purpose   Desktop-specific layout wrapper for the interview session UI.
 * @tech      React, Tailwind CSS, Lucide
 * @connects  @/components/ui/resizable
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None observed
 * @audit     CODESAGE-v1
 */
import React from 'react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BookOpen, Send, Laptop } from 'lucide-react';
import { cn } from "@/lib/utils";
import { ConversationView } from '../ConversationView';
import { ZoomTranscript } from '@/components/voice/ZoomTranscript';
import { MicPulse } from '@/components/voice/MicPulse';
import { MicrophoneButton } from '@/components/voice/MicrophoneButton';
import { CodeEditor } from '../CodeEditor';
import { TestCasePanel } from '../TestCasePanel';
import { useInterviewLayout } from '../InterviewLayoutContext';
import { InterviewLimitBar } from '../InterviewLimitBar';

export interface DesktopLayoutProps {
    renderProblemCardContent: (showExamples?: boolean, showHeader?: boolean) => React.ReactNode;
}

export function DesktopLayout({ renderProblemCardContent }: DesktopLayoutProps) {
    const {
        activeProblem: problem,
        limits,
        isAssessment,
        handleBackNavigation,
        messages,
        voice,
        isProcessing,
        hasStarted,
        activeProblem,
        handleStart,
        handleInterruption,
        setVoiceErrorDismissed,
        isLimitLocked,
        showBadge,
        lastBadgeSkill,
        badgeTriggerPhrase,
        readOnly,
        derivedTestCases,
        executionResult,
        isCodeRunning,
        userCode,
        setUserCode,
        codeLanguage,
        setCodeLanguage,
        setIsCodeRunning,
        setExecutionResult,
        shareCodeWithAI,
        interviewStartTime,
        interviewConfig,
        roundCount,
        isLimitReached,
        limitReason,
        weeklyLimitStatus,
        openUpgradeModal,
    } = useInterviewLayout();

    return (
        <div className="h-full w-full p-2 animate-in fade-in zoom-in-95 duration-500">
            <ResizablePanelGroup direction="horizontal" className="h-full w-full rounded-2xl overflow-hidden shadow-2xl border" style={{ borderColor: 'var(--surface-edge)' }}>
                {/* Left Panel: Problem Details */}
                <ResizablePanel defaultSize={25} minSize={15}>
                    <div className="h-full w-full min-w-0 overflow-hidden flex flex-col relative" style={{ background: 'var(--surface-1)' }}>
                        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar relative">
                            <div className="sticky top-0 z-10 p-3 pb-0" style={{ background: 'var(--surface-1)' }}>
                            <div className="flex items-center justify-between mb-4">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleBackNavigation}
                                    className="text-zinc-400 hover:text-white hover:bg-white/10 h-8 px-2 -ml-2"
                                >
                                    <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
                                </Button>
                                {isAssessment && (
                                    <div className="px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] uppercase tracking-wider font-bold">
                                        Assessment
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border" style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-edge)' }}>
                                    <BookOpen className="w-4 h-4 text-indigo-400" />
                                </div>
                                <h1 className="text-xl font-bold text-white line-clamp-1">{problem?.title}</h1>
                            </div>
                        </div>

                        <div className="p-4 pt-0">
                            {/* @ts-ignore - renderProblemCardContent is currently passed from parent */}
                            {renderProblemCardContent?.()}
                        </div>
                        </div>
                    </div>
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* Middle Panel: AI Interaction & Voice */}
                <ResizablePanel defaultSize={40} minSize={20}>
                    <div className="h-full w-full min-w-0 overflow-hidden flex flex-col relative border-x" style={{ background: 'radial-gradient(ellipse at top, rgba(99,102,241,0.08) 0%, transparent 60%), var(--surface-0)', borderColor: 'var(--surface-edge)' }}>
                        <div className="flex-1 min-h-0 relative">
                            {/* Desktop Timer / Limit Bar */}
                            {hasStarted && !isAssessment && interviewStartTime && (
                                <div className="absolute top-2 right-2 z-30">
                                    <InterviewLimitBar
                                        startTime={interviewStartTime}
                                        maxMs={interviewConfig.maxDurationMs}
                                        roundCount={roundCount}
                                        maxRounds={interviewConfig.maxTurnsPerProblem}
                                        isLimitReached={isLimitReached}
                                        limitReason={limitReason as 'rounds' | 'time' | null}
                                        weeklyUsage={weeklyLimitStatus && typeof weeklyLimitStatus.limit === 'number' && weeklyLimitStatus.limit > 0 ? {
                                            sessionsUsed: weeklyLimitStatus.sessionsUsed,
                                            limit: weeklyLimitStatus.limit,
                                            allowed: weeklyLimitStatus.allowed,
                                        } : undefined}
                                        onUpgrade={() => openUpgradeModal({
                                            reason: 'Upgrade to keep practicing with unlimited sessions.',
                                            sessionsUsed: weeklyLimitStatus?.sessionsUsed,
                                            limit: weeklyLimitStatus?.limit ?? undefined,
                                        })}
                                    />
                                </div>
                            )}

                            {hasStarted ? (
                                <div className="absolute inset-0 pt-12 px-4 overflow-hidden">
                                    <ConversationView messages={messages} isAISpeaking={voice.isSpeaking} isProcessing={isProcessing} />
                                </div>
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="text-center space-y-4 px-6 animate-in fade-in slide-in-from-bottom-4 zoom-in-95 duration-700">
                                        <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-6 shadow-[0_0_40px_rgba(99,102,241,0.2)]">
                                            <MicPulse state="idle" />
                                        </div>
                                        <h3 className="text-2xl font-bold text-white">Ready to begin?</h3>
                                        <p className="text-zinc-400 max-w-[280px] text-sm leading-relaxed mx-auto">
                                            I'll be conducting your technical interview today. Whenever you're ready, just say hello.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Center Ambient Glow */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-500/10 blur-[100px] pointer-events-none rounded-full" />
                        </div>

                        <div className="h-[280px] shrink-0 border-t flex flex-col relative z-20" style={{ background: 'var(--surface-1)', borderColor: 'var(--surface-edge)' }}>
                            <div className="flex-1 min-h-0 p-4">
                                <ZoomTranscript 
                                    kaiMessage={messages.filter(m => m.role === 'assistant').pop()?.content || null}
                                    userTranscript={voice.transcript}
                                    isKaiSpeaking={voice.isSpeaking}
                                    isUserSpeaking={voice.isListening}
                                    isThinking={isProcessing}
                                    conceptSlug={activeProblem.id}
                                    conceptIcon={<Laptop className="w-5 h-5 text-indigo-400" />}
                                    exchangeCount={messages.length}
                                />
                            </div>

                            <div className="h-20 shrink-0 border-t flex items-center justify-center bg-black/40 px-6 backdrop-blur-xl" style={{ borderColor: 'var(--surface-edge)' }}>
                                {!hasStarted ? (
                                    <Button
                                        size="lg"
                                        className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold h-12 rounded-xl"
                                        onClick={handleStart}
                                        data-tour="begin-button"
                                        data-testid="begin-interview-btn"
                                    >
                                        Begin Interview Experience
                                    </Button>
                                ) : (
                                    <MicrophoneButton
                                        isListening={voice.isListening}
                                        error={voice.error}
                                        onClick={() => {
                                            if (voice.isListening || isProcessing || voice.isSpeaking) {
                                                handleInterruption();
                                            } else {
                                                voice.startListening();
                                            }
                                        }}
                                        onRetry={() => {
                                            setVoiceErrorDismissed(false);
                                            voice.startListening();
                                        }}
                                        disabled={isProcessing || isLimitLocked}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* Right Panel: Code & Output */}
                <ResizablePanel defaultSize={35} minSize={20}>
                    <ResizablePanelGroup direction="vertical" className="h-full w-full min-w-0 overflow-hidden">
                        <ResizablePanel defaultSize={65} minSize={40}>
                            <div className="h-full p-2 pb-1" style={{ background: 'var(--surface-1)' }}>
                                <div className="h-full rounded-xl border overflow-hidden relative shadow-inner" style={{ borderColor: 'var(--surface-edge)', background: 'var(--surface-0)' }}>
                                    <div className="absolute top-3 right-3 z-30 pointer-events-none">
                                        {showBadge && (
                                            <div
                                                key={lastBadgeSkill + badgeTriggerPhrase}
                                                className="cognitive-badge-in relative overflow-hidden rounded-xl border px-3 py-2.5 bg-white/10 backdrop-blur-3xl shadow-[0_16px_56px_rgba(0,0,0,0.45)] ring-1 ring-white/20"
                                                style={{ borderColor: 'rgba(255,255,255,0.28)' }}
                                            >
                                                <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-indigo-300/16 via-white/4 to-violet-300/12" />
                                                <p className="text-[10px] uppercase tracking-wider text-indigo-200 font-bold">Cognitive signal</p>
                                                <p className="text-xs text-white font-semibold">{lastBadgeSkill}</p>
                                                <p className="text-[11px] text-zinc-100/90">{badgeTriggerPhrase}</p>
                                            </div>
                                        )}
                                    </div>
                                    <CodeEditor
                                        onCodeChange={setUserCode}
                                        defaultLanguage={codeLanguage}
                                        initialCode={userCode}
                                        problemTitle={problem?.title}
                                        onLanguageChange={setCodeLanguage}
                                        onExecutionStart={() => {
                                            setIsCodeRunning(true);
                                            setExecutionResult(null);
                                        }}
                                        onExecutionResult={(result) => {
                                            setExecutionResult(result);
                                            setIsCodeRunning(false);
                                        }}
                                        readOnly={readOnly}
                                        runDisabled={isLimitLocked || !hasStarted}
                                    />
                                </div>
                            </div>
                        </ResizablePanel>

                        <ResizableHandle withHandle />

                        <ResizablePanel defaultSize={35} minSize={20}>
                            <div className="h-full p-2 pt-1" style={{ background: 'var(--surface-1)' }}>
                                <div className="h-full rounded-xl border flex flex-col overflow-hidden shadow-inner" style={{ borderColor: 'var(--surface-edge)', background: 'var(--surface-0)' }}>
                                    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-2">
                                        <TestCasePanel
                                            testCases={derivedTestCases}
                                            executionResult={executionResult}
                                            isRunning={isCodeRunning}
                                        />
                                    </div>
                                    <div className="p-2 border-t bg-black/20" style={{ borderColor: 'var(--surface-edge)' }}>
                                        <Button
                                            onClick={() => shareCodeWithAI(userCode)}
                                            disabled={!userCode.trim() || isProcessing || voice.isSpeaking || isLimitLocked || !hasStarted}
                                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-9 rounded-lg text-sm"
                                        >
                                            <Send className="w-3.5 h-3.5 mr-2" />
                                            Submit to Kai
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </ResizablePanel>
                    </ResizablePanelGroup>
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    );
}
