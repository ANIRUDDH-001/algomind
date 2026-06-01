/**
 * @codesage
 * @file      src/app/learn/[slug]/not-found.tsx
 * @purpose   Displays a 404 error page when a requested concept slug is not found.
 * @tech      Next.js, React, Lucide React
 * @connects  None
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1
 */
'use client';

import { useRouter } from 'next/navigation';
import { BookOpen } from 'lucide-react';

export default function ConceptNotFound() {
  const router = useRouter();

  return (
    <div data-testid="not-found-page" className="flex-1 bg-[#0A0A0F] flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-4">📚</div>
        <h2 className="text-lg font-bold text-white mb-2">Concept not found</h2>
        <p className="text-sm text-zinc-400 mb-6">
          That concept does not exist or is not active yet. Choose from the knowledge map.
        </p>
        <button
          onClick={() => router.push('/learn')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors mx-auto"
        >
          <BookOpen size={14} />
          Back to Learn
        </button>
      </div>
    </div>
  );
}