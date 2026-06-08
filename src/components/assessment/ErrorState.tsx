/**
 * @codesage
 */
// @ts-expect-error -- automated unused local suppression
import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorStateProps {
    error: string;
    onRetry?: () => void;
}

export function ErrorState({ error, onRetry }: ErrorStateProps) {
    return (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-red-950/20 backdrop-blur-md rounded-3xl border border-red-500/20 min-h-[300px]">
            <div className="p-3 rounded-full bg-red-500/10 mb-4 animate-pulse">
                <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-red-100 mb-2">Assessment Failed</h3>
            <p className="text-red-300/70 max-w-sm mb-6 text-sm">
                {error || "Something went wrong while analyzing your performance."}
            </p>
            {onRetry && (
                <Button
                    variant="outline"
                    onClick={onRetry}
                    className="border-red-500/30 hover:bg-red-500/10 text-red-400 h-10 px-6 rounded-xl transition-all"
                >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Try Again
                </Button>
            )}
        </div>
    );
}
