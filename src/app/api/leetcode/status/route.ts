import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export async function GET(_req: NextRequest) {
    try {
        const supabase = await createServerSupabase();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. Query leetcode_profiles and user_preferences
        const { data: profile } = await supabase
            .from('leetcode_profiles')
            .select('*')
            .eq('user_id', user.id)
            .single();

        const { data: prefs } = await supabase
            .from('user_preferences')
            .select('leetcode_fetch_status, leetcode_username')
            .eq('user_id', user.id)
            .single();

        // 2. If no row
        if (!profile && (!prefs || prefs.leetcode_fetch_status !== 'pending')) {
            return NextResponse.json({ connected: false });
        }

        // 3. Return mapped profile
        return NextResponse.json({
            connected: true,
            username: profile?.username || prefs?.leetcode_username,
            totalSolved: profile?.total_solved || 0,
            easySolved: profile?.easy_solved || 0,
            mediumSolved: profile?.medium_solved || 0,
            hardSolved: profile?.hard_solved || 0,
            ranking: profile?.ranking || null,
            contestRating: profile?.contest_rating || null,
            fetchStatus: prefs?.leetcode_fetch_status || 'success',
            lastFetchedAt: profile?.fetched_at || null
        });
    } catch (error) {
        console.error('[LeetCode Status] Exception:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
