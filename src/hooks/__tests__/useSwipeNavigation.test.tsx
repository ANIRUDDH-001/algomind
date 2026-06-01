/**
 * @codesage
 * @file      src/hooks/__tests__/useSwipeNavigation.test.tsx
 * @purpose   Unit tests for the useSwipeNavigation React hook.
 * @tech      Vitest, React Testing Library
 * @connects  Tests useSwipeNavigation
 * @apis      none
 * @db        none
 * @state     none
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSwipeNavigation } from '../useSwipeNavigation';

// We create a wrapper to easily fire events on a DOM element
const TestComponent = ({
    activeTab = 'tab2',
    onTabChange,
    disabled = false
}: {
    activeTab?: string;
    onTabChange: (tab: string) => void;
    disabled?: boolean;
}) => {
    const { handlers, dragOffset, currentIndex } = useSwipeNavigation({
        tabs: ['tab1', 'tab2', 'tab3'] as const,
        activeTab: activeTab as any,
        onTabChange,
        disabled
    });

    return (
        <div
            data-testid="swipe-area"
            data-offset={dragOffset}
            data-index={currentIndex}
            {...(handlers as any)}
        />
    );
};

describe('useSwipeNavigation', () => {
    const mockOnTabChange = vi.fn();

    beforeEach(() => {
        mockOnTabChange.mockClear();
        vi.spyOn(window, 'getComputedStyle').mockImplementation(() => {
            return {
                overflow: 'visible',
                overflowX: 'visible',
            } as CSSStyleDeclaration;
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        cleanup();
    });

    it('1. Returns correct currentIndex for activeTab', () => {
        render(<TestComponent activeTab="tab2" onTabChange={mockOnTabChange} />);
        const element = screen.getByTestId('swipe-area');
        expect(element.getAttribute('data-index')).toBe('1');
    });

    it('2. Swipe left (diffX < -60, horizontal dominant) → calls onTabChange with next tab', () => {
        render(<TestComponent activeTab="tab2" onTabChange={mockOnTabChange} />);
        const element = screen.getByTestId('swipe-area');

        fireEvent.pointerDown(element, { clientX: 100, clientY: 200 });
        fireEvent.pointerMove(element, { clientX: 30, clientY: 205 }); // diffX = -70, diffY = 5
        fireEvent.pointerUp(element, { clientX: 30, clientY: 205 });

        expect(mockOnTabChange).toHaveBeenCalledWith('tab3');
    });

    it('3. Swipe right (diffX > 60, horizontal dominant) → calls onTabChange with previous tab', () => {
        render(<TestComponent activeTab="tab2" onTabChange={mockOnTabChange} />);
        const element = screen.getByTestId('swipe-area');

        fireEvent.pointerDown(element, { clientX: 100, clientY: 200 });
        fireEvent.pointerMove(element, { clientX: 170, clientY: 205 }); // diffX = 70, diffY = 5
        fireEvent.pointerUp(element, { clientX: 170, clientY: 205 });

        expect(mockOnTabChange).toHaveBeenCalledWith('tab1');
    });

    it('4. Swipe less than threshold (40px) → does NOT call onTabChange', () => {
        render(<TestComponent activeTab="tab2" onTabChange={mockOnTabChange} />);
        const element = screen.getByTestId('swipe-area');

        fireEvent.pointerDown(element, { clientX: 100, clientY: 200 });
        fireEvent.pointerMove(element, { clientX: 60, clientY: 205 }); // diffX = -40
        fireEvent.pointerUp(element, { clientX: 60, clientY: 205 });

        expect(mockOnTabChange).not.toHaveBeenCalled();
    });

    it('5. Vertical swipe (diffY > diffX * 1.5) → does NOT call onTabChange', () => {
        render(<TestComponent activeTab="tab2" onTabChange={mockOnTabChange} />);
        const element = screen.getByTestId('swipe-area');

        // For a vertical swipe, Math.abs(dy) needs to be > Math.abs(dx) during onPointerUp
        // Let's use diffY = 100, diffX = 30
        fireEvent.pointerDown(element, { clientX: 100, clientY: 200 });
        fireEvent.pointerMove(element, { clientX: 130, clientY: 300 }); // diffX = +30, diffY = +100
        fireEvent.pointerUp(element, { clientX: 130, clientY: 300 });

        expect(mockOnTabChange).not.toHaveBeenCalled();
    });

    it('6. On first tab, swipe right → does NOT call onTabChange (no previous)', () => {
        render(<TestComponent activeTab="tab1" onTabChange={mockOnTabChange} />);
        const element = screen.getByTestId('swipe-area');

        fireEvent.pointerDown(element, { clientX: 100, clientY: 200 });
        fireEvent.pointerMove(element, { clientX: 170, clientY: 205 }); // diffX = 70
        fireEvent.pointerUp(element, { clientX: 170, clientY: 205 });

        expect(mockOnTabChange).not.toHaveBeenCalled();
    });

    it('7. On last tab, swipe left → does NOT call onTabChange (no next)', () => {
        render(<TestComponent activeTab="tab3" onTabChange={mockOnTabChange} />);
        const element = screen.getByTestId('swipe-area');

        fireEvent.pointerDown(element, { clientX: 100, clientY: 200 });
        fireEvent.pointerMove(element, { clientX: 30, clientY: 205 }); // diffX = -70
        fireEvent.pointerUp(element, { clientX: 30, clientY: 205 });

        expect(mockOnTabChange).not.toHaveBeenCalled();
    });

    it('8. disabled=true → swipe does NOT call onTabChange', () => {
        render(<TestComponent activeTab="tab2" onTabChange={mockOnTabChange} disabled={true} />);
        const element = screen.getByTestId('swipe-area');

        fireEvent.pointerDown(element, { clientX: 100, clientY: 200 });
        fireEvent.pointerMove(element, { clientX: 30, clientY: 205 }); // diffX = -70
        fireEvent.pointerUp(element, { clientX: 30, clientY: 205 });

        expect(mockOnTabChange).not.toHaveBeenCalled();
    });

    it('9. dragOffset returns a non-zero value during pointer move (resistance preview)', () => {
        render(<TestComponent activeTab="tab2" onTabChange={mockOnTabChange} />);
        const element = screen.getByTestId('swipe-area');

        fireEvent.pointerDown(element, { clientX: 100, clientY: 200 });
        fireEvent.pointerMove(element, { clientX: 30, clientY: 205 }); // diffX = -70

        // Offset should be populated (dx * resistance)
        const offset = Number(element.getAttribute('data-offset'));
        expect(offset).not.toBe(0);
        expect(offset).toBeLessThan(0); // For left swipe it goes negative
    });

    it('10. dragOffset resets to 0 on pointerUp and pointerCancel', () => {
        const { unmount } = render(<TestComponent activeTab="tab2" onTabChange={mockOnTabChange} />);
        const element = screen.getByTestId('swipe-area');

        // pointerUp
        fireEvent.pointerDown(element, { clientX: 100, clientY: 200 });
        fireEvent.pointerMove(element, { clientX: 30, clientY: 205 });
        expect(Number(element.getAttribute('data-offset'))).not.toBe(0);

        fireEvent.pointerUp(element, { clientX: 30, clientY: 205 });
        expect(Number(element.getAttribute('data-offset'))).toBe(0);

        unmount();

        render(<TestComponent activeTab="tab2" onTabChange={mockOnTabChange} />);
        const newElement = screen.getByTestId('swipe-area');

        // pointerCancel
        fireEvent.pointerDown(newElement, { clientX: 100, clientY: 200 });
        fireEvent.pointerMove(newElement, { clientX: 30, clientY: 205 });
        expect(Number(newElement.getAttribute('data-offset'))).not.toBe(0);

        fireEvent.pointerCancel(newElement);
        expect(Number(newElement.getAttribute('data-offset'))).toBe(0);
    });
});
