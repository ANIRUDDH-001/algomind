/**
 * @vitest-environment jsdom
 */
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { MicPulse, PulseState } from '@/components/voice/MicPulse';

// Mock framer-motion to bypass animations and AnimatePresence
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className, 'data-testid': testId, style }: any) => (
            <div className={className} data-testid={testId} style={style}>{children}</div>
        ),
    },
    AnimatePresence: ({ children }: any) => <>{children}</>
}));

describe('MicPulse', () => {
    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it('1. state=\'idle\': renders exactly one element with class containing \'rounded-full\' and \'bg-zinc-600\'', () => {
        const { container } = render(<MicPulse state="idle" />);
        // By checking exactly 1 element matching, we confirm the presence of idle dot and NO other objects
        const idleDots = container.querySelectorAll('.rounded-full.bg-zinc-600');
        expect(idleDots).toHaveLength(1);

        // Ensure mutual exclusivity (barring children) directly
        expect(container.querySelectorAll('.border-indigo-400\\/30')).toHaveLength(0); // listening rings
        expect(container.querySelectorAll('.border-2.border-transparent')).toHaveLength(0); // spinner
    });

    it('2. state=\'listening\': renders two ring elements + center dot, does NOT render bar elements', () => {
        const { container } = render(<MicPulse state="listening" />);

        // Two transparent rings
        const rings = container.querySelectorAll('.border-indigo-400\\/30');
        expect(rings).toHaveLength(2);

        // One center solid dot
        const centerDot = container.querySelectorAll('.bg-indigo-500');
        expect(centerDot).toHaveLength(1);

        // No bars
        const gradientBars = Array.from(container.querySelectorAll('div')).filter(el =>
            el.style.background.includes('linear-gradient')
        );
        expect(gradientBars).toHaveLength(0);
    });

    it('3. state=\'processing\': renders spinner element (has border-t style), does NOT render bars', () => {
        const { container } = render(<MicPulse state="processing" />);

        // Check for borderTopColor assigned directly in style prop
        const spinner = Array.from(container.querySelectorAll('.border-2.border-transparent')).find(el =>
            (el as HTMLElement).style.borderTopColor !== ''
        );
        expect(spinner).toBeDefined();

        // No bars
        const gradientBars = Array.from(container.querySelectorAll('div')).filter(el =>
            el.style.background.includes('linear-gradient')
        );
        expect(gradientBars).toHaveLength(0);
    });

    it('4. state=\'speaking\': renders exactly 5 bar elements (check children count of speaking container)', () => {
        const { container } = render(<MicPulse state="speaking" />);

        // Look for the specific container holding the bars
        const speakingContainer = container.querySelector('.flex.items-center.gap-0\\.5.h-8');
        expect(speakingContainer).not.toBeNull();
        expect(speakingContainer?.children).toHaveLength(5);

        // Verify they are the gradient bars
        const bars = Array.from(speakingContainer?.children || []);
        bars.forEach(bar => {
            expect((bar as HTMLElement).style.background).toContain('linear-gradient');
        });
    });

    it('5. size=\'compact\': container has class \'w-12 h-12\'', () => {
        const { container } = render(<MicPulse state="idle" size="compact" />);
        const root = container.firstChild as HTMLElement;
        expect(root.classList.contains('w-12')).toBe(true);
        expect(root.classList.contains('h-12')).toBe(true);
    });

    it('6. size=\'full\' (default): container has class \'w-20 h-20\'', () => {
        const { container } = render(<MicPulse state="idle" />);
        const root = container.firstChild as HTMLElement;
        expect(root.classList.contains('w-20')).toBe(true);
        expect(root.classList.contains('h-20')).toBe(true);
    });

    it('7. Changing state prop from \'idle\' to \'listening\' updates DOM correctly', () => {
        const { container, rerender } = render(<MicPulse state="idle" />);

        // Initial state
        expect(container.querySelectorAll('.bg-zinc-600')).toHaveLength(1);
        expect(container.querySelectorAll('.bg-indigo-500')).toHaveLength(0);

        // Change state
        rerender(<MicPulse state="listening" />);

        // New state
        expect(container.querySelectorAll('.bg-zinc-600')).toHaveLength(0);
        expect(container.querySelectorAll('.border-indigo-400\\/30')).toHaveLength(2);
        expect(container.querySelectorAll('.bg-indigo-500')).toHaveLength(1);
    });

    it('8. Each state renders exactly ONE active visual element (mutual exclusivity)', () => {
        const states: PulseState[] = ['idle', 'listening', 'processing', 'speaking'];

        states.forEach(state => {
            const { container, unmount } = render(<MicPulse state={state} />);

            // The root container has exactly 1 direct child representing the current state block
            // AnimatePresence is mocked to <> {children} </>, so checking root child nodes handles this
            expect(container.firstChild?.childNodes).toHaveLength(1);

            unmount();
        });
    });
});
