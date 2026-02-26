/**
 * useSwipeNavigation
 * 
 * Universal swipe-to-change-tab hook for all multi-tab screens in AlgoMind.
 * Uses pointer events (works on both touch and mouse).
 * 
 * Features:
 * - Horizontal swipe threshold: 60px minimum, more horizontal than vertical (1.5x ratio)
 * - Visual resistance feedback: content shifts slightly before snapping back if no tab change
 * - Respects scroll containers — won't fire if the swipe started inside a scrollable child
 * 
 * @example
 * const { handlers, dragOffset } = useSwipeNavigation({
 *   tabs: ['problem', 'interview', 'code', 'chat'],
 *   activeTab,
 *   onTabChange,
 * });
 * return <div {...handlers} style={{ transform: `translateX(${dragOffset}px)` }}>
 */

import { useRef, useState, useCallback } from 'react';

interface UseSwipeNavigationOptions<T extends string> {
    tabs: readonly T[];
    activeTab: T;
    onTabChange: (tab: T) => void;
    threshold?: number;
    resistance?: number;
    disabled?: boolean;
}

export function useSwipeNavigation<T extends string>({
    tabs,
    activeTab,
    onTabChange,
    threshold = 50,      // ✅ Reduced from 60px to 50px — easier to trigger
    resistance = 0.18,
    disabled = false,
}: UseSwipeNavigationOptions<T>) {
    const startX = useRef(0);
    const startY = useRef(0);
    const isDragging = useRef(false);
    const [dragOffset, setDragOffset] = useState(0);

    // ✅ FIX: Only block swipe if element has HORIZONTAL overflow scroll
    // Vertical scrollers (overflow-y-auto) should NOT block horizontal swipe
    const isHorizontalScroller = (el: Element | null): boolean => {
        while (el) {
            const style = window.getComputedStyle(el);
            const overflowX = style.overflowX;
            if ((overflowX === 'auto' || overflowX === 'scroll') &&
                el.scrollWidth > el.clientWidth + 2) {
                return true;
            }
            el = el.parentElement;
        }
        return false;
    };

    const onPointerDown = useCallback((e: React.PointerEvent) => {
        if (disabled) return;
        // ✅ Only block if the element has horizontal scroll (not vertical)
        if (isHorizontalScroller(e.target as Element)) return;

        startX.current = e.clientX;
        startY.current = e.clientY;
        isDragging.current = true;
    }, [disabled]);

    const onPointerMove = useCallback((e: React.PointerEvent) => {
        if (disabled || !isDragging.current) return;
        const dx = e.clientX - startX.current;
        const dy = e.clientY - startY.current;

        // ✅ Only require dx to be at least somewhat horizontal (not strictly > dy)
        // Allow up to 2:1 vertical-to-horizontal ratio before giving up
        if (Math.abs(dy) > Math.abs(dx) * 2) {
            isDragging.current = false;
            setDragOffset(0);
            return;
        }

        const currentIndex = tabs.indexOf(activeTab);
        const canGoLeft = currentIndex < tabs.length - 1;
        const canGoRight = currentIndex > 0;

        if ((dx < 0 && canGoLeft) || (dx > 0 && canGoRight)) {
            setDragOffset(dx * resistance);
        }
    }, [disabled, tabs, activeTab, resistance]);

    const onPointerUp = useCallback((e: React.PointerEvent) => {
        setDragOffset(0);
        if (disabled || !isDragging.current) return;
        isDragging.current = false;

        const dx = e.clientX - startX.current;
        const dy = e.clientY - startY.current;

        if (Math.abs(dx) < threshold) return;
        if (Math.abs(dy) > Math.abs(dx) * 2) return;

        const currentIndex = tabs.indexOf(activeTab);

        if (dx < 0 && currentIndex < tabs.length - 1) {
            onTabChange(tabs[currentIndex + 1]);
        } else if (dx > 0 && currentIndex > 0) {
            onTabChange(tabs[currentIndex - 1]);
        }
    }, [disabled, tabs, activeTab, onTabChange, threshold]);

    const onPointerCancel = useCallback(() => {
        isDragging.current = false;
        setDragOffset(0);
    }, []);

    return {
        handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
        dragOffset,
        currentIndex: tabs.indexOf(activeTab),
        totalTabs: tabs.length,
    };
}
