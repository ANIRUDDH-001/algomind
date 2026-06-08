// @ts-nocheck
'use server';

import { createServiceRoleSupabase } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function updateSystemConfig(key: string, value: any) {
    const supabase = await createServiceRoleSupabase();
    const { error } = await supabase
        .from('system_config')
        .upsert({ key, value: String(value) });

    if (error) throw new Error(`Failed to update config: ${error.message}`);
    revalidatePath('/owner/settings');
    revalidatePath('/owner/aws');
}

export async function updateFeatureFlag(key: string, isEnabled: boolean) {
    const supabase = await createServiceRoleSupabase();
    const { error } = await supabase
        .from('global_feature_flags')
        .update({ is_enabled: isEnabled })
        .eq('key', key);

    if (error) throw new Error(`Failed to update feature flag: ${error.message}`);
    revalidatePath('/owner/settings');
}

export async function setRateLimitOverride(email: string, limit: number | null) {
    const supabase = await createServiceRoleSupabase();
    const { data: user, error: userError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single();
        
    if (userError || !user) throw new Error('User not found');
    const { error } = await supabase
        .from('profiles')
        .update({ rate_limit_override: limit })
        .eq('id', user.id);

    if (error) throw new Error(`Failed to update rate limit: ${error.message}`);
    revalidatePath('/owner/rate-limits');
}

export async function updateUserAccountType(userId: string, targetType: string) {
    const supabase = await createServiceRoleSupabase();
    const { error } = await supabase
        .from('profiles')
        .update({ account_type: targetType })
        .eq('id', userId);

    if (error) throw new Error(`Failed to update account type: ${error.message}`);
    revalidatePath('/owner/users');
}

export async function toggleUserSuspension(userId: string, suspend: boolean) {
    const supabase = await createServiceRoleSupabase();
    const { error } = await supabase
        .from('profiles')
        .update({ is_suspended: suspend })
        .eq('id', userId);

    if (error) throw new Error(`Failed to toggle suspension: ${error.message}`);
    revalidatePath('/owner/users');
}

export async function updateUserTTSProvider(userId: string, provider: string) {
    const supabase = await createServiceRoleSupabase();
    const { error } = await supabase
        .from('user_preferences')
        .upsert({ user_id: userId, tts_provider: provider === 'auto' ? null : provider });

    if (error) throw new Error(`Failed to update TTS provider: ${error.message}`);
    revalidatePath('/owner/users');
}

export async function addAIModel(provider: string, details: any) {
    const supabase = await createServiceRoleSupabase();
    const { error } = await supabase
        .from('model_registry')
        .insert({ provider, ...details });

    if (error) throw new Error(`Failed to add model: ${error.message}`);
    revalidatePath('/owner/models');
}

export async function updateModelRouting(modelId: string, priority: number) {
    const supabase = await createServiceRoleSupabase();
    const { error } = await supabase
        .from('model_routing')
        .update({ priority })
        .eq('model_id', modelId);

    if (error) throw new Error(`Failed to update model routing: ${error.message}`);
    revalidatePath('/owner/models');
}

export async function addCoOwner(email: string) {
  const supabase = await createServiceRoleSupabase();
  const { data: user } = await supabase.from('profiles').select('id').eq('email', email).single();
  if (!user) throw new Error('User not found');
  await supabase.from('profiles').update({ account_type: 'owner' }).eq('id', user.id);
  revalidatePath('/owner/co-owners');
}

export async function removeCoOwner(userId: string) {
  const supabase = await createServiceRoleSupabase();
  await supabase.from('profiles').update({ account_type: 'admin' }).eq('id', userId);
  revalidatePath('/owner/co-owners');
}
