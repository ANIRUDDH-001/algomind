"use client";

import React, { ReactNode } from "react";
import { motion, useAnimation, PanInfo } from "framer-motion";

export interface SwipeableCardProps {
  children: ReactNode;
  actions: ReactNode;
  actionWidth?: number;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SwipeableCard({ children, actions, actionWidth = 100, isOpen, onOpenChange }: SwipeableCardProps) {
  const controls = useAnimation();
  const [internalIsOpen, setInternalIsOpen] = React.useState(false);

  const isControlled = isOpen !== undefined;
  const currentIsOpen = isControlled ? isOpen : internalIsOpen;

  React.useEffect(() => {
    if (currentIsOpen) {
      controls.start({ x: -actionWidth, transition: { type: "spring", stiffness: 400, damping: 30 } });
    } else {
      controls.start({ x: 0, transition: { type: "spring", stiffness: 400, damping: 30 } });
    }
  }, [currentIsOpen, actionWidth, controls]);

  const handleDragEnd = (event: any, info: PanInfo) => {
    const shouldOpen = info.offset.x < -actionWidth / 2;
    if (shouldOpen) {
      if (isControlled && onOpenChange) {
        onOpenChange(true);
      } else {
        setInternalIsOpen(true);
      }
    } else {
      if (isControlled && onOpenChange) {
        onOpenChange(false);
      } else {
        setInternalIsOpen(false);
      }
    }
  };

  return (
    <div className="relative overflow-hidden w-full">
      {/* Back layer (actions) */}
      <div 
        className="absolute inset-y-0 right-0 flex items-center justify-end z-0 pr-4"
        style={{ width: actionWidth }}
      >
        {actions}
      </div>

      {/* Front layer (card content) */}
      <motion.div
        drag="x"
        dragDirectionLock={true}
        dragConstraints={{ right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        animate={controls}
        initial={{ x: 0 }}
        style={{ touchAction: "pan-y" }}
        className="relative z-10 w-full cursor-grab active:cursor-grabbing"
      >
        {children}
      </motion.div>
    </div>
  );
}
