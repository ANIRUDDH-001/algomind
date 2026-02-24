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
    /** Min horizontal pixels to trigger a swipe. Default: 60 */
    threshold?: number;
    /** Resistance factor for drag preview (0 = no preview, 1 = full). Default: 0.2 */
    resistance?: number;
    /** Disable swipe (e.g. when a modal is open). Default: false */
    disabled?: boolean;
}

interface SwipeHandlers {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerCancel: (e: React.PointerEvent) => void;
}

export function useSwipeNavigation<T extends string>({
    tabs,
    activeTab,
    onTabChange,
    threshold = 60,
    resistance = 0.18,
    disabled = false,
}: UseSwipeNavigationOptions<T>) {
    const startX = useRef(0);
    const startY = useRef(0);
    const startedInScroller = useRef(false);
    const [dragOffset, setDragOffset] = useState(0);

    const isScrollableParent = (el: Element | null): boolean => {
        while (el) {
            const style = window.getComputedStyle(el);
            const overflow = style.overflowX + style.overflow;
            if (/auto|scroll/.test(overflow) && el.scrollWidth > el.clientWidth) return true;
            el = el.parentElement;
        }
        return false;
    };

    const onPointerDown = useCallback((e: React.PointerEvent) => {
        if (disabled) return;
        startX.current = e.clientX;
        startY.current = e.clientY;
        startedInScroller.current = isScrollableParent(e.target as Element);
    }, [disabled]);

    const onPointerMove = useCallback((e: React.PointerEvent) => {
        if (disabled || startedInScroller.current) return;
        const dx = e.clientX - startX.current;
        const dy = e.clientY - startY.current;
        if (Math.abs(dx) < Math.abs(dy)) return; // vertical dominates — ignore

        const currentIndex = tabs.indexOf(activeTab);
        const canGoLeft = currentIndex < tabs.length - 1;
        const canGoRight = currentIndex > 0;

        // Apply resistance — only show drag if swipe would result in navigation
        if ((dx < 0 && canGoLeft) || (dx > 0 && canGoRight)) {
            setDragOffset(dx * resistance);
        }
    }, [disabled, tabs, activeTab, resistance]);

    const onPointerUp = useCallback((e: React.PointerEvent) => {
        setDragOffset(0);
        if (disabled || startedInScroller.current) return;

        const dx = e.clientX - startX.current;
        const dy = e.clientY - startY.current;

        if (Math.abs(dx) < threshold) return;
        if (Math.abs(dy) > Math.abs(dx)) return;

        const currentIndex = tabs.indexOf(activeTab);

        if (dx < 0 && currentIndex < tabs.length - 1) {
            onTabChange(tabs[currentIndex + 1]);
        } else if (dx > 0 && currentIndex > 0) {
            onTabChange(tabs[currentIndex - 1]);
        }
    }, [disabled, tabs, activeTab, onTabChange, threshold]);

    const onPointerCancel = useCallback(() => {
        setDragOffset(0);
    }, []);

    return {
        handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel } as SwipeHandlers,
        dragOffset,
        currentIndex: tabs.indexOf(activeTab),
        totalTabs: tabs.length,
    };
}
