export default function Loading() {
    return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="space-y-6 w-full max-w-4xl px-6">
                {/* Stats row */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="h-24 bg-zinc-800/50 rounded-xl animate-pulse" />
                    <div className="h-24 bg-zinc-800/50 rounded-xl animate-pulse" />
                    <div className="h-24 bg-zinc-800/50 rounded-xl animate-pulse" />
                </div>
                {/* History section */}
                <div className="h-8 bg-zinc-800/40 rounded-lg animate-pulse w-1/4" />
                <div className="space-y-3">
                    <div className="h-16 bg-zinc-800/30 rounded-xl animate-pulse" />
                    <div className="h-16 bg-zinc-800/30 rounded-xl animate-pulse" />
                    <div className="h-16 bg-zinc-800/30 rounded-xl animate-pulse" />
                </div>
                {/* Insights */}
                <div className="h-48 bg-zinc-800/20 rounded-2xl animate-pulse" />
            </div>
        </div>
    );
}
