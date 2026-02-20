import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { fetchAndSaveLeetCodeProfile } from '@/lib/leetcode/client';
import { getRedis } from '@/lib/upstash/client';

export async function POST(req: NextRequest) {
    try {
        const supabase = await createServerSupabase();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const redis = getRedis();
        const limitKey = `lc_refresh:${user.id}`;

        // Check rate limit: 1 hour cooldown for manual refresh
        if (redis) {
            const isLimited = await redis.get(limitKey);
            if (isLimited) {
                return NextResponse.json({ error: 'Can refresh once per hour' }, { status: 429 });
            }
        }

        // Get username from prefs
        const { data: prefs } = await supabase
            .from('user_preferences')
            .select('leetcode_username')
            .eq('user_id', user.id)
            .single();

        if (!prefs || !prefs.leetcode_username) {
            return NextResponse.json({ error: 'No LeetCode profile connected' }, { status: 400 });
        }

        // Set rate limit (3600s = 1 hour)
        if (redis) {
            await redis.set(limitKey, 'limited', { ex: 3600 });
        }

        // Trigger manual refresh
        void fetchAndSaveLeetCodeProfile(user.id, prefs.leetcode_username);

        return NextResponse.json({ triggered: true });
    } catch (error) {
        console.error('[LeetCode Refresh] Exception:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
