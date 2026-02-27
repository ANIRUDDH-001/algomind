import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { isOwnerOrCoOwner } from '@/lib/auth/account-type';
import { Redis } from '@upstash/redis';

// Note: Using standard app config for Redis if available, or just letting DB run it. 
// We will call the standard internal '/api/flags' method because it already exists and has redis integration!
// Wait - the original plan was to build a new one. I'll just proxy the existing '/api/flags' logic but with owner auth.
// Actually, it's better to reuse the robust '/api/flags' we already have, but we'll reimplement it cleanly here.

export async function PATCH(req: NextRequest) {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const isOwner = await isOwnerOrCoOwner(user.id);
    if (!isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    try {
        const { key, isEnabled } = await req.json();
        if (!key) return NextResponse.json({ error: 'Missing flag key' }, { status: 400 });

        // Update DB
        const { error } = await supabase
            .from('global_feature_flags')
            .update({ is_enabled: isEnabled, updated_at: new Date().toISOString(), updated_by: user.id })
            .eq('key', key);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Attempt Redis cache clearing (silent fail if Redis is unavailable)
        try {
            if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
                const redis = new Redis({
                    url: process.env.UPSTASH_REDIS_REST_URL,
                    token: process.env.UPSTASH_REDIS_REST_TOKEN,
                });
                await redis.del('algomind:global_flags');
            }
        } catch (redisErr) {
            console.warn('Failed to clear redis flags cache:', redisErr);
        }

        return NextResponse.json({ success: true, key, isEnabled });
    } catch (err) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
