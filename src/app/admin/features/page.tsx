'use client';

import React from 'react';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { FEATURE_FLAGS, type FeatureFlagName, getABGroup, getAllFlags, resetFlag } from '@/lib/feature-flags';

/* ---------- metadata for each flag (human-readable) ---------- */
const FLAG_META: Record<FeatureFlagName, { label: string; description: string; category: string }> = {
    ENABLE_VAD_INTERRUPTIONS: {
        label: 'VAD Interruptions',
        description: 'Allow the user to interrupt the AI mid-speech by starting to talk. VAD detects voice activity and pauses TTS automatically.',
        category: 'Voice',
    },
    ENABLE_SMART_ROUTING: {
        label: 'Smart STT Routing',
        description: 'Dynamically choose the best Speech-to-Text provider based on connection quality and past accuracy.',
        category: 'Voice',
    },
    ENABLE_CHUNKED_RESPONSES: {
        label: 'Chunked AI Responses',
        description: 'Stream AI response tokens directly to TTS for faster perceived response time instead of waiting for the full response.',
        category: 'AI',
    },
    ENABLE_RESPONSE_CACHE: {
        label: 'Response Cache',
        description: 'Cache AI responses for common interview questions. Pre-warms top 20 questions on app start for instant retrieval.',
        category: 'AI',
    },
};

/* ---------- reusable toggle row ---------- */
function FlagToggle({ name }: { name: FeatureFlagName }) {
    const [enabled, setEnabled] = useFeatureFlag(name);
    const meta = FLAG_META[name];

    return (
        <div className="flex items-start justify-between gap-4 p-4 rounded-xl bg-slate-900/40 border border-slate-800/50 hover:border-slate-700/70 transition-colors">
            <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{meta.label}</span>
                    <span className="text-[10px] uppercase tracking-widest font-black text-slate-500 bg-slate-800/60 px-2 py-0.5 rounded">
                        {meta.category}
                    </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{meta.description}</p>
            </div>
            <button
                role="switch"
                aria-checked={enabled}
                onClick={() => setEnabled(!enabled)}
                className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${enabled
                    ? 'bg-blue-600 border-blue-500'
                    : 'bg-slate-700 border-slate-600'
                    }`}
            >
                <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 mt-[1px] ${enabled ? 'translate-x-[22px]' : 'translate-x-[2px]'
                        }`}
                />
            </button>
        </div>
    );
}

/* ---------- page ---------- */
export default function FeaturesAdminPage() {
    const flagNames = Object.keys(FEATURE_FLAGS) as FeatureFlagName[];
    const abGroup = typeof window !== 'undefined' ? getABGroup() : 0;

    const handleResetAll = () => {
        flagNames.forEach(name => resetFlag(name));
        window.location.reload(); // simplest way to re-sync all hooks
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white p-6 lg:p-10">
            <div className="max-w-2xl mx-auto space-y-8">
                {/* Header */}
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold tracking-tight">Feature Flags</h1>
                    <p className="text-sm text-slate-400">
                        Toggle experimental features. Changes persist in this browser&apos;s localStorage.
                    </p>
                </div>

                {/* A/B Group Info */}
                <div className="p-3 rounded-lg bg-slate-900/40 border border-slate-800/50 text-xs text-slate-400 flex items-center gap-3">
                    <span className="font-mono font-bold text-slate-300">A/B Group: {abGroup}</span>
                    <span className="text-slate-600">|</span>
                    <span>{abGroup < 50 ? '🧪 Treatment (0-49)' : '🔬 Control (50-99)'}</span>
                </div>

                {/* Flags */}
                <div className="space-y-3">
                    {flagNames.map(name => (
                        <FlagToggle key={name} name={name} />
                    ))}
                </div>

                {/* Reset */}
                <div className="pt-4 border-t border-slate-800/50">
                    <button
                        onClick={handleResetAll}
                        className="text-xs text-red-400 hover:text-red-300 font-bold uppercase tracking-widest transition-colors"
                    >
                        Reset All to Defaults
                    </button>
                </div>

                {/* Current state dump */}
                <details className="text-xs text-slate-500">
                    <summary className="cursor-pointer hover:text-slate-300 font-bold uppercase tracking-widest transition-colors">
                        Debug: Raw State
                    </summary>
                    <pre className="mt-2 p-3 rounded-lg bg-slate-900/60 border border-slate-800/50 overflow-auto font-mono text-[10px]">
                        {typeof window !== 'undefined'
                            ? JSON.stringify(getAllFlags(), null, 2)
                            : '(SSR)'}
                    </pre>
                </details>
            </div>
        </div>
    );
}
