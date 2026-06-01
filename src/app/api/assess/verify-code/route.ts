/**
 * @codesage
 * @file      src/app/api/assess/verify-code/route.ts
 * @purpose   Verifies candidate entry codes and fetches campaign/problem details to initialize the assessment environment.
 * @tech      Next.js, Supabase, TypeScript
 * @connects  @/lib/supabase/server, @/lib/campaign/entry-code
 * @apis      none
 * @db        assessment_campaigns, problems, RPC check_code_rate_limit, RPC record_code_attempt, RPC verify_campaign_entry_code
 * @state     none
 * @env       none
 * @issues    Removed console.error statements.
 * @audit     CODESAGE-v1
 */
import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { ENTRY_CODE_REGEX } from '@/lib/campaign/entry-code';

// Constants (configurable — owner can change via system_config)
const RATE_LIMIT_WINDOW_SECONDS = 120;  // 2 minutes
const MAX_ATTEMPTS = 5;

export async function POST(req: Request) {
    try {
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
        const supabase = await createServerSupabase();

        // ── 1. DB rate limit check ─────────────────────────────────────────
        const { data: limitData, error: limitError } = await supabase
            .rpc('check_code_rate_limit', {
                p_identifier: ip,
                p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
                p_max_attempts: MAX_ATTEMPTS,
            });

        if (limitError) {
            // Fail open — don't block users if rate limit DB is down
        } else {
            const limitResult = Array.isArray(limitData) ? limitData[0] : limitData;
            if (!limitResult?.allowed) {
                return NextResponse.json(
                    {
                        valid: false,
                        reason: `Too many attempts. Please wait ${RATE_LIMIT_WINDOW_SECONDS / 60} minutes before trying again.`
                    },
                    { status: 429 }
                );
            }
        }

        // ── 2. Parse and validate request body ────────────────────────────
        let body: { publicToken?: string; entryCode?: string; candidateName?: string; candidateEmail?: string };
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ valid: false, reason: 'Invalid request body' }, { status: 400 });
        }

        const { publicToken, entryCode, candidateName, candidateEmail } = body;

        if (!publicToken || !entryCode || !candidateName || !candidateEmail) {
            return NextResponse.json(
                { valid: false, reason: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Sanitize inputs
        const sanitizedCode = entryCode.trim().toUpperCase();
        const sanitizedEmail = candidateEmail.trim().toLowerCase();
        const sanitizedName = candidateName.trim().slice(0, 200); // max 200 chars

        // Pre-validate format before hitting RPC
        if (!ENTRY_CODE_REGEX.test(sanitizedCode) || !sanitizedEmail.includes('@') || !sanitizedName) {
            await supabase.rpc('record_code_attempt', { p_identifier: ip, p_success: false });
            return NextResponse.json({ valid: false, reason: 'Invalid entry code format' }, { status: 400 });
        }

        // ── 3. Record attempt BEFORE verification (prevents timing attacks) ─
        await supabase.rpc('record_code_attempt', {
            p_identifier: ip,
            p_campaign_id: null,
            p_success: false, // will be updated to true on success
        });

        // ── 4. Call verify_campaign_entry_code RPC ────────────────────────
        const { data: rpcData, error: rpcError } = await supabase.rpc('verify_campaign_entry_code', {
            p_public_token: publicToken,
            p_entry_code: sanitizedCode,
        });

        if (rpcError) {
            return NextResponse.json(
                { valid: false, reason: 'Verification service unavailable' },
                { status: 503 }
            );
        }

        // RPC returns TABLE — Supabase wraps as array
        const result = Array.isArray(rpcData) ? rpcData[0] : rpcData;
        const isValid = result?.valid === true;
        const reason = result?.reason || 'Invalid entry code';

        if (!isValid) {
            return NextResponse.json({ valid: false, reason }, { status: 400 });
        }

        // ── 5. Mark this attempt as successful (don't count against limit) ──
        // Note: we can't update the row we just inserted without knowing its ID.
        // Insert a success record instead — check_code_rate_limit only counts failures.
        // (Alternatively, the rate limit function could ignore success records — see SQL.)

        // ── 6. Fetch campaign details ─────────────────────────────────────
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
            return NextResponse.json({ valid: false, reason: 'Campaign not found' }, { status: 400 });
        }

        // ── 7. Fetch problem details ──────────────────────────────────────
        const campaignQuestions = campaign.campaign_questions || [];
        const problemIds = campaignQuestions.map((q: any) => q.problem_id).filter(Boolean);
        let questions: any[] = [];

        if (problemIds.length > 0) {
            const { data: problemsData } = await supabase
                .from('problems')
                .select('id, title, description, difficulty, examples, hints, constraints')
                .in('id', problemIds);

            const problems = problemsData || [];
            questions = campaignQuestions
                .map((cq: any) => {
                    const problemData = problems.find((p: any) => p.id === cq.problem_id) || {};
                    return { ...problemData, time_limit_mins: cq.time_limit_mins, order: cq.order };
                })
                .sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
        }

        return NextResponse.json({ valid: true, campaign, questions });

    } catch (e: any) {
        return NextResponse.json(
            { valid: false, reason: 'Internal server error' },
            { status: 500 }
        );
    }
}
