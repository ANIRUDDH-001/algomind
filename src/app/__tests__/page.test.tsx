// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

// ─── jsdom polyfills ───
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

// ─── Mock framer-motion ───
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className, style }: any) => <div className={className} style={style}>{children}</div>,
        button: ({ children, className, onClick }: any) => <button className={className} onClick={onClick}>{children}</button>,
        p: ({ children, className }: any) => <p className={className}>{children}</p>,
        polygon: ({ className }: any) => <polygon className={className} />,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
    useScroll: () => ({ scrollYProgress: { get: () => 0 } }),
    useTransform: (_v: any, _from: any, _to: any) => 0,
    useInView: () => true, // always "in view" so content renders
}));

// ─── Mock lucide-react to avoid SVG issues ───
vi.mock('lucide-react', () => ({
    Mic: () => <svg data-testid="icon-mic" />,
    BarChart: () => <svg data-testid="icon-barchart" />,
    Brain: () => <svg data-testid="icon-brain" />,
    ArrowRight: () => <svg data-testid="icon-arrow" />,
    Play: () => <svg data-testid="icon-play" />,
    CheckCircle2: () => <svg data-testid="icon-check" />,
}));

// ─── Mock onboarding manager ───
const mockShouldShowOnboarding = vi.fn(() => false);
vi.mock('@/lib/onboarding/manager', () => ({
    shouldShowOnboarding: () => mockShouldShowOnboarding(),
    markOnboardingComplete: vi.fn(),
}));

vi.mock('@/lib/demo/manager', () => ({
    enableDemoMode: vi.fn(),
}));

// ─── Mock next/navigation ───
const mockReplace = vi.fn();
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
    useRouter: () => ({ replace: mockReplace, push: mockPush }),
}));

// ─── Mock IntroAnimation ───
vi.mock('@/components/onboarding/IntroAnimation', () => ({
    IntroAnimation: ({ onComplete }: { onComplete: () => void }) => (
        <div data-testid="intro-animation">
            <button onClick={onComplete}>Complete Onboarding</button>
        </div>
    ),
}));

// ─── Mock useAuth ───
const mockUseAuth = vi.fn(() => ({ user: null, loading: false }));
vi.mock('@/components/auth/AuthProvider', () => ({
    useAuth: () => mockUseAuth(),
}));

// Note: Button is a simple passthrough so no need to mock it
import HomePage from '../page';

describe('HomePage — Unauthenticated', () => {
    beforeEach(() => {
        mockShouldShowOnboarding.mockReturnValue(false);
        mockUseAuth.mockReturnValue({ user: null, loading: false });
        mockReplace.mockClear();
        mockPush.mockClear();
    });

    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it('1. Hero section renders with headline containing "Interview"', async () => {
        render(<HomePage />);
        // Title is split across two spans inside an h1: "AI-Powered Technical" + "Interview Practice"
        // Use waitFor + querySelector since getByText won't match split-span text node
        await waitFor(() => {
            const heading = screen.getAllByRole('heading', { level: 1 });
            expect(heading.length).toBeGreaterThan(0);
            expect(heading[0].textContent).toMatch(/Interview/i);
        });
    });

    it('2. "Try for Free" button renders', async () => {
        render(<HomePage />);
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /try for free/i })).toBeDefined();
        });
    });

    it('3. 3D cube container element is present in DOM (check for perspective style)', async () => {
        const { container } = render(<HomePage />);
        await waitFor(() => {
            // The cube container div has style={{ perspective: '800px' }}
            const perspectiveEls = Array.from(container.querySelectorAll('div')).filter(el =>
                (el as HTMLElement).style.perspective === '800px'
            );
            expect(perspectiveEls.length).toBeGreaterThan(0);
        });
    });

    it('4. Feature cards section renders 3 feature headings', async () => {
        render(<HomePage />);
        await waitFor(() => {
            expect(screen.getByText('Voice Interview')).toBeDefined();
            expect(screen.getByText('Cognitive Analysis')).toBeDefined();
            expect(screen.getByText('Company Modes')).toBeDefined();
        });
    });

    it('5. Stats section renders 3 stat blocks', async () => {
        render(<HomePage />);
        await waitFor(() => {
            expect(screen.getByText('1,000+')).toBeDefined();
            expect(screen.getByText('8')).toBeDefined();
            expect(screen.getByText('24/7')).toBeDefined();
        });
    });

    it('6. CTA section renders with "Get Started Free" text', async () => {
        render(<HomePage />);
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /get started free/i })).toBeDefined();
        });
    });

    it('7. Page has 6 distinct sections (includes PWA card)', async () => {
        const { container } = render(<HomePage />);
        await waitFor(() => {
            const sections = container.querySelectorAll('section');
            expect(sections).toHaveLength(6);
        });
    });
});

describe('HomePage — Authenticated', () => {
    beforeEach(() => {
        mockShouldShowOnboarding.mockReturnValue(false);
        mockReplace.mockClear();
        mockPush.mockClear();
    });

    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it('1 & 2. Authenticated user sees "Go to Dashboard" button (no redirect)', async () => {
        mockUseAuth.mockReturnValue({ user: { id: '1', email: 'test@test.com' } as any, loading: false });
        render(<HomePage />);

        await waitFor(() => {
            // Component renders marketing page with dashboard button instead of redirecting
            expect(screen.getAllByRole('button', { name: /go to dashboard/i }).length).toBeGreaterThan(0);
        });
    });

    it('3. Still renders marketing content when authenticated (6 sections)', async () => {
        mockUseAuth.mockReturnValue({ user: { id: '1', email: 'test@test.com' } as any, loading: false });
        const { container } = render(<HomePage />);

        await waitFor(() => {
            const sections = container.querySelectorAll('section');
            expect(sections).toHaveLength(6);
        });
    });

    it('4. Page still renders hero content even when loading=true (no blocking spinner)', async () => {
        mockUseAuth.mockReturnValue({ user: null, loading: true });
        render(<HomePage />);

        // Hero renders immediately — no blocking spinner anymore
        await waitFor(() => {
            const heading = screen.getAllByRole('heading', { level: 1 });
            expect(heading.length).toBeGreaterThan(0);
        });
    });

    it('5. IntroAnimation shown when shouldShowOnboarding() returns true', () => {
        mockShouldShowOnboarding.mockReturnValue(true);
        mockUseAuth.mockReturnValue({ user: null, loading: false });
        render(<HomePage />);
        expect(screen.getByTestId('intro-animation')).toBeDefined();
    });
});
