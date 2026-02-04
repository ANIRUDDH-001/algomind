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
                classNames: {
                    toast: 'bg-slate-900 border-slate-800 shadow-xl',
                    title: 'text-white font-semibold',
                    description: 'text-slate-400',
                    actionButton: 'bg-blue-600 text-white hover:bg-blue-700',
                    cancelButton: 'bg-slate-700 text-white hover:bg-slate-600',
                    closeButton: 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white',
                    success: 'bg-emerald-900/90 border-emerald-700',
                    error: 'bg-red-900/90 border-red-700',
                    warning: 'bg-yellow-900/90 border-yellow-700',
                    info: 'bg-blue-900/90 border-blue-700',
                },
            }}
        />
    );
}
