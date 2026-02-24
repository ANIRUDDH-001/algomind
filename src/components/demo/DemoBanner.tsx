'use client';

import { useState, useEffect } from 'react';
import { X, Info } from 'lucide-react';
import { isDemoMode, disableDemoMode } from '@/lib/demo/manager';

interface DemoBannerProps {
    onClose?: () => void;
}

export function DemoBanner({ onClose }: DemoBannerProps) {
    // SSR-SAFE: Start with false, update on client mount
    const [isDemo, setIsDemo] = useState(false);

    useEffect(() => {
        // Only runs on client, after hydration
        setIsDemo(isDemoMode());

        // Listen for demo mode changes from SettingsPanel
        const handleDemoModeChange = (event: CustomEvent<{ enabled: boolean }>) => {
            setIsDemo(event.detail.enabled);
        };

        window.addEventListener('demo-mode-changed', handleDemoModeChange as EventListener);

        return () => {
            window.removeEventListener('demo-mode-changed', handleDemoModeChange as EventListener);
        };
    }, []);

    // During SSR and initial hydration, render nothing (matches server)
    if (!isDemo) return null;

    const handleDisable = () => {
        disableDemoMode();
        if (onClose) onClose();
        window.location.reload();
    };

    return (
        <div
            className="w-full flex items-center justify-center px-4 py-2 relative z-50 animate-in slide-in-from-top-2 duration-500"
            style={{
                background: 'linear-gradient(90deg, rgba(245,158,11,0.1), rgba(239,68,68,0.05))',
                borderBottom: '1px solid rgba(245,158,11,0.2)'
            }}
        >
            <div className="flex items-center gap-2 max-w-7xl mx-auto w-full justify-center text-sm font-medium">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/20 text-amber-500 shrink-0">
                    <Info className="w-3.5 h-3.5" />
                </span>
                <p className="text-amber-400">
                    AlgoMind is currently in developer preview. Experience the full interview flow as a candidate.
                    <span className="hidden sm:inline"> Employer mode is available for authorized users.</span>
                </p>
                <button
                    onClick={handleDisable}
                    className="hover:bg-white/20 p-1 rounded-full transition-all hover:rotate-90 relative z-10 text-amber-400"
                    title="Exit Demo Mode"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}
