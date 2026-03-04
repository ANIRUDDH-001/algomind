export default function Loading() {
    return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="space-y-6 w-full max-w-xl px-6">
                <div className="h-8 bg-zinc-800/40 rounded-lg animate-pulse w-1/3" />
                {/* Form field skeletons */}
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                        <div className="h-3 bg-zinc-800/30 rounded animate-pulse w-1/4" />
                        <div className="h-10 bg-zinc-800/20 rounded-lg animate-pulse" />
                    </div>
                ))}
                <div className="h-10 bg-zinc-800/30 rounded-lg animate-pulse w-1/3 mt-4" />
            </div>
        </div>
    );
}
