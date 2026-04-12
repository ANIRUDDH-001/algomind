import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
    message?: string;
    size?: 'sm' | 'md' | 'lg';
    fullScreen?: boolean;
}

const sizeMap = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
};

export function LoadingState({
    message = 'Loading...',
    size = 'md',
    fullScreen = false
}: LoadingStateProps) {
    const content = (
        <div className="flex flex-col items-center justify-center gap-4">
            <div className="relative">
                <div className={`${sizeMap[size]} rounded-full border-4 border-indigo-200/20`} />
                <div className={`${sizeMap[size]} rounded-full border-2 border-indigo-600 border-t-transparent animate-spin absolute inset-0`} />
            </div>
            <p className="text-zinc-400 font-medium text-sm">{message}</p>
        </div>
    );

    if (fullScreen) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[var(--surface-base)]">
                {content}
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center p-12">
            {content}
        </div>
    );
}

export function LoadingSpinner({ className = '' }: { className?: string }) {
    return (
        <div className={`w-6 h-6 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin ${className}`} />
    );
}

export function LoadingSkeleton({ className = '' }: { className?: string }) {
    return (
        <div className={`animate-pulse bg-[var(--surface-2)] rounded-lg ${className}`} />
    );
}
