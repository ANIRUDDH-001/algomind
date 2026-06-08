/**
 * @codesage
 * @file      src/app/interview/analysis/page.tsx
 * @purpose   Server component fetching and passing analysis data to the AnalysisClient.
 * @tech      React, Next.js, Supabase
 * @connects  AnalysisClient, server actions
 * @apis      None
 * @db        interview_sessions, problems, assessments
 * @state     None
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createServerSupabase } from '@/lib/supabase/server';
import { getSpacedReviewForProblem } from '@/app/actions/spaced-repetition';
import { getGlobalFeatureFlag } from '@/lib/feature-flags-server';
import { AnalysisClient } from '@/components/analysis/AnalysisClient';
import type { FeatureFlagKey } from '@/lib/feature-flags';
import { tagsToFirstConceptSlug } from '@/lib/knowledge-graph/tag-concept-map';

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
    searchParams: Promise<{ sessionId?: string; pending?: string }>;
}) {
    const params = await searchParams;
    const sessionId = params.sessionId;
    const isPending = params.pending === 'true';

    if (!sessionId) {
        redirect('/dashboard');
    }

    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    // 1. Fetch interview session
    const { data: session } = await supabase
        .from('interview_sessions')
        .select('id, user_id, problem_id, problem_title, problem_difficulty, transcript, duration, overall_score, completed_at, status, difficulty_mode')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .single();

    if (!session) {
        redirect('/dashboard');
    }

    const { data: problemData } = await supabase
        .from('problems')
        .select('tags, primary_pattern')
        .eq('id', session.problem_id)
        .maybeSingle();

    const learnConceptSlug = problemData
        ? tagsToFirstConceptSlug(problemData.tags ?? [], problemData.primary_pattern ?? null)
        : null;

    // Detect limited evidence from transcript turn count
    const userTurnCount = ((session.transcript || []) as TranscriptTurn[]).filter(t => t.speaker === 'user' || t.speaker === 'USER').length;
    const isLimitedEvidence = userTurnCount <= 5;

    // 2. Fetch assessment
    const { data: assessment } = await supabase
        .from('assessments')
        .select(`
            overall_score, adjusted_score, hire_decision, problem_decomposition, pattern_recognition, algorithmic_thinking, 
            complexity_analysis, communication_clarity, edge_case_awareness, 
            optimization_mindset, debugging_approach, overall_feedback, next_steps, 
            skill_evidence, sub_criteria, code_quality
        `)
        .eq('session_id', sessionId)
        .maybeSingle();

    // 3. Fetch review schedule data
    const reviewData = await getSpacedReviewForProblem(user.id, session.problem_id);

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
                difficultyMode: session.difficulty_mode || undefined,
                status: session.status || 'completed',
                isLimitedEvidence,
                learnConceptSlug,
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
                hireDecision: assessment.hire_decision || null,
                keyMoments: (() => {
                    const raw = (assessment.skill_evidence as any)?.keyMoments;
                    if (Array.isArray(raw) && raw.length > 0) return raw;
                    // Fallback: synthesize from per-dimension evidence strings
                    const fallback: any[] = [];
                    const evidence = assessment.skill_evidence as Record<string, any> | null;
                    if (evidence) {
                        for (const [dim, data] of Object.entries(evidence)) {
                            if (dim === 'keyMoments' || dim === 'improvementExamples' || !data?.evidence) continue;
                            const quotes: string[] = Array.isArray(data.evidence) ? data.evidence : [];
                            for (const q of quotes.slice(0, 1)) {
                                // Skip fallback/error evidence strings that aren't real candidate quotes
                                if (!q || q.toLowerCase().includes('fallback') || q.toLowerCase().includes('ai analysis')) continue;
                                const score = data.score ?? 0;
                                const sentiment = score >= 6 ? 'positive' as const : score <= 3 ? 'negative' as const : 'neutral' as const;
                                const type = score >= 6 ? 'impressive' as const : score <= 3 ? 'gap' as const : 'notable' as const;
                                fallback.push({
                                    timestampIndex: 0,
                                    momentType: score >= 6 ? 'impressive_statement' : score <= 3 ? 'missed_opportunity' : 'approach_identified',
                                    type,
                                    quote: typeof q === 'string' ? q.slice(0, 60) : '',
                                    significance: `Evidence from ${dim.replace(/-/g, ' ')}`,
                                    dimension: dim,
                                    sentiment,
                                });
                            }
                        }
                    }
                    return fallback;
                })(),
                improvementExamples: (assessment.skill_evidence as any)?.improvementExamples || [],
            } : null}
            reviewData={reviewData}
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
            assessmentStatus={isPending || !assessment ? 'pending' : 'ready'}
        />
    );
}
