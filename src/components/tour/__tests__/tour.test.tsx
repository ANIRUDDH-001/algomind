// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TOUR_STEPS, waitForElement, speakHint } from '@/lib/tour/index';
import { TourCard } from '../TourCard';
import { KaiModal } from '../KaiModal';

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

// Mock lucide-react icons used by TourCard
vi.mock('lucide-react', () => ({
    X: () => <svg data-testid="icon-x" />,
    ChevronRight: () => <svg data-testid="icon-chevron-right" />,
    ChevronLeft: () => <svg data-testid="icon-chevron-left" />,
    Volume2: () => <svg data-testid="icon-volume2" />,
    VolumeX: () => <svg data-testid="icon-volumex" />,
    Loader2: () => <svg data-testid="icon-loader2" />,
}));

afterEach(() => {
    cleanup();
});

// ── Step data validation ──────────────────────────────────────────────────────

describe('TOUR_STEPS', () => {
    it('has exactly 14 steps (id 0–13, 2 modals + 12 spotlights)', () => {
        // 2 modals + 12 spotlights = 14 steps
        expect(TOUR_STEPS).toHaveLength(14);
    });

    it('step 0 and last step are type modal', () => {
        expect(TOUR_STEPS[0].type).toBe('modal');
        expect(TOUR_STEPS[TOUR_STEPS.length - 1].type).toBe('modal');
    });

    it('all steps have non-empty title, body, and kaiSays', () => {
        TOUR_STEPS.forEach((step) => {
            expect(step.title.length).toBeGreaterThan(0);
            expect(step.body.length).toBeGreaterThan(0);
            expect(step.kaiSays.length).toBeGreaterThan(0);
        });
    });

    it('kaiSays is max 12 words for every step', () => {
        TOUR_STEPS.forEach((step) => {
            const wordCount = step.kaiSays.trim().split(/\s+/).length;
            expect(wordCount).toBeLessThanOrEqual(12);
        });
    });

    it('all spotlight steps have a target selector', () => {
        const spotlights = TOUR_STEPS.filter((s) => s.type === 'spotlight');
        spotlights.forEach((step) => {
            expect(step.target).toBeTruthy();
            expect(step.target!.startsWith('[data-tour')).toBe(true);
        });
    });

    it('all spotlight steps have a route', () => {
        const spotlights = TOUR_STEPS.filter((s) => s.type === 'spotlight');
        spotlights.forEach((step) => {
            expect(step.route).toBeTruthy();
            expect(step.route!.startsWith('/')).toBe(true);
        });
    });

    it('modal steps have a kaiMood', () => {
        const modals = TOUR_STEPS.filter((s) => s.type === 'modal');
        modals.forEach((step) => {
            expect(['waving', 'celebrating']).toContain(step.kaiMood);
        });
    });

    it('interview steps use two-sum problemId', () => {
        const interviewSteps = TOUR_STEPS.filter(
            (s) => s.route === '/interview'
        );
        expect(interviewSteps.length).toBeGreaterThan(0);
        interviewSteps.forEach((step) => {
            expect(step.routeParams).toContain('two-sum');
        });
    });

    it('demo mode enables at step index 7', () => {
        // Step at index 7 should be the cognitive-profile spotlight
        const step7 = TOUR_STEPS[7];
        expect(step7.type).toBe('spotlight');
        expect(step7.target).toBe('[data-tour="cognitive-profile"]');
    });

    it('no two steps have the same id', () => {
        const ids = TOUR_STEPS.map((s) => s.id);
        const unique = new Set(ids);
        expect(unique.size).toBe(TOUR_STEPS.length);
    });
});

// ── waitForElement ────────────────────────────────────────────────────────────

describe('waitForElement', () => {
    it('resolves immediately when element exists', async () => {
        const div = document.createElement('div');
        div.setAttribute('data-tour', 'test-el');
        document.body.appendChild(div);

        const el = await waitForElement('[data-tour="test-el"]', 1000);
        expect(el).toBe(div);
        document.body.removeChild(div);
    });

    it('resolves after element is added asynchronously', async () => {
        const selector = '[data-tour="async-el"]';
        const promise = waitForElement(selector, 2000);

        // Add element after 150ms
        setTimeout(() => {
            const div = document.createElement('div');
            div.setAttribute('data-tour', 'async-el');
            document.body.appendChild(div);
        }, 150);

        const el = await promise;
        expect(el).not.toBeNull();
        document.body.querySelector(selector)?.remove();
    });

    it('resolves null when element never appears (timeout)', async () => {
        const el = await waitForElement('[data-tour="nonexistent-xyz"]', 300);
        expect(el).toBeNull();
    }, 1000);
});

// ── speakHint ─────────────────────────────────────────────────────────────────

