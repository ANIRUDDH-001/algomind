"use client"

import React from "react"
import { GripVertical } from "lucide-react"
import { Panel, Group, Separator } from "react-resizable-panels"

import { cn } from "@/lib/utils"

const ResizablePanelGroup = ({
    className,
    direction = "horizontal",
    style,
    ...props
}: React.ComponentProps<typeof Group> & { direction?: "horizontal" | "vertical" }) => (
    <Group
        className={cn(
            "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
            className
        )}
        // v4 API: direction is a CSS custom property, NOT a JSX prop.
        // The library reads --panel-group-direction from the element's style to
        // determine layout, set data-panel-group-direction, and wire drag handles.
        style={{
            "--panel-group-direction": direction,
            ...style,
        } as React.CSSProperties}
        {...props}
    />
)

const ResizablePanel = Panel

const ResizableHandle = ({
    withHandle,
    className,
    ...props
}: React.ComponentProps<typeof Separator> & {
    withHandle?: boolean
}) => (
    <Separator
        className={cn(
            // 8px wide hit area — wide enough to grab without hunting for 1px
            "relative flex w-2 shrink-0 items-center justify-center bg-transparent",
            // Inner visible divider via ::before so the hit area stays full-width
            "before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2 before:bg-slate-800 before:transition-colors",
            // Hover: widen the visible bar
            "hover:before:w-0.5 hover:before:bg-slate-600",
            // Active drag state
            "data-[resize-handle-active]:before:bg-blue-500",
            // Keyboard focus ring
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 focus-visible:ring-offset-1",
            // Correct cursors per direction
            "data-[panel-group-direction=vertical]:h-2 data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:cursor-row-resize",
            "data-[panel-group-direction=horizontal]:cursor-col-resize",
            // Rotate grip icon for vertical panels
            "[&[data-panel-group-direction=vertical]>div]:rotate-90",
            className
        )}
        {...props}
    >
        {withHandle && (
            <div className="z-10 flex h-6 w-3 items-center justify-center rounded-sm border border-slate-700 bg-slate-900 shadow-md">
                <GripVertical className="h-3 w-3 text-slate-500" />
            </div>
        )}
    </Separator>
)

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }