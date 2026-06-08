/**
 * @codesage
 * @file      src/app/owner/tabs/flags-tab.tsx
 * @purpose   Provides a UI to view and toggle global feature flags.
 * @tech      React, Lucide React, Tailwind
 * @connects  /api/owner/flags
 * @apis      PATCH /api/owner/flags
 * @db        None
 * @state     React local state
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 

'use client';

import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Globe, Loader2, ShieldOff, Zap, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ServerFlag {
    value: boolean;
    description: string;
}

const FLAG_GROUPS = [
    {
        title: 'Voice & Audio',
        icon: '🎙️',
        keys: ['ENABLE_WHISPER_STT', 'ENABLE_VAD_INTERRUPTIONS', 'ENABLE_CHUNKED_RESPONSES'],
    },
    {
        title: 'AWS Services — Requires Credits',
        icon: '☁️',
        keys: ['ENABLE_AWS_BEDROCK', 'ENABLE_AWS_POLLY_TTS', 'ENABLE_AWS_TRANSCRIBE_STT', 'ENABLE_AWS_S3_STORAGE'],
        banner: '⚠️ AWS credits required — charges apply when enabled. Bedrock models are read from DB model_routing table.',
    },
    {
        title: 'Features',
        icon: '✨',
        keys: ['ENABLE_LEARN_MODE', 'ENABLE_COMPARATIVE_ANALYSIS', 'ENABLE_DIFFICULTY_MODES', 'ENABLE_SILENT_OBSERVER'],
    },
    {
        title: 'Performance',
        icon: '⚡',
        keys: ['ENABLE_SMART_ROUTING', 'ENABLE_RESPONSE_CACHE'],
    },
];

const AWS_FLAG_KEYS = ['ENABLE_AWS_BEDROCK', 'ENABLE_AWS_POLLY_TTS', 'ENABLE_AWS_TRANSCRIBE_STT', 'ENABLE_AWS_S3_STORAGE'];

export function FlagsTab({ initialFlags }: { initialFlags: any[] }) {
    // Convert array of flags from DB to map
    const initialFlagMap = initialFlags.reduce((acc, f) => ({
        ...acc,
        [f.key]: { value: f.is_enabled, description: f.notes || '' }
    }), {});

    const [flags, setFlags] = useState<Record<string, ServerFlag>>(initialFlagMap);
    const [togglingFlag, setTogglingFlag] = useState<string | null>(null);

    const handleToggle = async (key: string, value: boolean) => {
        setTogglingFlag(key);
        try {
            // Uses the new owner flags API
            const res = await fetch('/api/owner/flags', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, isEnabled: value }),
            });
            if (!res.ok) throw new Error('Toggle failed');

            setFlags(prev => ({
                ...prev,
                [key]: { ...prev[key], value },
            }));
            toast.success(`Flag ${value ? 'enabled' : 'disabled'}`, { icon: value ? '✅' : '🔴' });
        } catch {
            toast.error('Failed to update flag');
            // Optimistic revert handled by not updating state
        } finally {
            setTogglingFlag(null);
        }
    };

    const handleDisableAllAWS = async () => {
        setTogglingFlag('aws-all');
        try {
            await Promise.all(
                AWS_FLAG_KEYS.map(key =>
                    fetch('/api/owner/flags', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ key, isEnabled: false }),
                    })
                )
            );
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

    const renderFlagCard = (key: string, flag: ServerFlag) => (
        <div key={key} className="rounded-2xl p-5 transition-all hover:border-zinc-700/50" style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-edge)' }}>
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-base font-bold text-zinc-200">
                            {key.replace('ENABLE_', '').replace(/_/g, ' ')}
                        </h3>
                        {flag.value ? (
                            <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 gap-1.5 pl-1.5 pr-2.5">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Enabled
                            </Badge>
                        ) : (
                            <Badge variant="outline" className="text-zinc-500 border border-[var(--surface-edge)] gap-1.5 pl-1.5 pr-2.5" style={{ background: 'var(--surface-2)' }}>
                                <XCircle className="w-3.5 h-3.5" />
                                Disabled
                            </Badge>
                        )}
                        <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 gap-1 pl-1 pr-2 text-[9px] uppercase tracking-widest font-bold">
                            <Globe className="w-3 h-3" />
                            Live
                        </Badge>
                    </div>
                    <p className="text-sm text-zinc-400 leading-relaxed max-w-2xl">
                        {flag.description}
                    </p>
                </div>
                <div className="relative">
                    {(togglingFlag === key || togglingFlag === 'aws-all') && (
                        <Loader2 className="w-4 h-4 animate-spin text-amber-400 absolute -left-6 top-1.5" />
                    )}
                    <Switch
                        checked={flag.value}
                        onCheckedChange={(checked) => handleToggle(key, checked)}
                        disabled={togglingFlag === key || togglingFlag === 'aws-all'}
                        className="data-[state=checked]:bg-amber-600 data-[state=unchecked]:bg-zinc-700"
                    />
                </div>
            </div>
        </div>
    );

    const allGroupedKeys = new Set(FLAG_GROUPS.flatMap(g => g.keys));
    const ungroupedKeys = Object.keys(flags).filter(k => !allGroupedKeys.has(k));

    return (
        <div className="space-y-8">
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
                                    <span>{group.icon}</span>
                                    {group.title}
                                </h2>
                                {isAWSGroup && anyAWSEnabled && (
                                    <Button
                                        onClick={handleDisableAllAWS}
                                        variant="outline"
                                        disabled={togglingFlag === 'aws-all'}
                                        className="text-xs border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50 gap-1.5"
                                    >
                                        <ShieldOff className="w-3.5 h-3.5" />
                                        💳 Disable all AWS
                                    </Button>
                                )}
                            </div>
                            {group.banner && (
                                <div className="rounded-xl p-3 bg-amber-500/5 border border-amber-500/15 text-amber-400/80 text-xs font-medium flex items-center gap-2">
                                    <Zap className="w-3.5 h-3.5 shrink-0" />
                                    {group.banner}
                                </div>
                            )}
                            <div className="grid gap-3">
                                {groupFlags.map(key => renderFlagCard(key, flags[key]))}
                            </div>
                        </div>
                    );
                })}

                {ungroupedKeys.length > 0 && (
                    <div className="space-y-3">
                        <h2 className="text-sm font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                            <span>🔧</span> Other
                        </h2>
                        <div className="grid gap-3">
                            {ungroupedKeys.map(key => renderFlagCard(key, flags[key]))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
