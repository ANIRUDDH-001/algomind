import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createServerSupabase } from '@/lib/supabase/server';
import { getSpacedRepForProblem } from '@/app/actions/spaced-repetition';
import { getGlobalFeatureFlag } from '@/lib/feature-flags-server';
import { AnalysisClient } from '@/components/analysis/AnalysisClient';
import type { FeatureFlagKey } from '@/lib/feature-flags';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
    searchParams,
}: {
    searchParams: Promise<{ sessionId?: string }>;
}): Promise<Metadata> {
    const params = await searchParams;
    const sessionId = params.sessionId;
    if (!sessionId) return { title: 'Analysis | AlgoMind' };

    try {
        const supabase = await createServerSupabase();
        const { data } = await supabase
            .from('interview_sessions')
            .select('problem_title')
            .eq('id', sessionId)
            .single();

        const title = data?.problem_title || 'Interview';
        return {
            title: `${title} — Performance Analysis | AlgoMind`,
            description: `Detailed cognitive skill analysis and performance breakdown for ${title}.`,
        };
    } catch {
        return { title: 'Performance Analysis | AlgoMind' };
    }
}

interface TranscriptTurn {
    speaker: string;
    text: string;
    timestamp?: number;
}

export default async function AnalysisPage({
    searchParams,
}: {
    searchParams: Promise<{ sessionId?: string }>;
}) {
    const params = await searchParams;
    const sessionId = params.sessionId;

    if (!sessionId) {
        redirect('/practice');
    }

    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    // 1. Fetch interview session
    const { data: session } = await supabase
        .from('interview_sessions')
        .select('id, user_id, problem_id, problem_title, problem_difficulty, transcript, duration, overall_score, completed_at, status')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .single();

    if (!session) {
        redirect('/practice');
    }

    // 2. Fetch assessment
    const { data: assessment } = await supabase
        .from('assessments')
        .select(`
            overall_score, adjusted_score, problem_decomposition, pattern_recognition, algorithmic_thinking, 
            complexity_analysis, communication_clarity, edge_case_awareness, 
            optimization_mindset, debugging_approach, overall_feedback, next_steps, 
            skill_evidence, sub_criteria, code_quality
        `)
        .eq('session_id', sessionId)
        .maybeSingle();

    // 3. Fetch SM2 data
    const sm2Data = await getSpacedRepForProblem(user.id, session.problem_id);

    // 4. Previous attempts for comparison
    const { data: previousAttempts } = await supabase
        .from('interview_sessions')
        .select('id, overall_score, completed_at, duration')
        .eq('user_id', user.id)
        .eq('problem_id', session.problem_id)
        .neq('id', sessionId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(3);

    // 5. Feature flags
    const enableComparative = await getGlobalFeatureFlag('ENABLE_COMPARATIVE_ANALYSIS' as FeatureFlagKey);
    const enableLearnMode = await getGlobalFeatureFlag('ENABLE_LEARN_MODE' as FeatureFlagKey);

    return (
        <AnalysisClient
            session={{
                id: session.id,
                problemId: session.problem_id,
                problemTitle: session.problem_title || 'Untitled Problem',
                problemDifficulty: session.problem_difficulty || 'medium',
                transcript: (session.transcript || []) as TranscriptTurn[],
                duration: session.duration || 0,
                overallScore: session.overall_score || 0,
                completedAt: session.completed_at,
            }}
            assessment={assessment ? {
                overallScore: assessment.overall_score || 0,
                adjustedScore: assessment.adjusted_score || assessment.overall_score || 0,
                skills: {
                    'problem-decomposition': assessment.problem_decomposition || 0,
                    'pattern-recognition': assessment.pattern_recognition || 0,
                    'algorithmic-thinking': assessment.algorithmic_thinking || 0,
                    'complexity-analysis': assessment.complexity_analysis || 0,
                    'communication-clarity': assessment.communication_clarity || 0,
                    'edge-case-awareness': assessment.edge_case_awareness || 0,
                    'optimization-mindset': assessment.optimization_mindset || 0,
                    'debugging-approach': assessment.debugging_approach || 0,
                },
                overallFeedback: assessment.overall_feedback || '',
                nextSteps: assessment.next_steps || [],
                skillEvidence: assessment.skill_evidence || {},
                subCriteria: assessment.sub_criteria || {},
                codeQuality: assessment.code_quality as any || null,
            } : null}
            sm2={sm2Data}
            previousAttempts={(previousAttempts || []).map(a => ({
                id: a.id,
                score: a.overall_score || 0,
                completedAt: a.completed_at,
                duration: a.duration || 0,
            }))}
            flags={{
                enableComparative: !!enableComparative,
                enableLearnMode: !!enableLearnMode,
            }}
        />
    );
}
