/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// ── Mock framer-motion (pass through) ──
vi.mock('framer-motion', () => ({
    motion: {
        div: React.forwardRef(({ children, initial, animate, exit, whileHover, whileTap, layout, transition, ...rest }: any, ref: any) => (
            <div ref={ref} data-motion-initial={JSON.stringify(initial)} data-motion-whilehover={JSON.stringify(whileHover)} {...rest}>{children}</div>
        )),
        button: React.forwardRef(({ children, whileTap, ...rest }: any, ref: any) => (
            <button ref={ref} {...rest}>{children}</button>
        )),
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock('lucide-react', () => ({
    CheckCircle: (props: any) => <span data-testid="icon-check" className={props.className} />,
}));

import { ProblemCard } from '../ProblemCard';
import type { Problem } from '@/lib/supabase/problems';

// ── Helpers ──

function makeProblem(overrides: Partial<Problem> = {}): Problem {
    return {
        id: 'two-sum',
        title: 'Two Sum',
        description: 'Given an array of integers, return indices of the two numbers.\n\nExample: [2,7,11,15], target = 9 → [0,1]',
        difficulty: 'easy',
        tags: ['array', 'hash-table', 'sorting', 'two-pointer'],
        hints: ['Try a hash map'],
        examples: [{ input: '[2,7,11,15], 9', output: '[0,1]' }],
        ...overrides,
    };
}

describe('ProblemCard', () => {
    const onStart = vi.fn();
    let unmount: () => void;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        // Ensure DOM is clean between tests
        if (unmount) unmount();
    });

    it('1. Card renders with difficulty badge (correct class)', () => {
        const result = render(<ProblemCard problem={makeProblem({ difficulty: 'easy' })} attempted={false} onStart={onStart} />);
        unmount = result.unmount;
        const badge = result.container.querySelector('.badge-easy');
        expect(badge).not.toBeNull();
        expect(badge!.textContent).toBe('Easy');
    });

    it('2. Problem title is visible', () => {
        const result = render(<ProblemCard problem={makeProblem()} attempted={false} onStart={onStart} />);
        unmount = result.unmount;
        const titles = screen.getAllByText('Two Sum');
        expect(titles.length).toBeGreaterThan(0);
    });

    it('3. Tags render (up to 4 visible)', () => {
        const result = render(<ProblemCard problem={makeProblem()} attempted={false} onStart={onStart} />);
        unmount = result.unmount;
        const tagEls = result.container.querySelectorAll('.text-zinc-500');
        expect(tagEls.length).toBe(4);
        expect(tagEls[0].textContent).toBe('array');
        expect(tagEls[3].textContent).toBe('two-pointer');
    });

    it('4. Tags beyond 4 are NOT shown (slice(0,4))', () => {
        const manyTags = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta'];
        const result = render(<ProblemCard problem={makeProblem({ tags: manyTags })} attempted={false} onStart={onStart} />);
        unmount = result.unmount;
        const tagEls = result.container.querySelectorAll('.text-zinc-500');
        expect(tagEls.length).toBe(4);
        // 5th and 6th tags should not appear
        const tagTexts = Array.from(tagEls).map(el => el.textContent);
        expect(tagTexts).not.toContain('epsilon');
        expect(tagTexts).not.toContain('zeta');
    });

    it('5. "Attempted" badge shows when attempted=true', () => {
        const result = render(<ProblemCard problem={makeProblem()} attempted={true} onStart={onStart} />);
        unmount = result.unmount;
        expect(screen.getByText('Done')).toBeDefined();
        expect(screen.getByTestId('icon-check')).toBeDefined();
    });

    it('6. "Attempted" badge hidden when attempted=false', () => {
        const result = render(<ProblemCard problem={makeProblem()} attempted={false} onStart={onStart} />);
        unmount = result.unmount;
        expect(screen.queryByText('Done')).toBeNull();
    });

    it('7. Clicking card toggles expanded state', () => {
        const result = render(<ProblemCard problem={makeProblem()} attempted={false} onStart={onStart} />);
        unmount = result.unmount;
        // Initially collapsed
        expect(screen.queryByText(/Given an array/)).toBeNull();

        // Click to expand
        fireEvent.click(result.container.firstElementChild!);
        expect(screen.queryByText(/Given an array/)).not.toBeNull();

        // Click again to collapse
        fireEvent.click(result.container.firstElementChild!);
        expect(screen.queryByText(/Given an array/)).toBeNull();
    });

    it('8. Expanded: description text becomes visible', () => {
        const result = render(<ProblemCard problem={makeProblem()} attempted={false} onStart={onStart} />);
        unmount = result.unmount;
        fireEvent.click(result.container.firstElementChild!);
        expect(screen.getByText(/Given an array/)).toBeDefined();
    });

    it('9. Expanded: mobile "Start Practice" button appears', () => {
        const result = render(<ProblemCard problem={makeProblem()} attempted={false} onStart={onStart} />);
        unmount = result.unmount;
        // Not visible when collapsed
        expect(screen.queryByText('Start Practice')).toBeNull();

        // Expand
        fireEvent.click(result.container.firstElementChild!);
        expect(screen.getByText('Start Practice')).toBeDefined();
    });

    it('10. Desktop "Practice" button has opacity-0 initially (hover shows it)', () => {
        const result = render(<ProblemCard problem={makeProblem()} attempted={false} onStart={onStart} />);
        unmount = result.unmount;
        const practiceBtn = screen.getByText('Practice');
        expect(practiceBtn.className).toContain('opacity-0');
        expect(practiceBtn.className).toContain('group-hover:opacity-100');
    });

    it('11. Start button click calls onStart with correct problem.id', () => {
        const result = render(<ProblemCard problem={makeProblem({ id: 'merge-sort' })} attempted={false} onStart={onStart} />);
        unmount = result.unmount;
        fireEvent.click(screen.getByText('Practice'));
        expect(onStart).toHaveBeenCalledWith('merge-sort');
    });

    it('12. Start button click does NOT bubble to expand toggle (stopPropagation)', () => {
        const result = render(<ProblemCard problem={makeProblem()} attempted={false} onStart={onStart} />);
        unmount = result.unmount;
        // Click the Practice button (desktop)
        fireEvent.click(screen.getByText('Practice'));

        // Card should NOT be expanded (description still hidden)
        expect(screen.queryByText(/Given an array/)).toBeNull();

        // Now expand, then click mobile Start Practice and verify it doesn't collapse
        fireEvent.click(result.container.firstElementChild!);
        expect(screen.queryByText(/Given an array/)).not.toBeNull();
        fireEvent.click(screen.getByText('Start Practice'));
        // Still expanded
        expect(screen.queryByText(/Given an array/)).not.toBeNull();
    });

    it("13. difficulty='easy' → badge has badge-easy class", () => {
        const result = render(<ProblemCard problem={makeProblem({ difficulty: 'easy' })} attempted={false} onStart={onStart} />);
        unmount = result.unmount;
        expect(result.container.querySelector('.badge-easy')).not.toBeNull();
    });

    it("14. difficulty='medium' → badge has badge-medium class", () => {
        const result = render(<ProblemCard problem={makeProblem({ difficulty: 'medium' })} attempted={false} onStart={onStart} />);
        unmount = result.unmount;
        expect(result.container.querySelector('.badge-medium')).not.toBeNull();
    });

    it("15. difficulty='hard' → badge has badge-hard class", () => {
        const result = render(<ProblemCard problem={makeProblem({ difficulty: 'hard' })} attempted={false} onStart={onStart} />);
        unmount = result.unmount;
        expect(result.container.querySelector('.badge-hard')).not.toBeNull();
    });

    it('16. Card has whileHover animation prop (borderColor change)', () => {
        const result = render(<ProblemCard problem={makeProblem()} attempted={false} onStart={onStart} />);
        unmount = result.unmount;
        const card = result.container.firstElementChild as HTMLElement;
        const whileHover = JSON.parse(card.getAttribute('data-motion-whilehover') || '{}');
        expect(whileHover.borderColor).toBe('rgba(99,102,241,0.3)');
    });
});
