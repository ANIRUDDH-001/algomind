// @vitest-environment jsdom
import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── jsdom polyfills ───
global.ResizeObserver = class {
    observe() { }
    unobserve() { }
    disconnect() { }
};
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
        matches: false, media: query, onchange: null,
        addListener: vi.fn(), removeListener: vi.fn(),
        addEventListener: vi.fn(), removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});
Element.prototype.scrollIntoView = vi.fn();

// ─── Mock Radix Tabs to simple HTML (avoids jsdom pointer event issues) ───
vi.mock('@/components/ui/tabs', () => {
    // A minimal controlled Tabs implementation that works in jsdom
    const TabsCtx = React.createContext<{
        value: string;
        onValueChange: (v: string) => void;
    }>({ value: '', onValueChange: () => { } });

    return {
        Tabs: ({ value, onValueChange, children, className }: {
            value: string; onValueChange: (v: string) => void;
            children: React.ReactNode; className?: string;
        }) => (
            <TabsCtx.Provider value={{ value, onValueChange }}>
                <div data-slot="tabs" className={className}>{children}</div>
            </TabsCtx.Provider>
        ),
        TabsList: ({ children, className }: { children: React.ReactNode; className?: string }) => (
            <div data-slot="tabs-list" role="tablist" className={className}>{children}</div>
        ),
        TabsTrigger: ({ value, children, className }: {
            value: string; children: React.ReactNode; className?: string;
        }) => {
            const ctx = React.useContext(TabsCtx);
            return (
                <button
                    role="tab"
                    aria-selected={ctx.value === value}
                    data-state={ctx.value === value ? 'active' : 'inactive'}
                    onClick={() => ctx.onValueChange(value)}
                    className={className}
                >
                    {children}
                </button>
            );
        },
        TabsContent: ({ value, children, className }: {
            value: string; children: React.ReactNode; className?: string;
        }) => {
            const ctx = React.useContext(TabsCtx);
            if (ctx.value !== value) return null;
            return (
                <div role="tabpanel" data-state="active" className={className}>
                    {children}
                </div>
            );
        },
    };
});

// ─── Mock ResizablePanel (crashes in jsdom) ───
vi.mock('@/components/ui/resizable', () => ({
    ResizablePanelGroup: ({ children, className }: { children: React.ReactNode; className?: string }) => (
        <div data-testid="resizable-group" className={className}>{children}</div>
    ),
    ResizablePanel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    ResizableHandle: () => <div data-testid="resizable-handle" />,
}));

// ─── Mock all hooks and modules ───
vi.mock('next/navigation', () => ({
    useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/components/auth/AuthProvider', () => ({
    useAuth: () => ({ user: { id: 'test-user' } }),
}));

vi.mock('@/hooks/useInterview', () => ({
    useInterview: () => ({
        state: 'idle', messages: [], isProcessing: false,
        startInterview: vi.fn(), resetInterview: vi.fn(),
        submitUserResponse: vi.fn(), handleInterruption: vi.fn(),
        loadTranscript: vi.fn(),
        voice: {
            isListening: false, isSpeaking: false, error: null,
            startListening: vi.fn(), stopListening: vi.fn(), stopSpeaking: vi.fn(),
            transcript: '', interimTranscript: '',
        },
    }),
}));

vi.mock('@/hooks/useAssessment', () => ({
    useAssessment: () => ({
        analyzeSession: vi.fn(), isAnalyzing: false, result: null, reset: vi.fn(),
    }),
}));

vi.mock('@/hooks/useInterviewLimits', () => ({
    useInterviewLimits: () => ({
        incrementTurn: vi.fn(), startTimer: vi.fn(), stopTimer: vi.fn(),
        isTimeUp: false, isTurnsUp: false, timeRemaining: 1200,
        formattedElapsed: '00:00', shouldShowTurnWarning: false, turnsRemaining: 20,
    }),
}));

vi.mock('@/hooks/useGuestTrial', () => ({
    useGuestTrial: () => ({
        recordTurn: vi.fn(), isTrialComplete: false, reset: vi.fn(), turnsUsed: 0,
    }),
    GUEST: { MAX: 5 },
}));

vi.mock('@/hooks/useFeatureFlag', () => ({
    useFeatureFlag: () => ({ enabled: false }),
    useFeatureFlagWithSupport: () => ({ enabled: false, supported: false }),
}));

vi.mock('@/hooks/useVoiceActivityDetection', () => ({
    useVoiceActivityDetection: () => ({ isListening: false, error: null }),
}));

vi.mock('@/lib/utils/device-detection', () => ({
    isMobileDevice: vi.fn(() => false),
}));

