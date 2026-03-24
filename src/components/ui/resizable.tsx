"use client"

import * as React from "react"
import { GripVertical } from "lucide-react"
import {
  Group as ResizableGroup,
  Panel as ResizablePanelPrimitive,
  Separator as ResizableSeparator,
} from "react-resizable-panels"

import { cn } from "@/lib/utils"

type Direction = "horizontal" | "vertical"

const ResizablePanelGroup = ({
  direction = "horizontal",
  className,
  ...props
}: Omit<React.ComponentProps<typeof ResizableGroup>, "orientation"> & {
  direction?: Direction
}) => (
  <ResizableGroup
    orientation={direction}
    className={cn(
      "flex h-full w-full",
      className
    )}
    {...props}
  />
)

const ResizablePanel = ResizablePanelPrimitive

const ResizableHandle = ({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof ResizableSeparator> & {
  withHandle?: boolean
}) => (
  <ResizableSeparator
    className={cn(
      "relative flex w-2 shrink-0 items-center justify-center bg-transparent before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2 before:bg-zinc-700/80 hover:before:bg-indigo-400/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 data-[orientation=vertical]:h-2 data-[orientation=vertical]:w-full data-[orientation=vertical]:before:inset-x-0 data-[orientation=vertical]:before:inset-y-auto data-[orientation=vertical]:before:top-1/2 data-[orientation=vertical]:before:h-px data-[orientation=vertical]:before:w-full data-[orientation=vertical]:before:-translate-y-1/2 data-[orientation=vertical]:before:translate-x-0",
      className
    )}
    {...props}
  >
    {withHandle && (
      <div className="z-10 flex h-6 w-3 items-center justify-center rounded-sm border border-zinc-700 bg-zinc-900/90 data-[orientation=vertical]:h-3 data-[orientation=vertical]:w-6">
        <GripVertical className="h-3 w-3 text-zinc-400 data-[orientation=vertical]:rotate-90" />
      </div>
    )}
  </ResizableSeparator>
)

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
