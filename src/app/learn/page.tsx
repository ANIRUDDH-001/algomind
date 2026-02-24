import { redirect } from 'next/navigation';
import { getGlobalFeatureFlag } from '@/lib/feature-flags-server';
import { createServerSupabase } from '@/lib/supabase/server';
import { LearnSessionClient } from './LearnSessionClient';

export default async function LearnModePage({
    searchParams
}: {
    searchParams: { problemId?: string; fromSessionId?: string }
}) {
    const isEnabled = await getGlobalFeatureFlag('ENABLE_LEARN_MODE');
    if (!isEnabled) {
        redirect('/practice?toast=learn-coming-soon');
    }

    const { problemId, fromSessionId } = searchParams;
    if (!problemId) {
        redirect('/practice');
    }

    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    const { data: problem } = await supabase
        .from('problems')
        .select('*')
        .eq('id', problemId)
        .single();

    if (!problem) {
        redirect('/practice');
    }

    const memoryCountResult = await supabase
        .from('learner_profiles')
        .select('sessions_at_last_narrative')
        .eq('user_id', user.id)
        .maybeSingle();

    const sessionCount = memoryCountResult.data?.sessions_at_last_narrative || 0;

    return (
        <LearnSessionClient
            problem={problem}
            sessionCount={sessionCount}
            fromSessionId={fromSessionId}
        />
    );
}
