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
        animate={{ x: currentIsOpen ? -actionWidth : 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        style={{ touchAction: "pan-y" }}
        className="relative z-10 w-full cursor-grab active:cursor-grabbing"
      >
        {children}
      </motion.div>
    </div>
  );
}
