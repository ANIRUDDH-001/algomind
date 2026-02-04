'use client';

import { X, FlaskConical } from 'lucide-react';
import { useState, useEffect } from 'react';
import { isDemoMode, disableDemoMode } from '@/lib/demo/manager';

export function DemoBanner() {
    const [show, setShow] = useState(false);

    useEffect(() => {
        setShow(isDemoMode());
    }, []);

    if (!show) return null;

    const handleDisable = () => {
        disableDemoMode();
        setShow(false);
        window.location.reload();
    };

    return (
        <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-purple-600 via-blue-600 to-purple-600 text-white px-4 py-2 flex items-center justify-between shadow-lg animate-in slide-in-from-top duration-300">
            <div className="flex items-center gap-3">
                <div className="p-1 bg-white/20 rounded-full">
                    <FlaskConical className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-2">
                    <span className="font-semibold">Demo Mode Active</span>
                    <span className="text-sm opacity-80 hidden sm:inline">• Showing sample data for presentation</span>
                </div>
            </div>
            <button
                onClick={handleDisable}
                className="hover:bg-white/20 p-1.5 rounded-full transition-colors"
                title="Exit Demo Mode"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
}
