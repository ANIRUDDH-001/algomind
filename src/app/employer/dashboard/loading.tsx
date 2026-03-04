export default function Loading() {
    return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="space-y-4 w-full max-w-4xl px-6">
                <div className="h-8 bg-zinc-800/40 rounded-lg animate-pulse w-1/3" />
                {/* Campaign list skeleton */}
                <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-20 bg-zinc-800/30 rounded-xl animate-pulse" />
                    ))}
                </div>
            </div>
        </div>
    );
}
