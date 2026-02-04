import React, { useEffect } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ErrorBannerProps {
    message: string;
    className?: string;
    onClose: () => void;
    autoCloseMs?: number;
}

export function ErrorBanner({ message, className, onClose, autoCloseMs = 5000 }: ErrorBannerProps) {
    useEffect(() => {
        if (autoCloseMs > 0) {
            const timer = setTimeout(onClose, autoCloseMs);
            return () => clearTimeout(timer);
        }
    }, [autoCloseMs, onClose]);

    return (
        <div className={cn(
            "fixed top-6 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md animate-in fade-in slide-in-from-top-4 duration-300",
            className
        )}>
            <div className="mx-4 bg-red-500/10 backdrop-blur-md border border-red-500/20 rounded-xl p-4 flex items-start gap-3 shadow-2xl shadow-red-950/20">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                    <p className="text-sm font-medium text-red-100">{message}</p>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 hover:bg-red-500/20 rounded-lg transition-colors text-red-400"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
