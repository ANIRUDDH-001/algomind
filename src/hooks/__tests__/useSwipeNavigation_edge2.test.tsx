/**
 * @vitest-environment jsdom
 */
// @ts-expect-error -- automated unused local suppression
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
// @ts-expect-error -- automated unused local suppression
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

describe('useSwipeNavigation Edge Case 2', () => {
    it('aborts drag if pointer move has buttons === 0', () => {
        render(<TestComponent disabled={false} />);
        const element = screen.getByTestId('swipe-area');

        // 1. Pointer down (isDragging becomes true)
        fireEvent.pointerDown(element, { clientX: 100, clientY: 200, buttons: 1 });

        // 2. Pointer move with buttons === 0 (user released outside)
        fireEvent.pointerMove(element, { clientX: 0, clientY: 200, buttons: 0 });

        // If it aborted, dragOffset is 0. If it continued, it is -18.
        const offset = Number(element.getAttribute('data-offset'));
        expect(offset).toBe(0); 
    });
});
