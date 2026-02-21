import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { fetchAndSaveLeetCodeProfile } from '@/lib/leetcode/client';
import { getRedis, redisDel } from '@/lib/upstash/client';

export async function POST(req: NextRequest) {
    try {
        const supabase = await createServerSupabase();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // ── 1-hour cooldown (same key space as /refresh so both routes share the limit) ──
        const redis = getRedis();
        const cooldownKey = `leetcode:refresh:${user.id}`;

        if (redis) {
            const existing = await redis.get(cooldownKey);
            if (existing) {
                return NextResponse.json(
                    { error: 'LeetCode profile was recently refreshed. Please wait 1 hour between refreshes.' },
                    { status: 429 }
                );
            }
        }

        const body = await req.json();
        const { username } = body;

        // 2. Validate username: 3-25 chars, alphanumeric + underscore + hyphen only
        if (!username || typeof username !== 'string' || !/^[a-zA-Z0-9_-]{3,25}$/.test(username)) {
            return NextResponse.json({ error: 'Invalid username format' }, { status: 400 });
        }

        // Fetch old preferences to get old username for cache clearing
        const { data: oldPrefs } = await supabase
            .from('user_preferences')
            .select('leetcode_username')
            .eq('user_id', user.id)
            .single();
        const oldUsername = oldPrefs?.leetcode_username;

        // 3. Upsert status to pending.
        const { error: dbError } = await supabase.from('user_preferences').upsert({
            user_id: user.id,
            leetcode_username: username,
            leetcode_fetch_status: 'pending'
        }, { onConflict: 'user_id' });

        if (dbError) {
            console.error('[LeetCode Connect] Error updating preferences:', dbError);
            return NextResponse.json({ error: 'Database error' }, { status: 500 });
        }

        // Clear the old cached profile so it triggers a fresh fetch and removes stale data
        await supabase
            .from('leetcode_profiles')
            .update({
                username: username,
                status: 'pending',
                last_fetched: null,
                solved_easy: null,
                solved_medium: null,
                solved_hard: null,
                total_solved: null,
            })
            .eq('user_id', user.id);

        // Clear associated Redis cache keys for the old username
        if (oldUsername) {
            await redisDel(`leetcode:profile:${user.id}`);
            await redisDel(`leetcode:fetching:${oldUsername}`);
        }

        // 4. Set cooldown BEFORE triggering the fetch so concurrent connect attempts are blocked
        if (redis) {
            await redis.set(cooldownKey, '1', { ex: 3600 });
        }

        // 5. Trigger immediate fetch (fire and forget)
        void fetchAndSaveLeetCodeProfile(user.id, username);

        return NextResponse.json({
            success: true,
            message: 'Profile connected. Data will sync within a minute.'
        });
    } catch (error) {
        console.error('[LeetCode Connect] Exception:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
