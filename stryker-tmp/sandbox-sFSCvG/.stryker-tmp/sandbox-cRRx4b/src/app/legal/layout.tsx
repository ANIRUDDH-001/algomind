/**
 * @codesage
 * @file      src/app/legal/layout.tsx
 * @purpose   Layout wrapper for legal pages, providing a common back button and styling.
 * @tech      Next.js, Tailwind CSS, Lucide React
 * @connects  None
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--surface-base)' }}>
      <div className="max-w-3xl mx-auto px-6 py-12 pb-24 md:pb-12">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-zinc-500 hover:text-white transition-colors mb-8 text-sm font-bold uppercase tracking-widest"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to AlgoMind
        </Link>
        {children}
      </div>
    </div>
  );
}