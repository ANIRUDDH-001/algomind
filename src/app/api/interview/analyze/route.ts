import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { CognitiveAnalyzer } from '@/lib/assessment/analyzer';
import type { ConversationTurn } from '@/lib/assessment/prompts';
import type { DifficultyMode } from '@/lib/interview/interview-config';
import { logSystemEvent } from '@/lib/monitoring/events';
import { checkIpRateLimit } from '@/lib/rate-limit/ip-rate-limiter';
import { checkUserRateLimit } from '@/lib/rate-limit/user-rate-limiter';

export const maxDuration = 60;

/**
 * POST /api/interview/analyze
 *
 * Server-side assessment endpoint. CognitiveAnalyzer requires AI API keys
 * that only exist server-side — running it client-side in useAssessment
 * was the root cause of 0-score assessments (A1 fix).
 */
export async function POST(req: NextRequest) {
    try {
        const supabase = await createServerSupabase();
        const { data: { user } } = await supabase.auth.getUser();

        // Rate limiting: authenticated users use their daily quota, guests use IP limit
        if (user) {
            const rateLimit = await checkUserRateLimit(user.id);
            if (!rateLimit.allowed) {
                return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
            }
        } else {
            const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
                ?? req.headers.get('x-real-ip')
                ?? 'unknown';
            const ipLimit = await checkIpRateLimit(ip, { maxRequests: 20, windowSeconds: 86400 });
            if (!ipLimit.success) {
                return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
            }
        }

        const body = await req.json().catch(() => null);
        if (!body) {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
        }

        const { sessionId, problem, transcript } = body as {
            sessionId?: string;
            problem?: {
                title: string;
                description: string;
                difficulty: string;
                difficultyMode?: DifficultyMode | 'employer';
            };
            transcript?: ConversationTurn[];
        };

        if (!sessionId || !problem || !transcript || !Array.isArray(transcript)) {
            return NextResponse.json(
                { error: 'Missing required fields: sessionId, problem, transcript' },
                { status: 400 }
            );
        }

        if (transcript.length < 2) {
            return NextResponse.json(
                { error: 'Conversation too short for analysis' },
                { status: 400 }
            );
        }

        console.log(`📊 [Analyze] Starting assessment for session ${sessionId}, user=${user?.id ?? 'guest'}`);

        const analyzer = new CognitiveAnalyzer();
        const assessment = await analyzer.analyze(sessionId, problem, transcript);

        console.log(`✅ [Analyze] Assessment complete: overall=${assessment.overallScore}, model=${assessment.modelUsed}`);

        return NextResponse.json(assessment);
    } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error('❌ [Analyze] Assessment failed:', errMsg);
        void logSystemEvent({
            type: 'model_error',
            errorMessage: `Assessment failed: ${errMsg}`,
        });
        return NextResponse.json(
            { error: errMsg || 'Assessment failed' },
            { status: 500 }
        );
    }
}
