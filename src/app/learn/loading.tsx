export default function Loading() {
    return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="space-y-4 w-full max-w-2xl px-6">
                {/* Chat bubbles skeleton */}
                <div className="flex gap-3 items-start">
                    <div className="w-8 h-8 rounded-full bg-zinc-800/50 animate-pulse shrink-0" />
                    <div className="h-16 bg-zinc-800/30 rounded-2xl rounded-tl-sm animate-pulse flex-1" />
                </div>
                <div className="flex gap-3 items-start justify-end">
                    <div className="h-10 bg-indigo-900/20 rounded-2xl rounded-tr-sm animate-pulse w-2/3" />
                </div>
                <div className="flex gap-3 items-start">
                    <div className="w-8 h-8 rounded-full bg-zinc-800/50 animate-pulse shrink-0" />
                    <div className="h-20 bg-zinc-800/30 rounded-2xl rounded-tl-sm animate-pulse flex-1" />
                </div>
                {/* Input skeleton */}
                <div className="h-12 bg-zinc-800/20 rounded-xl animate-pulse mt-4" />
            </div>
        </div>
    );
}
