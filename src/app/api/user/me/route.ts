import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { logSystemEvent } from '@/lib/monitoring/events';

export async function GET(req: NextRequest) {
    try {
        const supabase = await createServerSupabase();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            const isE2EFallback =
                (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') &&
                req.cookies.get('playwright-e2e')?.value === 'true';

            if (isE2EFallback) {
                return NextResponse.json({
                    id: 'test-user',
                    email: 'test@example.com',
                    placementMonth: null,
                    emailNotifications: true,
                    practiceReminders: true,
                });
            }

            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: preferences } = await supabase
            .from('user_preferences')
            .select('placement_month, email_notifications, practice_reminders')
            .eq('user_id', user.id)
            .maybeSingle();

        return NextResponse.json({
            id: user.id,
            email: user.email,
            placementMonth: preferences?.placement_month ?? null,
            emailNotifications: preferences?.email_notifications ?? true,
            practiceReminders: preferences?.practice_reminders ?? true,
        });
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error('[user/me] Error:', errMsg);
        await logSystemEvent({ type: 'route_error', errorMessage: errMsg, metadata: { route: 'user/me' } });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
