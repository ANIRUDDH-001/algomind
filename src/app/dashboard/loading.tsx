export default function Loading() {
    return (
        <div className="min-h-screen text-zinc-100 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header skeleton */}
                <div className="space-y-3">
                    <div className="h-9 w-64 bg-zinc-800/50 rounded-xl animate-pulse" />
                    <div className="h-4 w-40 bg-zinc-800/40 rounded-lg animate-pulse" />
                </div>

                {/* Tab nav skeleton */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    <div className="h-10 bg-zinc-800/40 rounded-xl animate-pulse" />
                    <div className="h-10 bg-zinc-800/40 rounded-xl animate-pulse" />
                    <div className="h-10 bg-zinc-800/40 rounded-xl animate-pulse" />
                    <div className="h-10 bg-zinc-800/40 rounded-xl animate-pulse" />
                    <div className="h-10 bg-zinc-800/40 rounded-xl animate-pulse" />
                </div>

                {/* Overview tab primary grid */}
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                    <div className="xl:col-span-7">
                        <div className="h-72 bg-zinc-800/30 rounded-2xl animate-pulse" />
                    </div>
                    <div className="xl:col-span-5 space-y-6">
                        <div className="h-40 bg-zinc-800/30 rounded-2xl animate-pulse" />
                    </div>
                </div>

                {/* Secondary blocks below the primary grid */}
                <div className="h-80 bg-zinc-800/20 rounded-2xl animate-pulse" />
                <div className="h-56 bg-zinc-800/20 rounded-2xl animate-pulse" />
                <div className="space-y-3">
                    <div className="h-5 w-40 bg-zinc-800/30 rounded-lg animate-pulse" />
                    <div className="h-16 bg-zinc-800/20 rounded-xl animate-pulse" />
                    <div className="h-16 bg-zinc-800/20 rounded-xl animate-pulse" />
                    <div className="h-16 bg-zinc-800/20 rounded-xl animate-pulse" />
                </div>
            </div>
        </div>
    );
}
