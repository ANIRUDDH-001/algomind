/**
 * @codesage
 * @file      src/components/interview/layouts/MobileLayout.tsx
 * @purpose   Mobile-specific layout wrapper for the interview session UI.
 * @tech      React, Tailwind CSS, Lucide
 * @connects  @/hooks/useSwipeNavigation
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None observed
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, Mic, Code, MessageSquare, Send } from 'lucide-react';
import { cn } from "@/lib/utils";
import { CodeEditor } from '../CodeEditor';
import { useInterviewLayout } from '../InterviewLayoutContext';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';

export interface MobileLayoutProps {
    renderProblemCardContent: (showExamples?: boolean, showHeader?: boolean) => React.ReactNode;
    renderControlsCard: () => React.ReactNode;
    renderInteractionArea: (isMobile: boolean) => React.ReactNode;
    renderHistoryArea: () => React.ReactNode;
}

const MOBILE_TABS = ['problem', 'interview', 'code', 'history'] as const;
type MobileTab = typeof MOBILE_TABS[number];

export function MobileLayout({
    renderProblemCardContent,
    renderControlsCard,
    renderInteractionArea,
    renderHistoryArea
}: MobileLayoutProps) {
    const {
        activeTab,
        setActiveTab,
        activeProblem,
        voice,
        isProcessing,
        hasStarted,
        isLimitLocked,
        userCode,
        setUserCode,
        codeLanguage,
        setCodeLanguage,
        setIsCodeRunning,
        setExecutionResult,
        shareCodeWithAI,
    } = useInterviewLayout();

    const { handlers: swipeHandlers } = useSwipeNavigation({
        tabs: MOBILE_TABS,
        activeTab: activeTab as MobileTab,
        onTabChange: (tab) => setActiveTab(tab),
        disabled: activeTab === 'code',
    });

    return (
        <div
            className="lg:hidden flex-1 w-full h-full relative"
            {...swipeHandlers}
            style={{ touchAction: 'pan-y' }}
        >
            <div className="absolute inset-0 flex flex-col overflow-hidden pb-14">
                {activeTab === 'problem' && (
                    <div className="flex-1 w-full h-full overflow-y-auto p-4 custom-scrollbar flex flex-col animate-in fade-in slide-in-from-left-4">
                        <div className="flex-1">{renderProblemCardContent()}</div>
                        <div className="mt-4 shrink-0">{renderControlsCard()}</div>
                    </div>
                )}

                {activeTab === 'interview' && (
                    <div className="flex-1 w-full h-full animate-in fade-in zoom-in-95">
                        {renderInteractionArea(true)}
                    </div>
                )}

                {activeTab === 'code' && (
                    <div className="flex-1 w-full h-full p-2 animate-in fade-in slide-in-from-bottom-4">
                        <Card className="h-full flex flex-col shadow-xl rounded-2xl overflow-hidden border" style={{ background: 'var(--surface-1)', borderColor: 'var(--surface-edge)' }}>
                            <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--surface-edge)' }}>
                                <div className="flex items-center gap-1.5 text-indigo-400 font-bold text-[12px]">
                                    <Code className="w-3.5 h-3.5" /> Code
                                </div>
                                <button onClick={() => setActiveTab('interview')} className="w-6 h-6 rounded-md flex items-center justify-center text-zinc-500 hover:text-white transition-colors">
                                    ×
                                </button>
                            </div>
                            <div className="flex-1 flex flex-col gap-2 p-2">
                                <CodeEditor
                                    onCodeChange={setUserCode}
                                    defaultLanguage={codeLanguage}
                                    initialCode={userCode}
                                    problemTitle={activeProblem?.title}
                                    onLanguageChange={setCodeLanguage}
                                    onExecutionStart={() => {
                                        setIsCodeRunning(true);
                                        setExecutionResult(null);
                                    }}
                                    onExecutionResult={(result) => {
                                        setExecutionResult(result);
                                        setIsCodeRunning(false);
                                    }}
                                    runDisabled={isLimitLocked || !hasStarted}
                                />
                                <Button onClick={() => shareCodeWithAI(userCode)} disabled={!userCode.trim() || isProcessing || voice.isSpeaking || isLimitLocked} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-10 shadow-lg shrink-0 rounded-xl">
                                    <Send className="w-3.5 h-3.5 mr-1.5" /> Submit to Kai
                                </Button>
                            </div>
                        </Card>
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="flex-1 w-full h-full overflow-y-auto p-4 custom-scrollbar flex flex-col animate-in fade-in slide-in-from-right-4">
                        {renderHistoryArea()}
                    </div>
                )}

                {/* ✅ FIXED: Visible clickable tab bar */}
                <div
                    role="tablist"
                    aria-label="Interview mobile panels"
                    className="absolute bottom-0 left-0 right-0 z-50 flex border-t"
                    style={{
                        background: 'var(--surface-1)',
                        borderColor: 'var(--surface-edge)',
                        paddingBottom: 'env(safe-area-inset-bottom, 0px)'  // iPhone home bar
                    }}
                >
                    {([
                        { id: 'problem', label: 'Problem', icon: BookOpen },
                        { id: 'interview', label: 'Voice', icon: Mic },
                        { id: 'code', label: 'Code', icon: Code },
                        { id: 'history', label: 'Chat', icon: MessageSquare },
                    ] as const).map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            onClick={() => setActiveTab(id as MobileTab)}
                            role="tab"
                            aria-label={`${label} tab`}
                            aria-selected={activeTab === id}
                            className={cn(
                                "flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-all text-[10px] font-bold uppercase tracking-wider",
                                activeTab === id
                                    ? "text-indigo-400"
                                    : "text-zinc-500 hover:text-zinc-300"
                            )}
                        >
                            <Icon className={cn(
                                "w-5 h-5 transition-all",
                                activeTab === id ? "text-indigo-400" : "text-zinc-500"
                            )} />
                            <span>{label}</span>
                            {/* Active indicator dot */}
                            {activeTab === id && (
                                <div className="w-1 h-1 rounded-full bg-indigo-400 mt-0.5" />
                            )}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
