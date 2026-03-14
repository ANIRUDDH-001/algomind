"use client"

/**
 * ZERO-DEPENDENCY resizable panels.
 * Replaces react-resizable-panels entirely — the v4 library API is incompatible
 * and causes panels to render at near-zero width regardless of defaultSize.
 *
 * Drop-in replacement: same export names, same prop names, no other files change.
 */

import React, {
    useRef,
    useState,
    useCallback,
    useEffect,
    useId,
    createContext,
    useContext,
    type CSSProperties,
    type ReactNode,
} from "react"
import { GripVertical } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Context ──────────────────────────────────────────────────────────────────

interface PanelMeta {
    defaultSize: number
    minSize: number
    maxSize: number
}

interface GroupCtx {
    direction: "horizontal" | "vertical"
    sizes: number[]
    setSizes: React.Dispatch<React.SetStateAction<number[]>>
    containerRef: React.RefObject<HTMLDivElement | null>
    registerPanel: (id: string, meta: PanelMeta) => void
    getIndex: (id: string) => number
    getPanelMeta: (index: number) => PanelMeta | undefined
    /** Programmatically resize a panel by its id. The adjacent panel absorbs the delta. */
    setPanelSize: (id: string, targetPct: number) => void
}

const GroupCtx = createContext<GroupCtx | null>(null)

function useGroupCtx() {
    const ctx = useContext(GroupCtx)
    if (!ctx) throw new Error("ResizablePanel must be inside ResizablePanelGroup")
    return ctx
}

// ─── ResizablePanelGroup ──────────────────────────────────────────────────────

interface ResizablePanelGroupProps {
    direction?: "horizontal" | "vertical"
    className?: string
    style?: CSSProperties
    children?: ReactNode
    id?: string
    onLayout?: (sizes: number[]) => void
}

function ResizablePanelGroup({
    direction = "horizontal",
    className,
    style,
    children,
}: ResizablePanelGroupProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const orderRef = useRef<string[]>([])
    const metaRef = useRef<Map<string, PanelMeta>>(new Map())
    const [sizes, setSizes] = useState<number[]>([])
    const initialised = useRef(false)

    const registerPanel = useCallback((id: string, meta: PanelMeta) => {
        if (!metaRef.current.has(id)) {
            metaRef.current.set(id, meta)
            orderRef.current.push(id)
        }
    }, [])

    const getIndex = useCallback((id: string) => orderRef.current.indexOf(id), [])
    
    const getPanelMeta = useCallback((index: number) => {
        const id = orderRef.current[index];
        if (!id) return undefined;
        return metaRef.current.get(id);
    }, [])

    const setPanelSize = useCallback((id: string, targetPct: number) => {
        const idx = orderRef.current.indexOf(id);
        if (idx === -1) return;
        setSizes((prev) => {
            if (idx >= prev.length) return prev;
            const clamped = Math.max(0, Math.min(100, targetPct));
            const delta = clamped - prev[idx];
            // Absorb the delta from the next panel if it exists, else the previous
            const neighborIdx = idx + 1 < prev.length ? idx + 1 : idx - 1;
            if (neighborIdx < 0 || neighborIdx >= prev.length) return prev;
            const neighborNew = prev[neighborIdx] - delta;
            const neighborMeta = metaRef.current.get(orderRef.current[neighborIdx]);
            const neighborMin = neighborMeta?.minSize ?? 5;
            if (neighborNew < neighborMin) return prev; // don't collapse neighbor below minimum
            const next = [...prev];
            next[idx] = clamped;
            next[neighborIdx] = neighborNew;
            return next;
        });
    }, [])

    // Initialise sizes after first render (all panels registered)
    useEffect(() => {
        if (initialised.current || orderRef.current.length === 0) return
        initialised.current = true
        const ids = orderRef.current
        let total = 0
        const raw = ids.map((id) => {
            const d = metaRef.current.get(id)?.defaultSize ?? 33
            total += d
            return d
        })
        setSizes(raw.map((s) => (s / total) * 100))
    }, [])

    return (
        <GroupCtx.Provider value={{ direction, sizes, setSizes, containerRef, registerPanel, getIndex, getPanelMeta, setPanelSize }}>
            <div
                ref={containerRef}
                className={cn(
                    "flex h-full w-full overflow-hidden",
                    direction === "horizontal" ? "flex-row" : "flex-col",
                    className
                )}
                style={style}
            >
                {children}
            </div>
        </GroupCtx.Provider>
    )
}

// ─── ResizablePanel ───────────────────────────────────────────────────────────

interface ResizablePanelProps {
    defaultSize?: number
    minSize?: number
    maxSize?: number
    id?: string
    className?: string
    style?: CSSProperties
    children?: ReactNode
    collapsible?: boolean
    collapsedSize?: number
    onCollapse?: () => void
    onExpand?: () => void
    onResize?: (size: number) => void
}

