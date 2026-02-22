// @vitest-environment jsdom
/**
 * Dashboard page: tests that the DashboardContent component correctly
 * handles null RPC responses, empty sessions, sessions with null
 * overallScore, and normal session data via the useProgress hook.
 */
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { UserProgress, SessionHistory } from '@/types/assessment';

// ─── jsdom polyfills ───
Element.prototype.scrollIntoView = vi.fn();
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((q: string) => ({
        matches: false, media: q, onchange: null,
        addListener: vi.fn(), removeListener: vi.fn(),
        addEventListener: vi.fn(), removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});
global.ResizeObserver = class {
    observe() { }
    unobserve() { }
    disconnect() { }
};

// ─── Mock useProgress return value (controlled per test) ───
let mockProgressReturn: {
    progress: UserProgress | null;
    isLoading: boolean;
    error: string | null;
    history: SessionHistory[];
};

vi.mock('@/hooks/useProgress', () => ({
    useProgress: () => ({
        ...mockProgressReturn,
        refresh: vi.fn(),
        addSession: vi.fn(),
        isSaving: false,
    }),
}));

// ─── Mock Next.js navigation ───
vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
}));

// ─── Mock auth ───
vi.mock('@/components/auth/AuthProvider', () => ({
    useAuth: () => ({ user: { id: 'test-user' } }),
}));

