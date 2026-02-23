'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { AlertTriangle, CheckCircle2, ServerCrash, Clock, Database, ShieldAlert, X } from 'lucide-react';
import { usePathname } from 'next/navigation';

interface HealthSummary {
    models: {
        total: number;
        active: number;
        deprecated: number;
        degraded: number;
        lastDeprecatedAt: string | null;
    };
    events: {
        errors24h: number;
        modelErrors24h: number;
        dbErrors24h: number;
        userRateLimits24h: number;
    };
    cron: {
        lastRunAt: string | null;
        lastRunStatus: 'success' | 'failed' | 'never';
        lastRunDurationMs: number | null;
    };
    system: {
        isHealthy: boolean;
        alerts: string[];
    };
}

export function AdminHealthBanner() {
    const [health, setHealth] = useState<HealthSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isDismissed, setIsDismissed] = useState(false);
    const pathname = usePathname();

    const fetchHealth = async () => {
        try {
            const res = await fetch('/api/admin/health');
            if (res.ok) {
                const data = await res.json() as HealthSummary;
                setHealth(data);

                // Check sessionStorage for previous dismissal of these specific alerts
                const alertsJson = JSON.stringify(data.system.alerts);
                const dismissedAlerts = sessionStorage.getItem('healthBannerDismissedAlerts');
                if (dismissedAlerts === alertsJson) {
                    setIsDismissed(true);
                } else if (!data.system.isHealthy) {
                    // If alerts changed or we are unhealthy and no match, show banner
                    setIsDismissed(false);
                }
            }
        } catch (error) {
            console.error('Failed to fetch admin health:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDismiss = () => {
        if (health) {
            const alertsJson = JSON.stringify(health.system.alerts);
            sessionStorage.setItem('healthBannerDismissedAlerts', alertsJson);
            setIsDismissed(true);
        }
    };

    useEffect(() => {
        fetchHealth();
        const interval = setInterval(fetchHealth, 60000); // 1 minute
        return () => clearInterval(interval);
    }, [pathname]); // Refresh on navigation

    if (isLoading || !health || isDismissed) {
        return null;
    }

    if (health.system.isHealthy) {
        // Option based on requirements:
        // "Show the health summary as a status card at the top of any admin page. If isHealthy is false: show alerts prominently."
        // We will show a subtle healthy card if healthy, and a prominent danger card if unhealthy.
        return (
            <div className="bg-emerald-900/20 border-b border-emerald-500/20 px-6 py-3 shrink-0 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-emerald-500/5 to-transparent pointer-events-none" />
                <div className="max-w-[1400px] mx-auto flex items-center justify-between text-sm">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2 text-emerald-400 font-medium">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>System Healthy</span>
                        </div>
                        <div className="hidden sm:flex items-center gap-4 text-slate-400">
                            <span className="flex items-center gap-1.5"><ServerCrash className="w-3.5 h-3.5 opacity-70" /> {health.models.active} Active Models</span>
                            <span className="flex items-center gap-1.5"><Database className="w-3.5 h-3.5 opacity-70" /> {health.events.errors24h} Errors / 24h</span>
                            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 opacity-70" /> Cron: {health.cron.lastRunStatus}</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-red-900/30 border-b border-red-500/50 px-6 py-4 shrink-0 shadow-[0_4px_20px_-4px_rgba(220,38,38,0.2)]">
            <div className="max-w-[1400px] mx-auto relative pr-8">
                <button
                    onClick={handleDismiss}
                    className="absolute top-0 right-0 text-red-400/60 hover:text-red-300 p-1 rounded-lg hover:bg-red-500/10 transition-colors"
                    aria-label="Dismiss health warnings"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="flex items-start gap-4">
                    <div className="bg-red-500/20 p-2 rounded-xl shrink-0 mt-0.5 animate-pulse">
                        <AlertTriangle className="w-6 h-6 text-red-500" />
                    </div>
                    <div>
                        <h3 className="text-red-400 font-bold text-base flex items-center gap-2">
                            System Health Alert
                        </h3>
                        <div className="mt-2 space-y-2">
                            {health.system.alerts.map((alert, i) => (
                                <div key={i} className="flex items-start gap-2 text-red-200">
                                    <span className="text-red-500 mt-1">•</span>
                                    <span className="text-sm font-medium leading-relaxed">{alert}</span>
                                </div>
                            ))}
                        </div>
                        <div className="flex flex-wrap items-center gap-4 mt-4 pt-3 border-t border-red-500/20 text-xs text-red-300/80">
                            <span className="flex items-center gap-1.5"><ServerCrash className="w-3.5 h-3.5 opacity-70" /> Models: {health.models.active} Active, {health.models.degraded} Degraded (24h)</span>
                            <span className="flex items-center gap-1.5"><Database className="w-3.5 h-3.5 opacity-70" /> {health.events.errors24h} Total Errors (24h)</span>
                            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 opacity-70" /> Cron Status: <b className="text-red-300">{health.cron.lastRunStatus.toUpperCase()}</b></span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
