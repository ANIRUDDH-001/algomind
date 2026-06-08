/**
 * @codesage
 * @file      src/components/assessment/EmptyState.tsx
 * @purpose   Generic empty state component for rendering when no assessment/performance data is available.
 * @tech      React, TailwindCSS, lucide-react
 * @connects  Imports Button from @/components/ui/button
 * @apis      none
 * @db        none
 * @state     none
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */

// @ts-expect-error -- automated unused local suppression
import React from 'react';
import { LayoutDashboard, PlayCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
    title?: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
}

export function EmptyState({ title = "No Performance Data Yet", description, actionLabel, onAction }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center p-12 text-center backdrop-blur-md rounded-3xl min-h-[400px]" style={{ background: 'var(--surface-1)', border: '1px dashed var(--surface-edge)' }}>
            <div className="p-4 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-6 group-hover:scale-110 transition-transform duration-300">
                <LayoutDashboard className="w-12 h-12 text-indigo-400" />
            </div>
            <h3 className="text-xl font-bold text-zinc-200 mb-2">{title}</h3>
            <p className="text-zinc-400 max-w-sm mb-8 leading-relaxed">
                {description}
            </p>
            {onAction && (
                <Button
                    onClick={onAction}
                    className="btn-primary"
                >
                    <PlayCircle className="w-4 h-4 mr-2" />
                    {actionLabel || "Start first session"}
                </Button>
            )}
        </div>
    );
}