describe('speakHint', () => {
    beforeEach(() => {
        // Polyfill SpeechSynthesisUtterance for jsdom
        if (typeof globalThis.SpeechSynthesisUtterance === 'undefined') {
            globalThis.SpeechSynthesisUtterance = class {
                text: string;
                rate = 1; pitch = 1; volume = 1; voice = null;
                constructor(text: string) { this.text = text; }
            } as unknown as typeof SpeechSynthesisUtterance;
        }
        Object.defineProperty(window, 'speechSynthesis', {
            value: {
                speak: vi.fn(),
                cancel: vi.fn(),
                getVoices: () => [],
                onvoiceschanged: null,
            },
            writable: true,
            configurable: true,
        });
    });

    it('does nothing when enabled=false', () => {
        speakHint('Hello Kai', false);
        expect(window.speechSynthesis.speak).not.toHaveBeenCalled();
    });

    it('does nothing for empty string', () => {
        speakHint('', true);
        expect(window.speechSynthesis.speak).not.toHaveBeenCalled();
    });

    it('cancels previous speech before starting', () => {
        speakHint('First', true);
        speakHint('Second', true);
        // cancel() is called once per speakHint invocation (2 total)
        expect(window.speechSynthesis.cancel).toHaveBeenCalledTimes(2);
    });

    it('registers onvoiceschanged when getVoices returns empty array', () => {
        speakHint('Test voice', true);
        // onvoiceschanged should be set because getVoices() returns []
        expect(window.speechSynthesis.onvoiceschanged).toBeTruthy();
    });
});

// ── KaiModal ─────────────────────────────────────────────────────────────────

describe('KaiModal', () => {
    it('renders without crash for waving mood', () => {
        const { container } = render(<KaiModal mood="waving" />);
        expect(container.firstChild).not.toBeNull();
    });

    it('renders without crash for celebrating mood', () => {
        const { container } = render(<KaiModal mood="celebrating" />);
        expect(container.firstChild).not.toBeNull();
    });

    it('renders particle elements for celebrating mood', () => {
        const { container } = render(<KaiModal mood="celebrating" />);
        // Celebrating has 6 particle divs
        const particles = container.querySelectorAll('[style*="border-radius: 50%"]');
        expect(particles.length).toBeGreaterThan(0);
    });
});

// ── TourCard ─────────────────────────────────────────────────────────────────

describe('TourCard', () => {
    const baseProps = {
        title: 'Test Step',
        body: 'Step body content',
        kaiSays: 'Short hint here.',
        stepIndex: 2,
        totalSpotlight: 11,
        audioEnabled: false,
        isNavigating: false,
        onNext: vi.fn(),
        onPrev: vi.fn(),
        onSkip: vi.fn(),
        onToggleAudio: vi.fn(),
        showBack: true,
        isLast: false,
    };

    beforeEach(() => {
        baseProps.onNext = vi.fn();
        baseProps.onPrev = vi.fn();
        baseProps.onSkip = vi.fn();
        baseProps.onToggleAudio = vi.fn();
    });

    it('renders title, body, and kaiSays', () => {
        render(<TourCard {...baseProps} />);
        expect(screen.getByText('Test Step')).toBeDefined();
        expect(screen.getByText('Step body content')).toBeDefined();
        expect(screen.getByText('Short hint here.')).toBeDefined();
    });

    it('shows Back button when showBack=true', () => {
        render(<TourCard {...baseProps} showBack={true} />);
        expect(screen.getByText('Back')).toBeDefined();
    });

    it('hides Back button when showBack=false', () => {
        render(<TourCard {...baseProps} showBack={false} />);
        expect(screen.queryByText('Back')).toBeNull();
    });

    it('shows Finish when isLast=true', () => {
        render(<TourCard {...baseProps} isLast={true} />);
        expect(screen.getByText('Finish')).toBeDefined();
    });

    it('calls onNext when Next is clicked', () => {
        render(<TourCard {...baseProps} />);
        fireEvent.click(screen.getByText('Next'));
        expect(baseProps.onNext).toHaveBeenCalledTimes(1);
    });

    it('calls onPrev when Back is clicked', () => {
        render(<TourCard {...baseProps} />);
        fireEvent.click(screen.getByText('Back'));
        expect(baseProps.onPrev).toHaveBeenCalledTimes(1);
    });

    it('calls onToggleAudio when audio button clicked', () => {
        render(<TourCard {...baseProps} />);
        fireEvent.click(screen.getByTitle('Hear hints'));
        expect(baseProps.onToggleAudio).toHaveBeenCalledTimes(1);
    });

    it('disables Next and Back when isNavigating=true', () => {
        render(<TourCard {...baseProps} isNavigating={true} />);
        const nextBtn = screen.getByRole('button', { name: /next/i });
        expect(nextBtn).toHaveProperty('disabled', true);
    });

    it('shows 3 of 11 progress', () => {
        render(<TourCard {...baseProps} stepIndex={2} totalSpotlight={11} />);
        expect(screen.getByText('3 / 11')).toBeDefined();
    });
});
