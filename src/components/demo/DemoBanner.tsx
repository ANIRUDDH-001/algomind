'use client';

import { useState, useEffect } from 'react';
import { X, FlaskConical } from 'lucide-react';
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
    }, []);

    // During SSR and initial hydration, render nothing (matches server)
    if (!isDemo) return null;

    const handleDisable = () => {
        disableDemoMode();
        if (onClose) onClose();
        window.location.reload();
    };

    return (
        <div className="bg-gradient-to-r from-purple-600 via-blue-600 to-purple-600 text-white px-4 h-10 flex items-center justify-between shadow-lg relative overflow-hidden">
            {/* Animated background pulse */}
            <div className="absolute inset-0 bg-white/5 animate-pulse pointer-events-none" />

            <div className="flex items-center gap-2 sm:gap-3 relative z-10">
                <div className="p-1 bg-white/20 rounded-full animate-bounce duration-[2000ms]">
                    <FlaskConical className="w-3.5 h-3.5" />
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className="font-black text-[10px] uppercase tracking-tighter bg-white text-blue-700 px-1.5 py-0.5 rounded shrink-0">Demo Mode</span>
                    {/* Mobile: Short underline link, Desktop: Full descriptive link */}
                    <a href="/settings" className="text-[10px] sm:text-xs font-bold text-white underline decoration-white/30 hover:decoration-white hover:text-yellow-200 transition-all">
                        <span className="sm:hidden">Settings ⚙️</span>
                        <span className="hidden sm:inline">Go to Settings to turn off</span>
                    </a>
                </div>
            </div>

            <button
                onClick={handleDisable}
                className="hover:bg-white/20 p-1 rounded-full transition-all hover:rotate-90 relative z-10"
                title="Exit Demo Mode"
            >
                <X className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}
