/**
 * @codesage
 * @file      src/app/learn/diagnostic/layout.tsx
 * @purpose   Provides metadata and layout structure for the diagnostic assessment page.
 * @tech      Next.js
 * @connects  None
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1
 */
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Diagnostic | AlgoMind',
  description: 'Quick assessment to calibrate your AlgoMind profile',
};

export default function DiagnosticLayout({ children }: { children: React.ReactNode }) {
  return children;
}