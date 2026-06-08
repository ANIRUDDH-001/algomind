// @ts-nocheck
'use client';

import { useState, useTransition } from 'react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle2, XCircle, Globe, Loader2, ShieldOff, Zap, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { updateFeatureFlag, updateSystemConfig } from '@/app/actions/owner-mutations';

interface SettingsClientProps {
    initialFlags: any[];
    initialConfigs: any[];
    configMeta: any;
    configDefaults: any;
}

const FLAG_GROUPS = [
    { title: 'Voice & Audio', icon: '🎙️', keys: ['ENABLE_WHISPER_STT', 'ENABLE_VAD_INTERRUPTIONS', 'ENABLE_CHUNKED_RESPONSES'] },
    { title: 'AWS Services — Requires Credits', icon: '☁️', keys: ['ENABLE_AWS_BEDROCK', 'ENABLE_AWS_POLLY_TTS', 'ENABLE_AWS_TRANSCRIBE_STT', 'ENABLE_AWS_S3_STORAGE'], banner: '⚠️ AWS credits required — charges apply when enabled. Bedrock models are read from DB model_routing table.' },
    { title: 'Features', icon: '✨', keys: ['ENABLE_LEARN_MODE', 'ENABLE_COMPARATIVE_ANALYSIS', 'ENABLE_DIFFICULTY_MODES', 'ENABLE_SILENT_OBSERVER'] },
    { title: 'Performance', icon: '⚡', keys: ['ENABLE_SMART_ROUTING', 'ENABLE_RESPONSE_CACHE'] },
];

const AWS_FLAG_KEYS = ['ENABLE_AWS_BEDROCK', 'ENABLE_AWS_POLLY_TTS', 'ENABLE_AWS_TRANSCRIBE_STT', 'ENABLE_AWS_S3_STORAGE'];

const TYPE_BADGE_STYLES: Record<string, string> = {
    boolean: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    number: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    string: 'bg-violet-500/10 text-violet-400 border-violet-500/30',
};

