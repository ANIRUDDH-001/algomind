export default function Loading() {
    return (
        <div className="fixed inset-0 top-[var(--navbar-h)] bg-slate-950 flex flex-col lg:flex-row p-4 gap-4 animate-pulse overflow-hidden">
            {/* Desktop layout */}
            <div className="hidden lg:flex w-1/4 h-full bg-slate-900/50 rounded-xl border border-slate-800/50 flex-col p-4 gap-4">
                <div className="h-6 w-3/4 bg-slate-800 rounded" />
                <div className="h-4 w-1/2 bg-slate-800 rounded" />
                <div className="flex-1 bg-slate-800/30 rounded-lg" />
            </div>
            <div className="hidden lg:flex w-1/2 h-full bg-slate-900/50 rounded-xl border border-slate-800/50 flex-col p-8 items-center justify-center gap-6">
                <div className="w-32 h-32 rounded-full bg-slate-800/50" />
                <div className="h-8 w-64 bg-slate-800 rounded" />
            </div>
            <div className="hidden lg:flex w-1/4 h-full bg-slate-900/50 rounded-xl border border-slate-800/50" />

            {/* Mobile layout */}
            <div className="lg:hidden flex-1 flex flex-col items-center justify-center gap-4">
                <div className="w-24 h-24 rounded-full bg-slate-800/50" />
                <div className="h-6 w-48 bg-slate-800 rounded" />
                <p className="text-slate-500 text-sm">Preparing Session...</p>
            </div>
        </div>
    );
}
