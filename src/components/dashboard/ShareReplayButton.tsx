'use client';

import React, { useState } from 'react';
import { Share2, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils'; // Keep assuming cn is correct based on project structure

interface ShareReplayButtonProps {
    sessionId: string;
    className?: string;
}

export function ShareReplayButton({ sessionId, className }: ShareReplayButtonProps) {
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

    const handleShare = async (e: React.MouseEvent) => {
        e.stopPropagation(); // prevent clicking through to the session card link

        if (status === 'loading') return;
        setStatus('loading');

        try {
            const res = await fetch('/api/replay/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId })
            });

            if (!res.ok) throw new Error('Failed to generate replay');

            const data = await res.json();
            if (!data.replayUrl) throw new Error('No url returned');

            // Copy to clipboard
            const fullUrl = `${window.location.origin}${data.replayUrl}`;
            await navigator.clipboard.writeText(fullUrl);

            setStatus('success');
            setTimeout(() => setStatus('idle'), 2500);

        } catch (error) {
            console.error('Share replay failed:', error);
            setStatus('error');
            setTimeout(() => setStatus('idle'), 3000);
        }
    };

    return (
        <button
            onClick={handleShare}
            disabled={status === 'loading'}
            className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                status === 'idle' ? "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-blue-400" :
                    status === 'loading' ? "bg-slate-800 border-slate-700 text-slate-400 cursor-not-allowed" :
                        status === 'success' ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" :
                            "bg-red-500/20 border-red-500/30 text-red-400",
                className
            )}
            title="Share interactive replay"
        >
            {status === 'idle' && <><Share2 className="w-3.5 h-3.5" /> Share</>}
            {status === 'loading' && <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating...</>}
            {status === 'success' && <><Check className="w-3.5 h-3.5" /> Link Copied!</>}
            {status === 'error' && 'Failed'}
        </button>
    );
}
