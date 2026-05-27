'use server';

import { getServiceClient } from '@/lib/supabase/service';
import { createServerSupabase } from '@/lib/supabase/server';
import { err, ok, type Result } from '@/lib/api/result';

export async function updateKaiMemory(userId: string, sessionSummary: string): Promise<Result<null>> {
    try {
        const serverSupabase = await createServerSupabase();
        const { data: { user } } = await serverSupabase.auth.getUser();
        if (!user || user.id !== userId) return err('Unauthorized', 'unauthorized');

        const supabase = getServiceClient();

        // 1. Get current Profile
        const { data: profile } = await supabase
            .from('learner_profiles')
            .select('kai_memory, sessions_at_last_narrative')
            .eq('user_id', userId)
            .maybeSingle();

        const currentMemory = profile?.kai_memory || '';
        const currentCount = profile?.sessions_at_last_narrative || 0;

        // 2. Append new summary
        let newMemory = currentMemory;
        if (newMemory) newMemory += '\n\n';
        newMemory += sessionSummary;

        // 3. Truncate memory to ~2000 chars (keep the end)
        if (newMemory.length > 2000) {
            newMemory = newMemory.slice(newMemory.length - 2000);
        }

        // 4. Upsert back
        await supabase
            .from('learner_profiles')
            .upsert({
                user_id: userId,
                kai_memory: newMemory,
                sessions_at_last_narrative: currentCount + 1,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });

        return ok(null);
    } catch (e) {
        console.error('[learn actions] Error updating Kai memory:', e);
        return err('Internal error', 'internal_error');
    }
}

export async function getKaiMemory(userId: string): Promise<Result<{ memory: string }>> {
    try {
        const serverSupabase = await createServerSupabase();
        const { data: { user } } = await serverSupabase.auth.getUser();
        if (!user || user.id !== userId) return err('Unauthorized', 'unauthorized');

        const supabase = getServiceClient();
        const { data: profile } = await supabase
            .from('learner_profiles')
            .select('kai_memory')
            .eq('user_id', userId)
            .maybeSingle();

        if (!profile) {
            // Create empty row
            await supabase.from('learner_profiles').insert({
                user_id: userId,
                kai_memory: '',
                updated_at: new Date().toISOString()
            });
            return ok({ memory: '' });
        }

        return ok({ memory: profile.kai_memory || '' });
    } catch (e) {
        console.error('[learn actions] Error fetching Kai memory:', e);
        return err('Internal error', 'internal_error');
    }
}

export async function recordLearnSession(params: {
    userId: string;
    problemId: string;
    conceptsCovered: string[];
    duration: number;
}): Promise<Result<null>> {
    try {
        const serverSupabase = await createServerSupabase();
        const { data: { user } } = await serverSupabase.auth.getUser();
        if (!user || user.id !== params.userId) return err('Unauthorized', 'unauthorized');

        const supabase = getServiceClient();

        // Log to system_events directly
        await supabase.from('system_events').insert({
            user_id: params.userId,
            type: 'learn_session_complete',
            metadata: {
                problemId: params.problemId,
                conceptsCovered: params.conceptsCovered,
                durationSeconds: params.duration
            }
        });

        return ok(null);
    } catch (e) {
        console.error('[learn actions] Error recording learn session:', e);
        return err('Internal error', 'internal_error');
    }
}
