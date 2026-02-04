'use client';

import { X, FlaskConical } from 'lucide-react';
import { isDemoMode, disableDemoMode } from '@/lib/demo/manager';

interface DemoBannerProps {
    onClose?: () => void;
}

export function DemoBanner({ onClose }: DemoBannerProps) {
    if (typeof window === 'undefined') return null;
    if (!isDemoMode()) return null;

    const handleDisable = () => {
        disableDemoMode();
        if (onClose) onClose();
        window.location.reload();
    };

    return (
        <div className="bg-gradient-to-r from-purple-600 via-blue-600 to-purple-600 text-white px-4 h-10 flex items-center justify-between shadow-lg relative overflow-hidden">
            {/* Animated background pulse */}
            <div className="absolute inset-0 bg-white/5 animate-pulse pointer-events-none" />

            <div className="flex items-center gap-3 relative z-10">
                <div className="p-1 bg-white/20 rounded-full animate-bounce duration-[2000ms]">
                    <FlaskConical className="w-3.5 h-3.5" />
                </div>
                <div className="flex items-center gap-2">
                    <span className="font-black text-[10px] uppercase tracking-tighter bg-white text-blue-700 px-1.5 py-0.5 rounded">Demo Mode</span>
                    <span className="text-xs font-bold sm:inline hidden">Presenting Simulated Data & Analytics</span>
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
