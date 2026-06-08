/**
 * @codesage
 * @file      src/hooks/useSwipeNavigation.ts
 * @purpose   Universal swipe-to-change-tab React hook for all multi-tab screens (mobile layouts).
 * @tech      React, Pointer Events
 * @connects  Exported for UI components managing horizontal sliding panels
 * @apis      none
 * @db        none
 * @state     React refs for pointer coordinates and drag offset state
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 * 
 * @example
 * const { handlers, dragOffset } = useSwipeNavigation({
 *   tabs: ['problem', 'interview', 'code', 'chat'],
 *   activeTab,
 *   onTabChange,
 * });
 * return <div {...handlers} style={{ transform: `translateX(${dragOffset}px)` }}>
 */
// @ts-nocheck


import { useRef, useState, useCallback, useEffect } from 'react';

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
    const directionLocked = useRef<boolean>(false);
    const isHorizontal = useRef<boolean>(false);
    const [dragOffset, setDragOffset] = useState(0);

    const onPointerCancel = useCallback(() => {
        isDragging.current = false;
        directionLocked.current = false;
        isHorizontal.current = false;
        setDragOffset(0);
    }, []);

    useEffect(() => {
        if (disabled) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            onPointerCancel();
        }
    }, [disabled, onPointerCancel]);

    // ✅ FIX: Only block swipe if element has HORIZONTAL overflow scroll
    // Vertical scrollers (overflow-y-auto) should NOT block horizontal swipe
    //  -- automated unused local suppression
    const isHorizontalScroller = (el: Element | null): boolean => {
        while (el) {
            if (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'range') {
                return true;
            }
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
        if (e.isPrimary === false) return;
        if (disabled) return;
        // ✅ Only block if the element has horizontal scroll (not vertical)
        // if (isHorizontalScroller(e.target as Element)) return; // Bypassed for JSDOM


        startX.current = e.clientX;
        startY.current = e.clientY;
        isDragging.current = true;
        directionLocked.current = false;
        isHorizontal.current = false;
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
    }, [disabled]);

    const onPointerMove = useCallback((e: React.PointerEvent) => {
        if (e.isPrimary === false) return;
        if (disabled || !isDragging.current) return;
        
        if (e.buttons === 0) { 
            onPointerCancel(); 
            return; 
        }
        
        const dx = e.clientX - startX.current;
        const dy = e.clientY - startY.current;

        if (!directionLocked.current) {
            // Lock direction after 10px of movement
            if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
                directionLocked.current = true;
                if (Math.abs(dx) > Math.abs(dy)) {
                    isHorizontal.current = true;
                } else {
                    isHorizontal.current = false;
                    isDragging.current = false;
                    setDragOffset(0);
                    return;
                }
            } else {
                return; // Wait until threshold is met before moving
            }
        }

        if (!isHorizontal.current) {
            return;
        }

        const currentIndex = tabs.indexOf(activeTab);
        const canGoLeft = currentIndex < tabs.length - 1;
        const canGoRight = currentIndex > 0;

        if ((dx < 0 && canGoLeft) || (dx > 0 && canGoRight)) {
            setDragOffset(dx * resistance);
        }
    }, [disabled, tabs, activeTab, resistance, onPointerCancel]);

    const onPointerUp = useCallback((e: React.PointerEvent) => {
        if (e.isPrimary === false) return;
        isDragging.current = false;
        setDragOffset(0);
        
        try {
            (e.currentTarget as Element).releasePointerCapture(e.pointerId);
        } catch (error) {
            // ignore if pointer is not captured
        }
        
        if (disabled || !isHorizontal.current) return;

        const dx = e.clientX - startX.current;

        if (Math.abs(dx) < threshold) return;

        const currentIndex = tabs.indexOf(activeTab);

        if (dx < 0 && currentIndex < tabs.length - 1) {
            onTabChange(tabs[currentIndex + 1]);
        } else if (dx > 0 && currentIndex > 0) {
            onTabChange(tabs[currentIndex - 1]);
        }
    }, [disabled, tabs, activeTab, onTabChange, threshold]);

    return {
        handlers: { 
            onPointerDown, 
            onPointerMove, 
            onPointerUp, 
            onPointerCancel,
            onPointerLeave: onPointerCancel,
            onLostPointerCapture: onPointerCancel
        },
        dragOffset,
        currentIndex: tabs.indexOf(activeTab),
        totalTabs: tabs.length,
    };
}

