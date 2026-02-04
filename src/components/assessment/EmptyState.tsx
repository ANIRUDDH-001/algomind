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
        <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-900/40 backdrop-blur-md rounded-3xl border border-dashed border-slate-700/50 min-h-[400px]">
            <div className="p-4 rounded-full bg-slate-800/50 mb-6 group-hover:scale-110 transition-transform duration-300">
                <LayoutDashboard className="w-12 h-12 text-slate-500" />
            </div>
            <h3 className="text-xl font-bold text-slate-200 mb-2">{title}</h3>
            <p className="text-slate-400 max-w-sm mb-8 leading-relaxed">
                {description}
            </p>
            {onAction && (
                <Button
                    onClick={onAction}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-8 h-12 rounded-xl shadow-lg shadow-blue-900/20"
                >
                    <PlayCircle className="w-4 h-4 mr-2" />
                    {actionLabel || "Start first session"}
                </Button>
            )}
        </div>
    );
}
