// Deno edge function - runs on Supabase Edge (not Node.js).
// TypeScript IDE errors about 'Deno' and 'esm.sh' imports are EXPECTED
// and harmless - this file is never compiled by the Next.js/Node.js tsconfig.
// It runs in the Supabase Deno runtime. Deploy with:
//   supabase functions deploy review-reminders --no-verify-jwt
// Deploy: supabase functions deploy review-reminders --no-verify-jwt
// Schedule: Add to Supabase Dashboard > Edge Functions > Schedules: 0 8 * * * (8am daily)

// @ts-expect-error: Deno is not defined in Next.js tsconfig
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// @ts-expect-error: Deno URL imports are not resolved by Next.js tsconfig
import { timingSafeEqual } from 'https://deno.land/std@0.208.0/crypto/timing_safe_equal.ts';

// @ts-expect-error: Deno is not defined in Next.js tsconfig
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
// @ts-expect-error: Deno is not defined in Next.js tsconfig
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function extractCandidateSecret(req: Request): string | null {
    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
        return authHeader.slice(7).trim();
    }

    return req.headers.get('x-internal-secret')?.trim() ?? null;
}

function secretsMatchTimingSafe(provided: string, expected: string): boolean {
    const encoder = new TextEncoder();
    const a = encoder.encode(provided);
    const b = encoder.encode(expected);

    if (a.byteLength !== b.byteLength) {
        return false;
    }

    return timingSafeEqual(a, b);
}

// @ts-expect-error: Deno is not defined in Next.js tsconfig
Deno.serve(async (req: Request) => {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const providedSecret = extractCandidateSecret(req);
    // @ts-expect-error: Deno is not defined in Next.js tsconfig
    const expectedSecret = Deno.env.get('INTERNAL_API_SECRET')?.trim() ?? '';

    if (!providedSecret || !expectedSecret || !secretsMatchTimingSafe(providedSecret, expectedSecret)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const nowIso = new Date().toISOString();
        const weekAgoIso = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)).toISOString();

        const { data: dueRows, error: dueError } = await supabase
            .from('spaced_repetition')
            .select('user_id')
            .lte('fsrs_due', nowIso)
            .gte('fsrs_due', weekAgoIso);

        if (dueError) {
            throw dueError;
        }

        const dueCounts = new Map<string, number>();
        for (const row of dueRows ?? []) {
            dueCounts.set(row.user_id, (dueCounts.get(row.user_id) ?? 0) + 1);
        }

        let reminded = 0;

        for (const [userId, dueCount] of dueCounts.entries()) {
            const { data: preferences, error: prefsError } = await supabase
                .from('user_preferences')
                .select('email_notifications, practice_reminders')
                .eq('user_id', userId)
                .maybeSingle();

            if (prefsError) {
                throw prefsError;
            }

            const emailNotificationsEnabled = preferences?.email_notifications ?? true;
            const practiceRemindersEnabled = preferences?.practice_reminders ?? true;

            if (!emailNotificationsEnabled || !practiceRemindersEnabled) {
                continue;
            }

            const { data: userResult, error: userError } = await supabase.auth.admin.getUserById(userId);
            if (userError || !userResult.user?.email) {
                continue;
            }

            // TODO: Replace system_events logging with actual email send once SMTP is configured.
            // Options: Supabase SMTP settings (Settings > Auth > SMTP), Resend free tier (3000/mo),
            // or Brevo free tier (300/day). All require zero code changes here - just set
            // SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in Supabase edge function secrets.
            const { error: eventError } = await supabase
                .from('system_events')
                .insert({
                    type: 'edge.review_reminders_queued',
                    user_id: userId,
                    metadata: {
                        dueCount,
                        email: userResult.user.email,
                    },
                });

            if (!eventError) {
                reminded += 1;
            }
        }

        return new Response(JSON.stringify({
            processed: dueCounts.size,
            reminded,
        }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await supabase
            .from('system_events')
            .insert({
                type: 'edge.review_reminders_failed',
                metadata: {
                    error: message,
                },
            });
        return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
});
