import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

// Simple in-memory rate limiting map for verification attempts
// Key: IP Address, Value: { attempts: number, resetAt: number }
const rateLimitMap = new Map<string, { attempts: number; resetAt: number }>();
const MAX_ATTEMPTS = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const record = rateLimitMap.get(ip);

    // Cleanup expired records
    if (record && now > record.resetAt) {
        rateLimitMap.delete(ip);
        return true; // Allowed
    }

    if (record && record.attempts >= MAX_ATTEMPTS) {
        return false; // Rate limited
    }

    return true; // Allowed
}

function recordAttempt(ip: string) {
    const now = Date.now();
    const record = rateLimitMap.get(ip);

    if (record && now <= record.resetAt) {
        record.attempts += 1;
        rateLimitMap.set(ip, record);
    } else {
        rateLimitMap.set(ip, { attempts: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    }
}

export async function POST(req: Request) {
    try {
        const ip = req.headers.get('x-forwarded-for') || 'unknown';

        if (!checkRateLimit(ip)) {
            return NextResponse.json(
                { valid: false, reason: 'Too many attempts. Please try again later.' },
                { status: 429 }
            );
        }

        // Record attempt to count towards the rate limit
        recordAttempt(ip);

        const body = await req.json();
        const { publicToken, entryCode, candidateName, candidateEmail } = body;

        // 1. Validate body fields
        if (!publicToken || !entryCode || !candidateName || !candidateEmail) {
            return NextResponse.json(
                { valid: false, reason: 'Missing required fields' },
                { status: 400 }
            );
        }

        const supabase = await createServerSupabase();

        // 2. Call verify_campaign_entry_code RPC
        const { data: rpcData, error: rpcError } = await supabase.rpc('verify_campaign_entry_code', {
            p_public_token: publicToken,
            p_entry_code: entryCode.replace(/-/g, '').trim().toUpperCase()
        });

        // 3. Check validity
        if (rpcError) {
            return NextResponse.json(
                { valid: false, reason: rpcError.message || 'Verification failed' },
                { status: 400 }
            );
        }

        // rpcData can be a boolean or an object depending on postgres implementation.
        // Assuming the prompt implies it returns an object with `{ valid, reason, campaignId }`
        const isObject = typeof rpcData === 'object' && rpcData !== null;
        const valid = isObject ? !!(rpcData as any).valid : !!rpcData;
        const reason = isObject ? (rpcData as any).reason : 'Invalid entry code';

        if (!valid) {
            return NextResponse.json(
                { valid: false, reason: reason || 'Invalid entry code' },
                { status: 400 }
            );
        }

        // 4. Fetch campaign details
        const { data: campaign, error: campaignError } = await supabase
            .from('assessment_campaigns')
            .select(`
                id, 
                title, 
                time_limit_mins, 
                show_score_to_candidate, 
                campaign_questions,
                default_easy_mins, 
                default_medium_mins, 
                default_hard_mins
            `)
            .eq('public_token', publicToken)
            .single();

        if (campaignError || !campaign) {
            return NextResponse.json(
                { valid: false, reason: 'Campaign not found' },
                { status: 400 }
            );
        }

        // 5. Fetch problems details
        const campaignQuestions = campaign.campaign_questions || [];
        const problemIds = campaignQuestions.map((q: any) => q.problem_id).filter(Boolean);

        let questions: any[] = [];
        if (problemIds.length > 0) {
            const { data: problemsData, error: problemsError } = await supabase
                .from('problems')
                .select('id, title, description, difficulty, examples, hints, constraints')
                .in('id', problemIds);

            if (problemsError) {
                console.error('Failed to fetch problems:', problemsError);
            }

            const problems = problemsData || [];

            // 6. Map campaign_questions with actual problem data
            questions = campaignQuestions.map((cq: any) => {
                const problemData = problems.find((p: any) => p.id === cq.problem_id) || {};
                return {
                    ...problemData,
                    time_limit_mins: cq.time_limit_mins,
                    order: cq.order
                };
            }).sort((a: any, b: any) => (a.order || 0) - (b.order || 0)); // Ensure correct order
        }

        // Return standard format
        return NextResponse.json({
            valid: true,
            campaign,
            questions
        });

    } catch (e: any) {
        console.error('Verify code error:', e);
        return NextResponse.json(
            { valid: false, reason: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
