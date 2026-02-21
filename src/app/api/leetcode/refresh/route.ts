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
        const cooldownKey = `leetcode:refresh:${user.id}`;

        // Check rate limit: 1-hour cooldown for manual refresh
        if (redis) {
            const existing = await redis.get(cooldownKey);
            if (existing) {
                return NextResponse.json(
                    { error: 'LeetCode profile was recently refreshed. Please wait 1 hour between refreshes.' },
                    { status: 429 }
                );
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

        // Set cooldown BEFORE triggering the fetch (RC-02: prevent race between check and set)
        if (redis) {
            await redis.set(cooldownKey, '1', { ex: 3600 });
        }

        // Trigger manual refresh
        void fetchAndSaveLeetCodeProfile(user.id, prefs.leetcode_username);

        return NextResponse.json({ triggered: true });
    } catch (error) {
        console.error('[LeetCode Refresh] Exception:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
