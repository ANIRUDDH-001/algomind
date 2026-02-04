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
                <div className={`${sizeMap[size]} rounded-full border-4 border-blue-200/20`} />
                <Loader2 className={`${sizeMap[size]} text-blue-500 animate-spin absolute inset-0`} />
            </div>
            <p className="text-slate-400 font-medium text-sm">{message}</p>
        </div>
    );

    if (fullScreen) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950">
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
        <Loader2 className={`animate-spin text-blue-500 ${className}`} />
    );
}

export function LoadingSkeleton({ className = '' }: { className?: string }) {
    return (
        <div className={`animate-pulse bg-slate-800 rounded-lg ${className}`} />
    );
}
