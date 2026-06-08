/**
 * @codesage
 * @file      src/app/learn/page.tsx
 * @purpose   Server component for the Learn mode home, handling authentication, context retrieval, and displaying the ConceptPicker.
 * @tech      Next.js, Supabase, React
 * @connects  Imports ConceptPicker, knowledge-graph service, kai-context builder
 * @apis      None
 * @db        Supabase Auth
 * @state     None
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 

import { Suspense } from 'react';
import Link from 'next/link';
import { createServerSupabase } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ConceptPicker } from '@/components/learn/ConceptPicker';
import { getKnowledgeGraphService } from '@/lib/knowledge-graph';
import { buildStudentContext } from '@/lib/kai-context';

export const metadata = {
  title: 'Learn | AlgoMind',
  description: 'Master DSA concepts with Kai, your AI tutor',
};

export default async function LearnPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const context = await buildStudentContext(user.id);

  if (!context.hasCompletedDiagnostic) {
    redirect('/learn/diagnostic');
  }

  let summaries;
  try {
    summaries = await getKnowledgeGraphService().getConceptSummaries(user.id);
  } catch (err) {
    console.error('[LearnPage] KG service failed:', err);
    return (
      <div className="flex-1 bg-[#0A0A0F] flex items-center justify-center pb-20 md:pb-4">
        <div className="text-center max-w-md px-4">
          <h2 className="text-xl font-semibold text-white mb-2">Couldn&apos;t load concepts</h2>
          <p className="text-zinc-400 text-sm mb-6">
            Something went wrong fetching your learning data. Please try again.
          </p>
          <Link
            href="/learn"
            className="inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors"
          >
            Retry
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#0A0A0F]">
      <div className="max-w-5xl mx-auto px-4 py-8 pb-20 md:pb-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Learn with Kai</h1>
          <p className="text-zinc-400 mt-1 text-sm">
            Voice-first Socratic tutoring. Pick a concept and Kai will guide you through it.
          </p>
        </div>

        <Suspense fallback={<ConceptPickerSkeleton />}>
          <ConceptPicker
            concepts={summaries}
            studentContext={{
              hasCompletedDiagnostic: context.hasCompletedDiagnostic,
              nextRecommendedConcept: context.nextRecommendedConcept,
              weakestConcepts: context.weakestConcepts,
              subscription: context.subscription,
            }}
          />
        </Suspense>
      </div>
    </div>
  );
}

function ConceptPickerSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-24 rounded-xl bg-zinc-900/40 animate-pulse" />
      ))}
    </div>
  );
}
