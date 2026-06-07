/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSwipeNavigation } from '../useSwipeNavigation';

const TestComponent = ({ disabled = false }) => {
    const { handlers, dragOffset } = useSwipeNavigation({
        tabs: ['tab1', 'tab2', 'tab3'],
        activeTab: 'tab2',
        onTabChange: () => {},
        disabled
    });

    return (
        <div
            data-testid="swipe-area"
            data-offset={dragOffset}
            {...(handlers as any)}
        />
    );
};

describe('useSwipeNavigation Edge Case', () => {
    it('isDragging remains true if disabled becomes true before pointerUp', () => {
        const { rerender } = render(<TestComponent disabled={false} />);
        const element = screen.getByTestId('swipe-area');

        // 1. Pointer down (isDragging becomes true)
        fireEvent.pointerDown(element, { clientX: 100, clientY: 200 });

        // 2. Rerender with disabled=true
        rerender(<TestComponent disabled={true} />);

        // 3. Pointer up while disabled
        fireEvent.pointerUp(element, { clientX: 100, clientY: 200 });

        // 4. Rerender with disabled=false
        rerender(<TestComponent disabled={false} />);

        // 5. Pointer move WITHOUT pointer down!
        // We move 100px left to trigger lock and offset
        fireEvent.pointerMove(element, { clientX: 0, clientY: 200 });

        // If isDragging is still true, dragOffset will be set
        const offset = Number(element.getAttribute('data-offset'));
        expect(offset).toBe(0); 
    });
});
