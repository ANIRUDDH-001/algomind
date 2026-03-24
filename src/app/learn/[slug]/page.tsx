import { createServerSupabase } from '@/lib/supabase/server';
import { getKnowledgeGraphService } from '@/lib/knowledge-graph';
import { notFound, redirect } from 'next/navigation';
import LearnSessionPageClient from './LearnSessionPageClient';

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

  return <LearnSessionPageClient slug={slug} />;
}