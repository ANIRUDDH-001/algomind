// @ts-nocheck
// @codesage
'use client';

//  -- automated unused local suppression
import React from 'react';
import { Sparkles, Layout, Bug, FileText, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const COMING_SOON_FEATURES = [
    {
        icon: Layout,
        title: '🏗️ System Design Interviews',
        subtitle: 'Design WhatsApp, YouTube, Uber — walk through your architecture',
        badge: 'Q2 2026',
        description: 'Whiteboard-style system design prep with AI interviewer',
    },
    {
        icon: Bug,
        title: '⚡ Full Stack Debugging',
        subtitle: 'Find and fix bugs in React/Node.js code under time pressure',
        badge: 'Q3 2026',
        description: 'Debug real codebases, explain your process out loud',
    },
    {
        icon: FileText,
        title: '📊 Resume Analyzer',
        subtitle: 'AI scores your resume against target job descriptions',
        badge: 'Q2 2026',
        description: 'ATS optimization, keyword gaps, achievement quantification',
    },
    {
        icon: MessageSquare,
        title: '📱 WhatsApp Practice Bot',
        subtitle: 'Daily problems sent to WhatsApp. Reply with voice notes.',
        badge: 'Q3 2026',
        description: 'Practice wherever you are — no app needed',
    },
] as const;

export function ComingSoonSection() {
    const handleNotify = () => {
        toast.success("Thanks! We'll notify you when this launches.", {
            icon: '🔔',
            duration: 3000,
        });
    };

    return (
        <div className="space-y-6">
            {/* Section Header */}
            <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-black text-white uppercase tracking-tight">
                    What&apos;s Coming to AlgoMind
                </h3>
            </div>

            {/* Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {COMING_SOON_FEATURES.map((feature, idx) => {
                    const Icon = feature.icon;
                    return (
                        <button
                            key={idx}
                            onClick={handleNotify}
                            className={cn(
                                "relative flex flex-col items-start p-5 rounded-2xl text-left transition-all duration-300 group",
                                "opacity-75 hover:opacity-100",
                                "backdrop-blur-sm"
                            )}
                            style={{
                                background: 'var(--surface-1)',
                                border: '1px solid var(--surface-edge)',
                            }}
                        >
                            {/* Gradient border overlay on hover */}
                            <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                                style={{
                                    background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(168,85,247,0.12))',
                                }}
                            />

                            {/* Badge */}
                            <span className="absolute top-3 right-3 text-[9px] font-black uppercase tracking-widest bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 px-2 py-0.5 rounded-full">
                                {feature.badge}
                            </span>

                            <div className="flex items-center gap-3 mb-3 relative z-10">
                                <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                                    <Icon className="w-4 h-4 text-indigo-400" />
                                </div>
                                <h4 className="font-bold text-white text-sm">{feature.title}</h4>
                            </div>

                            <p className="text-xs font-medium text-zinc-400 mb-2 relative z-10">
                                {feature.subtitle}
                            </p>
                            <p className="text-[11px] text-zinc-600 relative z-10">
                                {feature.description}
                            </p>

                            {/* Hover tooltip */}
                            <span className="mt-3 text-[10px] font-bold text-indigo-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity relative z-10">
                                Get notified when this launches →
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