vi.mock('@/lib/supabase/client', () => {
    const mock = {
        from: () => ({ select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
        auth: {
            getUser: () => Promise.resolve({ data: { user: null }, error: null }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
        },
    };
    return { createBrowserSupabase: () => mock, getSupabase: () => mock, isSupabaseConfigured: () => false };
});

vi.mock('@/lib/analytics/voice-analytics', () => ({
    voiceAnalytics: { track: vi.fn() },
}));

vi.mock('@/lib/voice/interruption-manager', () => ({
    InterruptionManager: class {
        handleUserSpeechStart() { return 'WAIT'; }
        handleUserSpeechEnd() { }
        handleAIResponseStart() { }
        handleAIResponseComplete() { }
        cancelAISpeech() { }
        reset() { }
        removeAllListeners() { }
        on() { return () => { }; }
    },
}));

vi.mock('@/lib/interview/silent-observer', () => ({
    SilentObserver: class {
        analyze() { return Promise.resolve(null); }
        reset() { }
    },
}));

vi.mock('@/app/actions/save-session', () => ({
    saveInterviewSession: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('sonner', () => ({
    toast: { loading: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

// ─── Stub heavy child components ───

vi.mock('../CodeEditor', () => ({
    CodeEditor: () => <div data-testid="mock-code-editor">Mock Code Editor</div>,
}));

vi.mock('../CompanyModeSelector', () => ({
    CompanyModeSelector: () => <div data-testid="mock-company-selector">Company Mode</div>,
}));

vi.mock('../VoiceOnboarding', () => ({ VoiceOnboarding: () => null }));
vi.mock('../GuestRegisterModal', () => ({ GuestRegisterModal: () => null }));
vi.mock('../SilentObserverNudge', () => ({ SilentObserverNudge: () => null }));
vi.mock('../TextInterviewMode', () => ({ TextInterviewMode: () => null }));

// ─── Import component under test ───
import { InterviewSession } from '../InterviewSession';
import * as deviceDetection from '@/lib/utils/device-detection';

const mockProblem = {
    id: 'prob-1',
    title: 'Two Sum',
    description: 'Find two numbers that add up to target.',
    difficulty: 'easy' as const,
    examples: [],
    tags: [],
    hints: [],
};

// ─── Tests ───
describe('InterviewSession BUG-V7-05 Regression', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('Mobile: Code tab switches without MobileWarning modal', async () => {
        // 1. Render in mobile viewport (390px)
        Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 390 });
        vi.mocked(deviceDetection.isMobileDevice).mockReturnValue(true);

        render(<InterviewSession problem={mockProblem} />);

        // Get all tab triggers from our mock Tabs
        const allTabs = screen.getAllByRole('tab');
        const codeTab = allTabs.find(t => t.textContent?.includes('Code'));
        expect(codeTab).toBeDefined();

        // 2. Click the Code tab
        await act(async () => {
            fireEvent.click(codeTab!);
        });

        // 3. MobileWarning modal does NOT appear
        expect(screen.queryByText(/MobileWarning/i)).toBeNull();
        expect(screen.queryByText(/Not recommended on mobile/i)).toBeNull();

        // 4. The Code tab content IS rendered (our mock CodeEditor)
        expect(screen.getByTestId('mock-code-editor')).toBeDefined();

        // 5. activeTab changed to 'code' (aria-selected on the trigger)
        expect(codeTab!.getAttribute('aria-selected')).toBe('true');

        // Code tab has a "Share Code with Kai" button
        expect(screen.getAllByRole('button', { name: /Share Code with Kai/i }).length).toBeGreaterThan(0);

        // 6. Click the Interview tab
        const interviewTab = allTabs.find(t => t.textContent?.includes('Interview'));
        expect(interviewTab).toBeDefined();
        await act(async () => {
            fireEvent.click(interviewTab!);
        });

        // 7. Interview tab content is shown
        expect(interviewTab!.getAttribute('aria-selected')).toBe('true');
        expect(screen.getAllByRole('button', { name: /Begin Interview Experience/i }).length).toBeGreaterThan(0);
    });

    it('Desktop: Code Editor toggle works without warning', async () => {
        // 8. Desktop viewport (1440px)
        Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1440 });
        vi.mocked(deviceDetection.isMobileDevice).mockReturnValue(false);

        render(<InterviewSession problem={mockProblem} />);

        // Click "Begin Interview Experience" to start
        const beginBtns = screen.getAllByRole('button', { name: /Begin Interview Experience/i });
        expect(beginBtns.length).toBeGreaterThan(0);
        await act(async () => {
            fireEvent.click(beginBtns[0]);
        });

        // The desktop mode toggle (Interview / Code Editor) appears
        const codeEditorToggle = screen.getByRole('button', { name: /Code Editor/i });
        expect(codeEditorToggle).toBeDefined();

        // Click Code Editor toggle
        await act(async () => {
            fireEvent.click(codeEditorToggle);
        });

        // 9. No MobileWarning appears
        expect(screen.queryByText(/Mobile warning/i)).toBeNull();
        expect(screen.queryByText(/Not recommended on mobile/i)).toBeNull();

        // Code Editor is visible
        expect(screen.getAllByTestId('mock-code-editor').length).toBeGreaterThan(0);
    });
});