export function SettingsClient({ initialFlags, initialConfigs, configMeta, configDefaults }: SettingsClientProps) {
    const initialFlagMap = initialFlags.reduce((acc, f) => ({
        ...acc,
        [f.key]: { value: f.is_enabled, description: f.notes || '' }
    }), {});

    const initialConfigMap = initialConfigs.reduce((acc, c) => ({
        ...acc,
        [c.key]: c.value
    }), {});

    const [flags, setFlags] = useState<Record<string, { value: boolean; description: string }>>(initialFlagMap);
    const [configs, setConfigs] = useState<Record<string, string>>(initialConfigMap);
    const [togglingFlag, setTogglingFlag] = useState<string | null>(null);
    const [savingConfig, setSavingConfig] = useState<string | null>(null);
    //  -- automated unused local suppression
    const [isPending, startTransition] = useTransition();

    const handleToggle = async (key: string, value: boolean) => {
        setTogglingFlag(key);
        try {
            await updateFeatureFlag(key, value);
            setFlags(prev => ({ ...prev, [key]: { ...prev[key], value } }));
            toast.success(`Flag ${value ? 'enabled' : 'disabled'}`, { icon: value ? '✅' : '🔴' });
        } catch {
            toast.error('Failed to update flag');
        } finally {
            setTogglingFlag(null);
        }
    };

    const handleDisableAllAWS = async () => {
        setTogglingFlag('aws-all');
        try {
            for (const key of AWS_FLAG_KEYS) {
                await updateFeatureFlag(key, false);
            }
            setFlags(prev => {
                const next = { ...prev };
                for (const key of AWS_FLAG_KEYS) {
                    if (next[key]) next[key] = { ...next[key], value: false };
                }
                return next;
            });
            toast.success('All AWS services disabled', { icon: '🛑' });
        } catch {
            toast.error('Failed to disable AWS services');
        } finally {
            setTogglingFlag(null);
        }
    };

    const handleConfigSave = async (key: string) => {
        setSavingConfig(key);
        try {
            await updateSystemConfig(key, configs[key] || '');
            toast.success('Config saved');
        } catch {
            toast.error('Failed to save config');
        } finally {
            setSavingConfig(null);
        }
    };

    const allGroupedKeys = new Set(FLAG_GROUPS.flatMap(g => g.keys));
    //  -- automated unused local suppression
    const ungroupedKeys = Object.keys(flags).filter(k => !allGroupedKeys.has(k));

    return (
        <div className="space-y-12">
            <div>
                <h1 className="text-3xl font-black text-white mb-2">System Settings & Flags</h1>
                <p className="text-zinc-400">Manage global feature flags and system configuration.</p>
            </div>

            <div className="space-y-6">
                <h2 className="text-xl font-bold text-white border-b border-white/10 pb-2">Feature Flags</h2>
                <div className="rounded-xl p-4 bg-amber-500/5 border border-amber-500/20 flex items-center gap-3 text-amber-400 text-sm font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    Changes take effect instantly globally. Handle with care.
                </div>

                <div className="space-y-8">
                    {FLAG_GROUPS.map(group => {
                        const groupFlags = group.keys.filter(k => k in flags);
                        if (groupFlags.length === 0) return null;
                        const isAWSGroup = group.keys === AWS_FLAG_KEYS;
                        const anyAWSEnabled = isAWSGroup && AWS_FLAG_KEYS.some(k => flags[k]?.value);

                        return (
                            <div key={group.title} className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-sm font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                                        <span>{group.icon}</span> {group.title}
                                    </h2>
                                    {isAWSGroup && anyAWSEnabled && (
                                        <Button onClick={handleDisableAllAWS} variant="outline" disabled={togglingFlag === 'aws-all'} className="text-xs border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50 gap-1.5 h-8">
                                            <ShieldOff className="w-3.5 h-3.5" /> 💳 Disable all AWS
                                        </Button>
                                    )}
                                </div>
                                {group.banner && (
                                    <div className="rounded-xl p-3 bg-amber-500/5 border border-amber-500/15 text-amber-400/80 text-xs font-medium flex items-center gap-2">
                                        <Zap className="w-3.5 h-3.5 shrink-0" /> {group.banner}
                                    </div>
                                )}
                                <div className="grid gap-3">
                                    {groupFlags.map(key => (
                                        <div key={key} className="rounded-2xl p-5 transition-all bg-[var(--surface-1)] border border-[var(--surface-edge)] hover:border-zinc-700/50">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1 space-y-2">
                                                    <div className="flex flex-wrap items-center gap-3">
                                                        <h3 className="text-base font-bold text-zinc-200">{key.replace('ENABLE_', '').replace(/_/g, ' ')}</h3>
                                                        <Badge className={flags[key].value ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "text-zinc-500 border border-[var(--surface-edge)]"}>
                                                            {flags[key].value ? <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> : <XCircle className="w-3.5 h-3.5 mr-1" />}
                                                            {flags[key].value ? 'Enabled' : 'Disabled'}
                                                        </Badge>
                                                        <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] uppercase tracking-widest font-bold">
                                                            <Globe className="w-3 h-3 mr-1" /> Live
                                                        </Badge>
                                                    </div>
                                                    <p className="text-sm text-zinc-400 leading-relaxed max-w-2xl">{flags[key].description}</p>
                                                </div>
                                                <div className="relative">
                                                    {(togglingFlag === key || togglingFlag === 'aws-all') && <Loader2 className="w-4 h-4 animate-spin text-amber-400 absolute -left-6 top-1.5" />}
                                                    <Switch checked={flags[key].value} onCheckedChange={(checked) => handleToggle(key, checked)} disabled={togglingFlag === key || togglingFlag === 'aws-all'} className="data-[state=checked]:bg-amber-600 data-[state=unchecked]:bg-zinc-700" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="space-y-6 pt-6">
                <h2 className="text-xl font-bold text-white border-b border-white/10 pb-2">System Config</h2>
                <div className="grid gap-4">
                    {Object.entries(configMeta).map(([key, meta]: [string, any]) => (
                        <Card key={key} className="p-5 bg-[var(--surface-1)]/50 border-[var(--surface-edge)]/50">
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-2 flex-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-base font-bold text-zinc-100">{meta.label}</h3>
                                        <Badge variant="outline" className={TYPE_BADGE_STYLES[meta.type]}>{meta.type}</Badge>
                                    </div>
                                    <p className="text-xs uppercase tracking-wider text-zinc-500">{key}</p>
                                    <p className="text-sm text-zinc-400 max-w-3xl">{meta.description}</p>
                                    <p className="text-xs text-zinc-500">Default: <span className="text-zinc-300">{configDefaults[key]}</span></p>
                                </div>
                                <div className="flex items-center gap-2 w-64">
                                    {meta.type === 'boolean' ? (
                                        <Switch checked={configs[key] === 'true'} onCheckedChange={(c) => {
                                            setConfigs(prev => ({ ...prev, [key]: c ? 'true' : 'false' }));
                                        }} />
                                    ) : (
                                        <input
                                            type="text"
                                            value={configs[key] || ''}
                                            onChange={(e) => setConfigs(prev => ({ ...prev, [key]: e.target.value }))}
                                            className="w-full bg-black/50 border border-white/10 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                        />
                                    )}
                                    <Button onClick={() => handleConfigSave(key)} disabled={savingConfig === key} variant="outline" className="h-8 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10">
                                        {savingConfig === key ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
}
