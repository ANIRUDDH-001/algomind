// @ts-nocheck
import { createServerSupabase } from '@/lib/supabase/server';
import { SettingsClient } from './SettingsClient';
import { SYSTEM_CONFIG_DEFAULTS } from '@/lib/config/system-config-keys';

const CONFIG_KEY_DESCRIPTIONS: Record<string, any> = {
    cross_tier_fallback_enabled: { label: 'Cross-Tier Fallback Enabled', description: 'If true, chat and analysis model routes can fallback across tiers when a route is unavailable.', type: 'boolean' },
    primary_owner_email: { label: 'Primary Owner Email', description: 'Primary owner identity used for owner-level security and operational workflows.', type: 'string' },
    free_tier_weekly_interview_limit: { label: 'Free Tier — Interview Sessions / Week', description: 'Max interview sessions per week for free users. Default: 5', type: 'number' },
    free_tier_weekly_learn_limit: { label: 'Free Tier — Learn Sessions / Week', description: 'Max Kai-Tutor learn sessions per week for free users. Default: 5', type: 'number' },
    enable_session_gating: { label: 'Session Gating Enabled', description: 'Master switch. Set false to disable all limits (hackathon demo mode)', type: 'boolean' },
    concept_confidence_interview_weight: { label: 'Interview→Concept Weight', description: 'How much an interview score moves concept confidence. Default: 0.2', type: 'number' },
    concept_confidence_tutor_weight: { label: 'Tutor Understood Weight', description: 'Confidence gain per understood concept in tutor session. Default: 0.08', type: 'number' },
    concept_confidence_struggle_penalty: { label: 'Tutor Struggle Penalty', description: 'Confidence loss per struggled concept in tutor session. Default: -0.04', type: 'number' },
};

export default async function SettingsPage() {
    const supabase = await createServerSupabase();
    
    const [{ data: flags }, { data: configs }] = await Promise.all([
        supabase.from('system_flags').select('*'),
        supabase.from('system_config').select('*')
    ]);

    return (
        <div className="p-6 lg:p-10 max-w-[1400px] mx-auto">
            <SettingsClient 
                initialFlags={flags || []} 
                initialConfigs={configs || []}
                configMeta={CONFIG_KEY_DESCRIPTIONS}
                configDefaults={SYSTEM_CONFIG_DEFAULTS}
            />
        </div>
    );
}
