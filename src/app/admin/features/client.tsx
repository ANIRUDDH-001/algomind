'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, XCircle, Globe, Loader2, ShieldOff, Zap } from 'lucide-react';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ServerFlag {
    value: boolean;
    description: string;
}

// ---------------------------------------------------------------------------
// Flag Groups
// ---------------------------------------------------------------------------
const FLAG_GROUPS: { title: string; icon: string; keys: string[]; banner?: string }[] = [
    {
        title: 'Voice & Audio',
        icon: '🎙️',
        keys: [
            'ENABLE_WHISPER_STT',
            'ENABLE_GROQ_TTS',
            'ENABLE_VAD_INTERRUPTIONS',
            'ENABLE_CHUNKED_RESPONSES',
        ],
    },
    {
        title: 'AWS Services — Requires Credits',
        icon: '☁️',
        keys: [
            'ENABLE_AWS_POLLY_TTS',
            'ENABLE_AWS_TRANSCRIBE_STT',
            'ENABLE_AWS_S3_STORAGE',
        ],
        banner: '⚠️ AWS credits required — charges apply when enabled',
    },
    {
        title: 'Features',
        icon: '✨',
        keys: [
            'ENABLE_LEARN_MODE',
            'ENABLE_COMPARATIVE_ANALYSIS',
            'ENABLE_DIFFICULTY_MODES',
            'ENABLE_HINGLISH_SUPPORT',
            'ENABLE_SILENT_OBSERVER',
        ],
    },
    {
        title: 'Performance',
        icon: '⚡',
        keys: [
            'ENABLE_SMART_ROUTING',
            'ENABLE_RESPONSE_CACHE',
        ],
    },
];

const AWS_FLAG_KEYS = [
    'ENABLE_AWS_POLLY_TTS',
    'ENABLE_AWS_TRANSCRIBE_STT',
    'ENABLE_AWS_S3_STORAGE',
];

export default function FeaturesAdminPage() {
    const [flags, setFlags] = useState<Record<string, ServerFlag>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [togglingFlag, setTogglingFlag] = useState<string | null>(null);

    const fetchFlags = useCallback(async () => {
        try {
            setError(null);
            const res = await fetch('/api/flags');
            if (!res.ok) throw new Error(`Failed to fetch flags (${res.status})`);
            const data = await res.json();
            setFlags(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load flags');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchFlags();
    }, [fetchFlags]);

    const handleToggle = async (key: string, value: boolean) => {
        setTogglingFlag(key);
        try {
            const res = await fetch('/api/flags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, isEnabled: value }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || `Failed (${res.status})`);
            }
            // Optimistic local update
            setFlags(prev => ({
                ...prev,
                [key]: { ...prev[key], value },
            }));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Toggle failed');
            await fetchFlags(); // Refresh to get actual state
        } finally {
            setTogglingFlag(null);
        }
    };

    const handleDisableAllAWS = async () => {
        setTogglingFlag('aws-all');
        try {
            await Promise.all(
                AWS_FLAG_KEYS.map(key =>
                    fetch('/api/flags', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ key, isEnabled: false }),
                    })
                )
            );
            // Update local state
            setFlags(prev => {
                const next = { ...prev };
                for (const key of AWS_FLAG_KEYS) {
                    if (next[key]) next[key] = { ...next[key], value: false };
                }
                return next;
            });
            toast.success('All AWS services disabled', { icon: '🛑' });
        } catch {
            setError('Failed to disable AWS services');
            await fetchFlags();
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
                        <Badge className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 gap-1 pl-1 pr-2 text-[9px] uppercase tracking-widest font-bold">
                            <Globe className="w-3 h-3" />
                            Global
                        </Badge>
                    </div>
                    <p className="text-sm text-zinc-400 leading-relaxed max-w-2xl">
                        {flag.description}
                    </p>
                </div>
                <div className="relative">
                    {(togglingFlag === key || togglingFlag === 'aws-all') && (
                        <Loader2 className="w-4 h-4 animate-spin text-indigo-400 absolute -left-6 top-1.5" />
                    )}
                    <Switch
                        checked={flag.value}
                        onCheckedChange={(checked) => handleToggle(key, checked)}
                        disabled={togglingFlag === key || togglingFlag === 'aws-all'}
                        className="data-[state=checked]:bg-indigo-600 data-[state=unchecked]:bg-zinc-700"
                    />
                </div>
            </div>
        </div>
    );

    // Split flags into grouped and ungrouped
    const allGroupedKeys = new Set(FLAG_GROUPS.flatMap(g => g.keys));
    const ungroupedKeys = Object.keys(flags).filter(k => !allGroupedKeys.has(k));

    return (
        <div className="text-white p-6 lg:p-10">
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
                            Feature Flags
                        </h1>
                        <p className="text-zinc-400 mt-2 font-medium">
                            Server-side kill switches — changes propagate within 30 seconds
                        </p>
                    </div>
                    <Button
                        onClick={() => { setLoading(true); fetchFlags(); }}
                        variant="outline"
                        className="border-[var(--surface-edge)] text-zinc-300 hover:text-white hover:bg-zinc-800/50 transition-colors"
                        style={{ background: 'var(--surface-2)' }}
                    >
                        <Loader2 className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>

                {/* Propagation warning */}
                <div className="rounded-xl p-4 bg-amber-500/5 border border-amber-500/20 flex items-center gap-3 text-amber-400 text-sm font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    Changes take effect within 30 seconds for all users via Redis cache invalidation.
                </div>

                {loading ? (
                    <div className="rounded-2xl p-12 flex items-center justify-center gap-3 text-zinc-500" style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-edge)' }}>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Loading flags…
                    </div>
                ) : error ? (
                    <div className="rounded-2xl p-6 flex items-center gap-3 text-red-400 bg-red-500/5 border border-red-500/20">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span className="text-sm font-medium">{error}</span>
                        <Button
                            onClick={() => { setLoading(true); setError(null); fetchFlags(); }}
                            variant="outline"
                            className="ml-auto text-xs border-red-500/20 text-red-400 hover:bg-red-500/10"
                        >
                            Retry
                        </Button>
                    </div>
                ) : (
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

                        {/* Ungrouped flags */}
                        {ungroupedKeys.length > 0 && (
                            <div className="space-y-3">
                                <h2 className="text-sm font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                                    <span>🔧</span>
                                    Other
                                </h2>
                                <div className="grid gap-3">
                                    {ungroupedKeys.map(key => renderFlagCard(key, flags[key]))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
