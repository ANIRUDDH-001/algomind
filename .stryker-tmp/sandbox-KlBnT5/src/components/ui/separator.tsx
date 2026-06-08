/**
 * @codesage
 * @file      src/components/ui/separator.tsx
 * @purpose   Provides a standard semantic separator or divider built on Radix UI.
 * @tech      React, Radix UI, Tailwind CSS
 * @connects  Imports utility 'cn' from @/lib/utils.
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

import * as React from "react"
import * as SeparatorPrimitive from "@radix-ui/react-separator"

import { cn } from "@/lib/utils"

const Separator = React.forwardRef<
    React.ElementRef<typeof SeparatorPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(({ className, orientation = "horizontal", decorative = true, ...props }, ref) => (
    <SeparatorPrimitive.Root
        ref={ref}
        decorative={decorative}
        orientation={orientation}
        className={cn(
            "shrink-0 bg-border",
            orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
            className
        )}
        {...props}
    />
))
Separator.displayName = SeparatorPrimitive.Root.displayName

export { Separator }
