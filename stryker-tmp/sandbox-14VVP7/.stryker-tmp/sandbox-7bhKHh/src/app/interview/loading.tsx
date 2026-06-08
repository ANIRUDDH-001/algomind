/**
 * @codesage
 * @file      src/app/interview/loading.tsx
 * @purpose   Loading UI skeleton for the interview session page.
 * @tech      React, Tailwind CSS
 * @connects  None
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 

export default function Loading() {
    return (
        <div className="fixed inset-0 top-[var(--navbar-h)] bg-[var(--surface-base)] flex flex-col lg:flex-row p-4 gap-4 animate-pulse overflow-hidden">
            {/* Desktop layout */}
            <div className="hidden lg:flex w-1/4 h-full bg-[var(--surface-1)]/50 rounded-xl border border-white/10 flex-col p-4 gap-4">
                <div className="h-6 w-3/4 bg-[var(--surface-2)] rounded" />
                <div className="h-4 w-1/2 bg-[var(--surface-2)] rounded" />
                <div className="flex-1 bg-[var(--surface-2)]/30 rounded-lg" />
            </div>
            <div className="hidden lg:flex w-1/2 h-full bg-[var(--surface-1)]/50 rounded-xl border border-white/10 flex-col p-8 items-center justify-center gap-6">
                <div className="w-32 h-32 rounded-full bg-[var(--surface-2)]/50" />
                <div className="h-8 w-64 bg-[var(--surface-2)] rounded" />
            </div>
            <div className="hidden lg:flex w-1/4 h-full bg-[var(--surface-1)]/50 rounded-xl border border-white/10" />

            {/* Mobile layout */}
            <div className="lg:hidden flex-1 flex flex-col items-center justify-center gap-4">
                <div className="w-24 h-24 rounded-full bg-[var(--surface-2)]/50" />
                <div className="h-6 w-48 bg-[var(--surface-2)] rounded" />
                <p className="text-zinc-500 text-sm">Preparing Session...</p>
            </div>
        </div>
    );
}
