'use client';

import { useState, useEffect } from 'react';
import { isProxyMode, disableProxyMode } from '@/lib/supabase/client';
import { Shield, RefreshCw, X } from 'lucide-react';

export function ConnectivityBanner() {
    const [show, setShow] = useState(() => isProxyMode());
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        const handleProxyEnabled = () => {
            setShow(true);
            setDismissed(false);
        };

        window.addEventListener('supabase-proxy-enabled', handleProxyEnabled);

        return () => {
            window.removeEventListener('supabase-proxy-enabled', handleProxyEnabled);
        };
    }, []);

    if (!show || dismissed) {
        return null;
    }

    const handleRetry = () => {
        disableProxyMode();
        window.location.reload();
    };

    return (
        <div
            className="flex items-center justify-between px-4 py-2 border-b border-indigo-500/20"
            style={{ backgroundColor: 'rgba(99,102,241,0.08)' }}
        >
            <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-medium text-indigo-400">Connectivity Mode</span>
            </div>

            <p className="text-xs text-zinc-400 flex-1 px-4 text-center hidden sm:block">
                Direct Supabase access is limited in your region. Using secure relay. Data is encrypted.
            </p>

            <div className="flex items-center gap-4">
                <button
                    onClick={handleRetry}
                    className="flex items-center gap-1.5 text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry direct
                </button>
                <div className="w-px h-4 bg-zinc-700 hidden sm:block" />
                <button
                    onClick={() => setDismissed(true)}
                    className="text-zinc-500 hover:text-zinc-300 transition-colors"
                    aria-label="Dismiss banner"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
