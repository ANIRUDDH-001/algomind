/**
 * @codesage
 * @file      src/components/practice/DifficultyModeSelector.tsx
 * @purpose   Selector component for choosing interview difficulty mode (Warm-up, Practice, Crunch, Sprint).
 * @tech      React, TailwindCSS
 * @connects  @/hooks/useGlobalFeatureFlag, @/lib/utils, lucide-react
 * @apis      None
 * @db        None
 * @state     Local Component State
 * @env       None
 * @issues    No issues found
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

'use client';

import React, { useState } from 'react';
import { useGlobalFeatureFlag } from '@/hooks/useGlobalFeatureFlag';
import { cn } from '@/lib/utils';
import { Flame, Zap, Clock, Trophy, ChevronDown, Building2 } from 'lucide-react';

export type DifficultyMode = 'warm-up' | 'practice' | 'crunch' | 'sprint';

interface DifficultyModeSelectorProps {
    selectedMode: DifficultyMode;
    onChange: (mode: DifficultyMode) => void;
    children?: React.ReactNode; // Slot for company filter pills
}

const MODES = [
    {
        id: 'warm-up' as DifficultyMode,
        label: 'Warm-Up',
        emoji: '🟢',
        icon: Trophy,
        time: 'Basic patterns, 20 mins',
        description: 'Encouraging interviewer, hints available',
        tooltip: 'AI gives hints faster, allows longer pauses, celebrates small wins.',
        borderColor: 'border-emerald-500',
        bgTint: 'bg-emerald-500/10',
        textColor: 'text-emerald-400',
        glowColor: 'shadow-emerald-500/20',
    },
    {
        id: 'practice' as DifficultyMode,
        label: 'Practice',
        emoji: '🟡',
        icon: Flame,
        time: 'Standard interview pace, 30 mins',
        description: 'Balanced feedback and guidance',
        tooltip: 'Standard interview experience. Default mode.',
        borderColor: 'border-amber-500',
        bgTint: 'bg-amber-500/10',
        textColor: 'text-amber-400',
        glowColor: 'shadow-amber-500/20',
    },
    {
        id: 'crunch' as DifficultyMode,
        label: 'Crunch',
        emoji: '🔴',
        icon: Clock,
        time: 'Time-pressured, 25 mins',
        description: 'Strict interviewer, minimal hints',
        tooltip: 'AI mentions the clock, gives max 1 hint, businesslike tone.',
        borderColor: 'border-red-500',
        bgTint: 'bg-red-500/10',
        textColor: 'text-red-400',
        glowColor: 'shadow-red-500/20',
    },
    {
        id: 'sprint' as DifficultyMode,
        label: 'Sprint',
        emoji: '⚡',
        icon: Zap,
        time: '2 problems, 45 mins',
        description: 'Simulate back-to-back real interviews',
        tooltip: 'Two problems in one session. AI transitions between them automatically.',
        borderColor: 'border-purple-500',
        bgTint: 'bg-purple-500/10',
        textColor: 'text-purple-400',
        glowColor: 'shadow-purple-500/20',
    },
] as const;

export function DifficultyModeSelector({ selectedMode, onChange, children }: DifficultyModeSelectorProps) {
    const isEnabled = useGlobalFeatureFlag('ENABLE_DIFFICULTY_MODES');
    const [showCompanyContext, setShowCompanyContext] = useState(false);
    const [hoveredMode, setHoveredMode] = useState<DifficultyMode | null>(null);

    if (!isEnabled) return null;

    return (
        <div className="mb-6 space-y-4" data-tour="difficulty-mode-selector">
            {/* Mode Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {MODES.map((mode) => {
                    const isSelected = selectedMode === mode.id;
                    const isHovered = hoveredMode === mode.id;
                    //  -- automated unused local suppression
                    const Icon = mode.icon;

                    return (
                        <button
                            key={mode.id}
                            data-testid={`mode-card-${mode.id}`}
                            onClick={() => onChange(mode.id)}
                            onMouseEnter={() => setHoveredMode(mode.id)}
                            onMouseLeave={() => setHoveredMode(null)}
                            className={cn(
                                "relative flex flex-col items-start p-4 rounded-2xl border-2 transition-all duration-300 text-left group",
                                isSelected
                                    ? `${mode.borderColor} ${mode.bgTint} shadow-lg ${mode.glowColor}`
                                    : "border-zinc-800 hover:border-zinc-700 bg-zinc-900/50 hover:bg-zinc-900"
                            )}
                        >
                            {/* Default badge */}
                            {mode.id === 'practice' && (
                                <span className="absolute -top-2 right-3 text-[9px] font-black uppercase tracking-widest bg-amber-500 text-black px-2 py-0.5 rounded-full">
                                    Default
                                </span>
                            )}

                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg">{mode.emoji}</span>
                                <span className={cn(
                                    "font-black text-sm uppercase tracking-wide",
                                    isSelected ? mode.textColor : "text-zinc-300"
                                )}>
                                    {mode.label}
                                </span>
                            </div>

                            <p className={cn(
                                "text-[11px] font-medium mb-1",
                                isSelected ? "text-zinc-300" : "text-zinc-500"
                            )}>
                                {mode.time}
                            </p>

                            <p className={cn(
                                "text-[10px] leading-snug",
                                isSelected ? "text-zinc-400" : "text-zinc-600"
                            )}>
                                {mode.description}
                            </p>

                            {/* Tooltip on hover */}
                            {isHovered && (
                                <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 z-50 px-3 py-2 rounded-xl text-[10px] text-zinc-300 font-medium shadow-2xl whitespace-nowrap pointer-events-none"
                                    style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-edge)' }}
                                >
                                    {mode.tooltip}
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Company Context Toggle */}
            <button
                data-testid="company-context-toggle"
                onClick={() => setShowCompanyContext(!showCompanyContext)}
                className="flex items-center gap-2 text-xs font-bold text-zinc-500 hover:text-zinc-300 transition-colors uppercase tracking-widest"
            >
                <Building2 className="w-3.5 h-3.5" />
                Show company context
                <ChevronDown className={cn(
                    "w-3 h-3 transition-transform",
                    showCompanyContext && "rotate-180"
                )} />
            </button>

            {/* Company filter pills slot */}
            {showCompanyContext && children && (
                <div data-testid="company-filters" className="animate-in fade-in slide-in-from-top-2 duration-300">
                    {children}
                </div>
            )}
        </div>
    );
}
