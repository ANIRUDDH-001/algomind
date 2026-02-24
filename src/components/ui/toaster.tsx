'use client';

import { Toaster as SonnerToaster } from 'sonner';

export function Toaster() {
    return (
        <SonnerToaster
            position="top-right"
            expand={false}
            richColors
            closeButton
            toastOptions={{
                duration: 4000,
                style: {
                    background: 'var(--surface-2)',
                    border: '1px solid var(--surface-edge)',
                    color: '#e4e4e7',
                    borderRadius: '14px',
                },
                classNames: {
                    toast: 'shadow-xl',
                    title: 'text-white font-semibold',
                    description: 'text-zinc-400',
                    actionButton: 'bg-indigo-600 text-white hover:bg-indigo-700',
                    cancelButton: 'bg-zinc-700 text-white hover:bg-zinc-600',
                    closeButton: 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white',
                    success: '!border-emerald-500/30',
                    error: '!border-red-500/30',
                    warning: '!border-amber-500/30',
                    info: '!border-indigo-500/30',
                },
            }}
        />
    );
}
