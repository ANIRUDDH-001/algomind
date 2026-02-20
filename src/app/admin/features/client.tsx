'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getAllFeatureFlags, setFeatureFlag, type FeatureFlagKey } from '@/lib/feature-flags';
import { AlertCircle, CheckCircle2, XCircle } from 'lucide-react';

export default function FeaturesAdminPage() {
    const [flags, setFlags] = useState(getAllFeatureFlags());
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        // Refresh flags when the component mounts or when refreshKey changes
        setFlags(getAllFeatureFlags());
    }, [refreshKey]);

    const handleToggle = (key: FeatureFlagKey, value: boolean) => {
        setFeatureFlag(key, value);
        setRefreshKey(prev => prev + 1);
    };

    const resetToDefaults = () => {
        flags.forEach(flag => {
            setFeatureFlag(flag.key, flag.defaultValue);
        });
        setRefreshKey(prev => prev + 1);
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white p-6 lg:p-10">
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                            Feature Flags
                        </h1>
                        <p className="text-slate-400 mt-2 font-medium">
                            Control voice interview features in production
                        </p>
                    </div>
                    <Button
                        onClick={resetToDefaults}
                        variant="outline"
                        className="border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-800 hover:text-white"
                    >
                        Reset to Defaults
                    </Button>
                </div>

                <div className="grid gap-4">
                    {flags.map((flag) => (
                        <Card key={flag.key} className="p-6 bg-slate-900/40 border-slate-800/50 backdrop-blur-sm shadow-xl transition-all hover:border-slate-700/50">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 space-y-3">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <h3 className="text-lg font-bold text-slate-200">
                                            {flag.key.replace('ENABLE_', '').replace(/_/g, ' ')}
                                        </h3>

                                        {flag.currentValue ? (
                                            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 gap-1.5 pl-1.5 pr-2.5">
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                Enabled
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-slate-500 border-slate-700 bg-slate-800/50 gap-1.5 pl-1.5 pr-2.5">
                                                <XCircle className="w-3.5 h-3.5" />
                                                Disabled
                                            </Badge>
                                        )}

                                        {!flag.browserSupported && (
                                            <Badge variant="destructive" className="gap-1.5 bg-red-500/10 text-red-400 border-red-500/20">
                                                <AlertCircle className="w-3.5 h-3.5" />
                                                Unsupported Browser
                                            </Badge>
                                        )}
                                    </div>

                                    <p className="text-sm text-slate-400 leading-relaxed max-w-2xl">
                                        {flag.description}
                                    </p>

                                    <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 pt-1">
                                        <span>Default: {flag.defaultValue ? 'Enabled' : 'Disabled'}</span>
                                        {flag.requiresBrowserSupport && (
                                            <span className="flex items-center gap-1.5 text-amber-500/70">
                                                <AlertCircle className="w-3 h-3" />
                                                Requires Browser Support
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <Switch
                                    checked={flag.currentValue}
                                    onCheckedChange={(checked) => handleToggle(flag.key, checked)}
                                    disabled={!flag.browserSupported}
                                    className="data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-slate-700"
                                />
                            </div>
                        </Card>
                    ))}
                </div>

                <Card className="p-6 bg-blue-900/10 border-blue-500/20 shadow-lg shadow-blue-900/5">
                    <h3 className="font-bold mb-3 flex items-center gap-2 text-blue-400">
                        <AlertCircle className="w-4 h-4" />
                        Rollout Strategy
                    </h3>
                    <ul className="space-y-2 text-sm text-blue-200/70 font-medium">
                        <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500/50" />
                            Week 1: Internal testing (VAD disabled per default)
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500/50" />
                            Week 2: Enable VAD for 10% of users (A/B test)
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500/50" />
                            Week 3: Increase to 50% if metrics good
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500/50" />
                            Week 4: Full rollout or rollback based on data
                        </li>
                    </ul>
                </Card>
            </div>
        </div>
    );
}
