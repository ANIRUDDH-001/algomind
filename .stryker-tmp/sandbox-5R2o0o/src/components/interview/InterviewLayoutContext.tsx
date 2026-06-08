/**
 * @codesage
 * @file      src/components/interview/InterviewLayoutContext.tsx
 * @purpose   Provides context for the interview session state and layout elements.
 * @tech      React Context API
 * @connects  None
 * @apis      None
 * @db        None
 * @state     Context Provider
 * @env       None
 * @issues    None observed
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

//  -- automated unused local suppression
import React, { createContext, useContext } from 'react';
import type { Problem } from '@/lib/supabase/problems';
import type { Message } from '@/hooks/useInterview';
import type { ExecutionResult } from './CodeEditor';
import type { TestCase } from './TestCasePanel';
import type { InterviewConfig } from '@/lib/interview/interview-config';

interface InterviewLayoutContextType {
    activeProblem: Problem;
    limits: any; // Using any for now to avoid deep type imports if not exported, but should be from useInterviewLimits
    isAssessment: boolean;
    handleBackNavigation: () => void;
    messages: Message[];
    voice: any; // from useInterview
    isProcessing: boolean;
    hasStarted: boolean;
    handleStart: () => void;
    handleInterruption: () => void;
    setVoiceErrorDismissed: (val: boolean) => void;
    isLimitLocked: boolean;
    showBadge: boolean;
    lastBadgeSkill: string;
    badgeTriggerPhrase: string;
    readOnly: boolean;
    derivedTestCases: TestCase[];
    executionResult: ExecutionResult | null;
    isCodeRunning: boolean;
    userCode: string;
    setUserCode: (code: string) => void;
    codeLanguage: string;
    setCodeLanguage: (lang: string) => void;
    setIsCodeRunning: (isRunning: boolean) => void;
    setExecutionResult: (res: ExecutionResult | null) => void;
    shareCodeWithAI: (code: string) => void;
    interviewConfig: InterviewConfig;
    
    // For mobile specific
    activeTab: 'problem' | 'interview' | 'code' | 'history';
    setActiveTab: (tab: 'problem' | 'interview' | 'code' | 'history') => void;
    showCodeEditor: boolean;
    setShowCodeEditor: (show: boolean) => void;
    endInterview: () => void;
    handleFinish: () => void;
    roundCount: number;
    isAnalyzing: boolean;
    sendCountdown: number | null;
    ttsError: any;
    micStoppedManually: boolean;
    submitUserResponse: (content: string, metadata: any) => void;
    interviewStartTime: number | null;
    isLimitReached: boolean;
    limitReason: string | null;
    weeklyLimitStatus: any;
    openUpgradeModal: (payload?: any) => void;
    isGuest: boolean;
    guestSession: any;
    showLoginModal: boolean;
    isPushToTalk: boolean;
    isReviewMode: boolean;
}

export const InterviewLayoutContext = createContext<InterviewLayoutContextType | null>(null);

export function useInterviewLayout() {
    const ctx = useContext(InterviewLayoutContext);
    if (!ctx) {
        throw new Error('useInterviewLayout must be used within an InterviewLayoutProvider');
    }
    return ctx;
}
