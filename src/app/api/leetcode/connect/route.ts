import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { fetchAndSaveLeetCodeProfile } from '@/lib/leetcode/client';

export async function POST(req: NextRequest) {
    try {
        const supabase = await createServerSupabase();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { username } = body;

        // 1. Validate username: 3-25 chars, alphanumeric + underscore + hyphen only
        if (!username || typeof username !== 'string' || !/^[a-zA-Z0-9_-]{3,25}$/.test(username)) {
            return NextResponse.json({ error: 'Invalid username format' }, { status: 400 });
        }

        // 2. Upsert status to pending. 
        // Note: Storing fetch_status in user_preferences to match client.ts logic that expects 'leetcode_fetch_status'
        const { error } = await supabase.from('user_preferences').upsert({
            user_id: user.id,
            leetcode_username: username,
            leetcode_fetch_status: 'pending'
        }, { onConflict: 'user_id' });

        if (error) {
            console.error('[LeetCode Connect] Error updating preferences:', error);
            return NextResponse.json({ error: 'Database error' }, { status: 500 });
        }

        // 3. Trigger immediate fetch (fire and forget)
        void fetchAndSaveLeetCodeProfile(user.id, username);

        // 4. Return success
        return NextResponse.json({
            success: true,
            message: 'Profile connected. Data will sync within a minute.'
        });
    } catch (error) {
        console.error('[LeetCode Connect] Exception:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
