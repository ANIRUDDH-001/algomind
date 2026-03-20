export default function LearnLoading() {
    return (
        <div className="min-h-screen bg-[#0A0A0F] px-4 py-8">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8 space-y-2">
                    <div className="h-4 w-24 bg-zinc-800 rounded animate-pulse" />
                    <div className="h-7 w-64 bg-zinc-800 rounded animate-pulse" />
                    <div className="h-4 w-80 bg-zinc-700/50 rounded animate-pulse" />
                </div>

                <div className="h-20 bg-zinc-800/50 rounded-xl animate-pulse mb-6" />

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {Array.from({ length: 20 }).map((_, i) => (
                        <div
                            key={i}
                              className="h-18 rounded-xl bg-zinc-900/40 animate-pulse"
                            style={{ animationDelay: `${i * 25}ms` }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
