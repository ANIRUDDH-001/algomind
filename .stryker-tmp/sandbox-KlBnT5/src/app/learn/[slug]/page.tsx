/**
 * @codesage
 * @file      src/app/learn/[slug]/page.tsx
 * @purpose   Server component that validates the requested concept slug and renders the learning session client within an error boundary.
 * @tech      Next.js, Supabase
 * @connects  Imports LearnSessionPageClient, LearnErrorFallback, getKnowledgeGraphService
 * @apis      None
 * @db        Supabase Auth
 * @state     None
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

import { createServerSupabase } from '@/lib/supabase/server';
import { getKnowledgeGraphService } from '@/lib/knowledge-graph';
import { notFound, redirect } from 'next/navigation';
import LearnSessionPageClient from './LearnSessionPageClient';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LearnErrorFallback } from './LearnErrorFallback';

interface LearnSessionPageProps {
  params: Promise<{ slug: string }>;
}

export default async function LearnSessionPage({ params }: LearnSessionPageProps) {
  const { slug } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const concepts = await getKnowledgeGraphService().getConceptSummaries(user.id);
  const slugExists = concepts.some((concept) => concept.slug === slug);

  if (!slugExists) {
    notFound();
  }

  return (
    <ErrorBoundary fallback={<LearnErrorFallback conceptSlug={slug} />}>
      <LearnSessionPageClient slug={slug} />
    </ErrorBoundary>
  );
}