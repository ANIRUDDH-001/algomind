/**
 * @codesage
 * @file      src/components/ui/ErrorBanner.tsx
 * @purpose   Displays an auto-dismissible floating error banner for global application notifications.
 * @tech      React, Lucide React, Tailwind CSS
 * @connects  Imports utility 'cn' from @/lib/utils. Used primarily by layout or global notification providers.
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1
 */
import React, { useEffect } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ErrorBannerProps extends React.HTMLAttributes<HTMLDivElement> {
    message: string;
    onClose: () => void;
    autoCloseMs?: number;
}

export function ErrorBanner({ message, className, onClose, autoCloseMs = 5000, ...props }: ErrorBannerProps) {
    useEffect(() => {
        if (autoCloseMs > 0) {
            const timer = setTimeout(onClose, autoCloseMs);
            return () => clearTimeout(timer);
        }
    }, [autoCloseMs, onClose, message]);

    return (
        <div className={cn(
            // Solid floating banner - NO transparency, always on top
            "fixed top-20 left-1/2 -translate-x-1/2 z-9999 w-[calc(100%-2rem)] max-w-lg animate-in fade-in slide-in-from-top-4 duration-300",
            className
        )}
            role="alert"
            aria-live="assertive"
            {...props}
        >
            {/* Solid red background - fully opaque */}
            <div className="bg-red-600 border-2 border-red-400 rounded-xl p-4 flex items-start gap-3 shadow-2xl shadow-red-950/50">
                <AlertCircle className="w-6 h-6 text-white shrink-0 mt-0.5" />
                <div className="flex-1">
                    <p className="text-sm font-bold text-white">{message}</p>
                </div>
                <button
                    onClick={onClose}
                    aria-label="Dismiss error"
                    className="p-1.5 bg-red-700 hover:bg-red-800 rounded-lg transition-colors text-white"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