function ResizablePanel({
    defaultSize = 33,
    minSize = 10,
    maxSize = 90,
    id: idProp,
    className,
    style,
    children,
}: ResizablePanelProps) {
    const autoId = useId()
    const id = idProp ?? autoId
    const { registerPanel, getIndex, sizes, direction, setPanelSize: setPanelSizeCtx } = useGroupCtx()

    // Register synchronously during first render — only once
    useState(() => {
        registerPanel(id, { defaultSize, minSize, maxSize })
        return true
    })

    const index = getIndex(id)
    const pct = sizes[index]

    const sizeStyle: CSSProperties =
        pct !== undefined
            ? direction === "horizontal"
                ? { width: `${pct}%`, minWidth: `${minSize}%`, maxWidth: `${maxSize}%`, flexShrink: 0 }
                : { height: `${pct}%`, minHeight: `${minSize}%`, maxHeight: `${maxSize}%`, flexShrink: 0 }
            : { flex: "1 1 0" }

    return (
        <div
            data-panel-id={id}
            className={cn("overflow-hidden", className)}
            style={{ ...sizeStyle, ...style }}
        >
            {children}
        </div>
    )
}

// ─── ResizableHandle ─────────────────────────────────────────────────────────

/**
 * Access the parent ResizablePanelGroup's programmatic resize API.
 * Must be called inside a component that is a descendant of ResizablePanelGroup.
 */
export function useResizablePanelGroup() {
    const ctx = useContext(GroupCtx)
    if (!ctx) throw new Error("useResizablePanelGroup must be used inside ResizablePanelGroup")
    return { setPanelSize: ctx.setPanelSize }
}

interface ResizableHandleProps {
    withHandle?: boolean
    className?: string
    id?: string
}

function ResizableHandle({ withHandle, className }: ResizableHandleProps) {
    const { direction, sizes, setSizes, containerRef, getPanelMeta } = useGroupCtx()
    const handleRef = useRef<HTMLDivElement>(null)
    const dragState = useRef<{ startPos: number; startSizes: number[]; handleIdx: number } | null>(null)

    // Determine this handle's index among all handles in the container
    const getHandleIndex = useCallback(() => {
        if (!handleRef.current || !containerRef.current) return -1
        const handles = Array.from(containerRef.current.querySelectorAll("[data-resize-handle]"))
        return handles.indexOf(handleRef.current)
    }, [containerRef])

    const onMouseDown = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault()
            const hi = getHandleIndex()
            if (hi === -1) return

            dragState.current = {
                startPos: direction === "horizontal" ? e.clientX : e.clientY,
                startSizes: [...sizes],
                handleIdx: hi,
            }

            if (handleRef.current) {
                handleRef.current.setAttribute("data-resize-handle-active", "true")
            }

            const onMove = (ev: MouseEvent) => {
                if (!dragState.current || !containerRef.current) return
                const { startPos, startSizes, handleIdx } = dragState.current

                const totalPx =
                    direction === "horizontal"
                        ? containerRef.current.getBoundingClientRect().width
                        : containerRef.current.getBoundingClientRect().height
                if (totalPx === 0) return

                const curPos = direction === "horizontal" ? ev.clientX : ev.clientY
                const deltaPct = ((curPos - startPos) / totalPx) * 100

                const leftIdx = handleIdx
                const rightIdx = handleIdx + 1

                setSizes((prev) => {
                    if (leftIdx >= prev.length || rightIdx >= prev.length) return prev
                    const newLeft = startSizes[leftIdx] + deltaPct
                    const newRight = startSizes[rightIdx] - deltaPct
                    
                    const leftMeta = getPanelMeta(leftIdx)
                    const rightMeta = getPanelMeta(rightIdx)
                    const leftMin = leftMeta?.minSize ?? 10
                    const rightMin = rightMeta?.minSize ?? 10
                    const leftMax = leftMeta?.maxSize ?? 90
                    const rightMax = rightMeta?.maxSize ?? 90
                    
                    if (newLeft < leftMin || newRight < rightMin || newLeft > leftMax || newRight > rightMax) return prev
                    const next = [...prev]
                    next[leftIdx] = newLeft
                    next[rightIdx] = newRight
                    return next
                })
            }

            const onUp = () => {
                dragState.current = null
                if (handleRef.current) {
                    handleRef.current.removeAttribute("data-resize-handle-active")
                }
                window.removeEventListener("mousemove", onMove)
                window.removeEventListener("mouseup", onUp)
            }

            window.addEventListener("mousemove", onMove)
            window.addEventListener("mouseup", onUp)
        },
        [direction, sizes, setSizes, containerRef, getHandleIndex]
    )

    const isHoriz = direction === "horizontal"

    return (
        <div
            ref={handleRef}
            data-resize-handle=""
            role="separator"
            tabIndex={0}
            aria-orientation={isHoriz ? "vertical" : "horizontal"}
            onMouseDown={onMouseDown}
            className={cn(
                "relative flex shrink-0 select-none items-center justify-center bg-transparent",
                "before:absolute before:bg-slate-800 before:transition-colors",
                "hover:before:bg-slate-600",
                "[&[data-resize-handle-active]]:before:bg-blue-500",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500",
                isHoriz
                    ? "w-2 cursor-col-resize flex-col before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2"
                    : "h-2 w-full cursor-row-resize flex-row before:inset-x-0 before:top-1/2 before:h-px before:-translate-y-1/2",
                className
            )}
        >
            {withHandle && (
                <div className={cn(
                    "z-10 flex items-center justify-center rounded-sm border border-slate-700 bg-slate-900 shadow-md",
                    isHoriz ? "h-6 w-3" : "h-3 w-6"
                )}>
                    <GripVertical className={cn("h-3 w-3 text-slate-500", !isHoriz && "rotate-90")} />
                </div>
            )}
        </div>
    )
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }