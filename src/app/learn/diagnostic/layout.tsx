import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Diagnostic | AlgoMind',
  description: 'Quick assessment to calibrate your AlgoMind profile',
};

export default function DiagnosticLayout({ children }: { children: React.ReactNode }) {
  return children;
}