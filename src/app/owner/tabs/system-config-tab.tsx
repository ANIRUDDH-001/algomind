'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SYSTEM_CONFIG_DEFAULTS } from '@/lib/config/system-config-keys';

type ConfigMeta = {
    label: string;
    description: string;
    type: 'boolean' | 'number' | 'string';
};

const CONFIG_KEY_DESCRIPTIONS: Record<string, ConfigMeta> = {
    cross_tier_fallback_enabled: {
        label: 'Cross-Tier Fallback Enabled',
        description: 'If true, chat and analysis model routes can fallback across tiers when a route is unavailable.',
        type: 'boolean',
    },
    primary_owner_email: {
        label: 'Primary Owner Email',
        description: 'Primary owner identity used for owner-level security and operational workflows.',
        type: 'string',
    },
    free_tier_weekly_session_limit: {
        label: 'Free Tier Weekly Session Limit',
        description: 'Total sessions (interview + learn) per week for free users. Default: 5',
        type: 'number',
    },
    enable_session_gating: {
        label: 'Session Gating Enabled',
        description: 'Master switch. Set false to disable all limits (hackathon demo mode)',
        type: 'boolean',
    },
    concept_confidence_interview_weight: {
        label: 'Interview→Concept Weight',
        description: 'How much an interview score moves concept confidence. Default: 0.2',
        type: 'number',
    },
    concept_confidence_tutor_weight: {
        label: 'Tutor Understood Weight',
        description: 'Confidence gain per understood concept in tutor session. Default: 0.08',
        type: 'number',
    },
    concept_confidence_struggle_penalty: {
        label: 'Tutor Struggle Penalty',
        description: 'Confidence loss per struggled concept in tutor session. Default: -0.04',
        type: 'number',
    },
};

const TYPE_BADGE_STYLES: Record<ConfigMeta['type'], string> = {
    boolean: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    number: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    string: 'bg-violet-500/10 text-violet-400 border-violet-500/30',
};

export function SystemConfigTab() {
    const entries = Object.entries(CONFIG_KEY_DESCRIPTIONS);

    return (
        <div className="space-y-6">
            <Card className="p-5 bg-amber-500/5 border border-amber-500/20 text-amber-300 text-sm">
                System config keys are centralized and typed. Keep all new keys in
                <span className="font-semibold"> src/lib/config/system-config-keys.ts</span>.
            </Card>

            <div className="grid gap-4">
                {entries.map(([key, meta]) => (
                    <Card key={key} className="p-5 bg-[var(--surface-1)]/50 border-[var(--surface-edge)]/50">
                        <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1">
                                <h3 className="text-base font-bold text-zinc-100">{meta.label}</h3>
                                <p className="text-xs uppercase tracking-wider text-zinc-500">{key}</p>
                                <p className="text-sm text-zinc-400 max-w-3xl">{meta.description}</p>
                                <p className="text-xs text-zinc-500">
                                    Default value: <span className="text-zinc-300">{SYSTEM_CONFIG_DEFAULTS[key as keyof typeof SYSTEM_CONFIG_DEFAULTS]}</span>
                                </p>
                            </div>
                            <Badge variant="outline" className={TYPE_BADGE_STYLES[meta.type]}>
                                {meta.type}
                            </Badge>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
}
