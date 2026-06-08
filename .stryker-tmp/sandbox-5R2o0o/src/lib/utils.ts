/**
 * @codesage
 * @file      src/lib/utils.ts
 * @purpose   Common utility functions.
 * @tech      Node.js
 * @connects  Imports app logic, configuration, and external library utilities
 * @apis      None directly visible
 * @db        None
 * @state     Stateless
 * @env       None
 * @issues    No major issues observed.
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// CVA 0.7.x changed its return type: calling a cva variant function now returns
// { root: 'className string', ... } instead of just a string.
// This shim extracts .root so all existing shadcn components work without changes.
function normalizeCvaValue(value: unknown): ClassValue {
  if (value && typeof value === 'object' && 'root' in value && typeof (value as Record<string, unknown>).root === 'string') {
    return (value as { root: string }).root as ClassValue;
  }
  return value as ClassValue;
}

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs.map(normalizeCvaValue)))
}