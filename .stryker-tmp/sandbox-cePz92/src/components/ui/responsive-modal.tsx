// @ts-nocheck
import * as React from "react"
import { useMediaQuery } from "@/hooks/use-media-query"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer"
import { cn } from "@/lib/utils"

interface ResponsiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string; // Added to DialogContent/DrawerContent
  desktopClassName?: string;
}

export function ResponsiveModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  desktopClassName,
}: ResponsiveModalProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)")

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={cn("max-w-2xl max-h-[85vh] flex flex-col p-6", desktopClassName, className)}>
          {(title || description) && (
            <DialogHeader className="shrink-0 text-left">
              {title && <DialogTitle>{title}</DialogTitle>}
              {description && <DialogDescription>{description}</DialogDescription>}
            </DialogHeader>
          )}
          <div className="overflow-y-auto flex-1 custom-scrollbar px-1">
            {children}
          </div>
          {footer && (
            <div className="shrink-0 pt-4 border-t mt-auto">
              {footer}
            </div>
          )}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className={cn("max-h-[85vh] flex flex-col", className)}>
        <div className="mx-auto w-full max-w-md flex flex-col flex-1 overflow-hidden">
          {(title || description) && (
            <DrawerHeader className="text-left shrink-0">
              {title && <DrawerTitle>{title}</DrawerTitle>}
              {description && <DrawerDescription>{description}</DrawerDescription>}
            </DrawerHeader>
          )}
          <div className="overflow-y-auto flex-1 custom-scrollbar px-4 pb-4" data-vaul-no-drag>
            {children}
          </div>
          {footer && (
            <div className="shrink-0 p-4 border-t mt-auto">
              {footer}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