// ─── Mock Supabase (used by dashboard) ───
vi.mock('@/lib/supabase/client', () => {
    const mock = {
        from: () => ({ select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
    };
    return { getSupabase: () => mock, isSupabaseConfigured: () => false, createBrowserSupabase: () => mock };
});

// ─── Mock react-query (used by useProgress internally, but also by potential child components) ───
vi.mock('@tanstack/react-query', () => ({
    useQuery: () => ({ data: null, isLoading: false, error: null }),
    useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
    QueryClient: class { },
    QueryClientProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ─── Stub heavy child components to isolate dashboard logic ───
vi.mock('@/components/dashboard/DashboardHeader', () => ({
    DashboardHeader: () => <div data-testid="mock-dashboard-header">Header</div>,
}));
vi.mock('@/components/dashboard/DashboardNav', () => ({
    DashboardNav: ({ activeTab, _onTabChange }: { activeTab: string; _onTabChange: (t: string) => void }) => (
        <div data-testid="mock-dashboard-nav">{activeTab}</div>
    ),
}));
vi.mock('@/components/dashboard/DashboardCard', () => ({
    DashboardCard: ({ title, children }: { title: string; children: React.ReactNode }) => (
        <div data-testid={`card-${title}`}>{children}</div>
    ),
}));
vi.mock('@/components/dashboard/StatsOverview', () => ({
    StatsOverview: () => <div data-testid="mock-stats">Stats</div>,
}));
vi.mock('@/components/charts/RadarChart', () => ({
    RadarChart: () => <div data-testid="mock-radar">Radar</div>,
}));
vi.mock('@/components/charts/RadarChartLegend', () => ({
    RadarChartLegend: () => null,
}));
vi.mock('@/components/assessment/EmptyState', () => ({
    EmptyState: ({ title }: { title: string }) => <div data-testid="empty-state">{title}</div>,
}));
vi.mock('@/components/dashboard/SessionTimeline', () => ({
    SessionTimeline: ({ sessions }: { sessions: SessionHistory[] }) => (
        <div data-testid="session-timeline">
            {sessions.map((s: SessionHistory) => (
                <div key={s.sessionId} data-testid={`timeline-session-${s.sessionId}`}>
                    {s.problemId} — Score: {s.overallScore ?? '--'}
                </div>
            ))}
        </div>
    ),
}));
vi.mock('@/components/dashboard/ReviewQueueWidget', () => ({
    ReviewQueueWidget: () => null,
}));
vi.mock('@/components/charts/SkillDrillDown', () => ({
    SkillDrillDown: () => null,
}));
vi.mock('@/components/onboarding/LeetCodePrompt', () => ({
    LeetCodePrompt: () => null,
}));
vi.mock('@/components/dashboard/SkillTrendCard', () => ({
    SkillTrendCard: () => null,
}));
vi.mock('@/components/dashboard/RecommendationsPanel', () => ({
    RecommendationsPanel: () => null,
}));
vi.mock('@/components/dashboard/InsightsPanel', () => ({
    InsightsPanel: () => null,
}));
vi.mock('@/components/dashboard/ExportReportButton', () => ({
    ExportReportButton: () => null,
}));
vi.mock('@/components/dashboard/ShareReplayButton', () => ({
    ShareReplayButton: () => null,
}));
vi.mock('@/lib/recommendations/engine', () => ({
    RecommendationEngine: class { analyze() { return []; } },
}));
vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn(), loading: vi.fn() },
}));
vi.mock('@/lib/demo/manager', () => ({
    isDemoMode: () => false,
    getDemoProgress: () => null,
}));
vi.mock('@/app/actions/dashboard', () => ({
    getDashboardAveragesAction: vi.fn().mockResolvedValue(null),
}));
vi.mock('react-swipeable', () => ({
    useSwipeable: () => ({}),
}));

// ─── Import component under test ───
import DashboardPage from '../../dashboard/page';

// ─── Helpers ───
function makeSession(overrides: Partial<SessionHistory> = {}): SessionHistory {
    return {
        sessionId: `session-${Math.random().toString(36).slice(2)}`,
        problemId: 'two-sum',
        timestamp: new Date().toISOString(),
        overallScore: 7.5,
        skills: {
            problem_decomposition: 7,
            pattern_recognition: 8,
            algorithmic_thinking: 6,
            complexity_analysis: 7,
            edge_case_analysis: 5,
            code_quality: 8,
            communication: 7,
            adaptability: 6,
        },
        duration: 600,
        turnCount: 10,
        ...overrides,
    } as SessionHistory;
}

// ─── Tests ───
describe('Dashboard (RPC null-safety)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        cleanup();
    });

    it('shows empty state when progress is null (RPC returns null)', () => {
        mockProgressReturn = {
            progress: null,
            isLoading: false,
            error: null,
            history: [],
        };

        render(<DashboardPage />);

        // Empty state should be shown
        expect(screen.getByTestId('empty-state')).toBeDefined();
        expect(screen.getByText("Your journey hasn't started yet!")).toBeDefined();
    });

    it('shows empty state when sessions array is empty', () => {
        mockProgressReturn = {
            progress: {
                userId: 'test-user',
                totalSessions: 0,
                averageScore: 0,
                averageScores: {} as any,
                trends: {} as any,
                sessions: [],
                lastUpdated: new Date(),
            },
            isLoading: false,
            error: null,
            history: [],
        };

        render(<DashboardPage />);

        expect(screen.getByTestId('empty-state')).toBeDefined();
        expect(screen.getByText("Your journey hasn't started yet!")).toBeDefined();
    });

    it('renders sessions in timeline when data exists', () => {
        const sessions = [
            makeSession({ sessionId: 's1', problemId: 'two-sum', overallScore: 8.0 }),
            makeSession({ sessionId: 's2', problemId: 'merge-intervals', overallScore: 6.5 }),
            makeSession({ sessionId: 's3', problemId: 'valid-parentheses', overallScore: 9.0 }),
        ];

        mockProgressReturn = {
            progress: {
                userId: 'test-user',
                totalSessions: 3,
                averageScore: 7.8,
                averageScores: {} as any,
                trends: {} as any,
                sessions,
                lastUpdated: new Date(),
            },
            isLoading: false,
            error: null,
            history: sessions,
        };

        render(<DashboardPage />);

        // Empty state should NOT be shown
        expect(screen.queryAllByTestId('empty-state').length).toBe(0);

        // SessionTimeline should render the 3 sessions
        expect(screen.getAllByTestId('session-timeline').length).toBeGreaterThan(0);
        expect(screen.getAllByTestId('timeline-session-s1').length).toBeGreaterThan(0);
        expect(screen.getAllByTestId('timeline-session-s2').length).toBeGreaterThan(0);
        expect(screen.getAllByTestId('timeline-session-s3').length).toBeGreaterThan(0);
    });

    it('renders session with null overallScore without crash', () => {
        const sessions = [
            makeSession({ sessionId: 's1', overallScore: null as any as number }),
        ];

        mockProgressReturn = {
            progress: {
                userId: 'test-user',
                totalSessions: 1,
                averageScore: 0,
                averageScores: {} as any,
                trends: {} as any,
                sessions,
                lastUpdated: new Date(),
            },
            isLoading: false,
            error: null,
            history: sessions,
        };

        // Should not throw
        const { container } = render(<DashboardPage />);

        // Page should render (not crash)
        expect(container.textContent).toBeDefined();
        // Our mock SessionTimeline shows "--" for null scores
        expect(screen.getAllByTestId('session-timeline').length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Score: --/).length).toBeGreaterThan(0);
    });
});
