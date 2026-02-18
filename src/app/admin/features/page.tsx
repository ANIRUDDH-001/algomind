'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getAllFeatureFlags, setFeatureFlag, resetFlag, getABGroup, type FeatureFlagKey, FEATURE_FLAGS } from '@/lib/feature-flags';
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
        <div className="container mx-auto py-8 max-w-4xl">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold">Feature Flags</h1>
                    <p className="text-muted-foreground mt-2">
                        Control voice interview features in production
                    </p>
                </div>
                <Button onClick={resetToDefaults} variant="outline">
                    Reset to Defaults
                </Button>
            </div>

            <div className="space-y-4">
                {flags.map((flag) => (
                    <Card key={flag.key} className="p-6">
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                    <h3 className="text-lg font-semibold">
                                        {flag.key.replace('ENABLE_', '').replace(/_/g, ' ')}
                                    </h3>

                                    {flag.currentValue ? (
                                        <Badge variant="default" className="gap-1 bg-green-600 hover:bg-green-700">
                                            <CheckCircle2 className="w-3 h-3" />
                                            Enabled
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="gap-1">
                                            <XCircle className="w-3 h-3" />
                                            Disabled
                                        </Badge>
                                    )}

                                    {!flag.browserSupported && (
                                        <Badge variant="destructive" className="gap-1">
                                            <AlertCircle className="w-3 h-3" />
                                            Unsupported Browser
                                        </Badge>
                                    )}
                                </div>

                                <p className="text-sm text-muted-foreground mb-3">
                                    {flag.description}
                                </p>

                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                    <span>Default: {flag.defaultValue ? 'Enabled' : 'Disabled'}</span>
                                    {flag.requiresBrowserSupport && (
                                        <span className="flex items-center gap-1">
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
                            />
                        </div>
                    </Card>
                ))}
            </div>

            <Card className="p-6 mt-8 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Rollout Strategy
                </h3>
                <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Week 1: Internal testing (VAD disabled per default)</li>
                    <li>• Week 2: Enable VAD for 10% of users (A/B test)</li>
                    <li>• Week 3: Increase to 50% if metrics good</li>
                    <li>• Week 4: Full rollout or rollback based on data</li>
                </ul>
            </Card>
        </div>
    );
}
