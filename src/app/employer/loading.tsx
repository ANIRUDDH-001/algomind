export default function Loading() {
    return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="space-y-6 w-full max-w-4xl px-6">
                <div className="h-8 bg-zinc-800/40 rounded-lg animate-pulse w-1/3" />
                <div className="grid grid-cols-2 gap-4">
                    <div className="h-28 bg-zinc-800/30 rounded-xl animate-pulse" />
                    <div className="h-28 bg-zinc-800/30 rounded-xl animate-pulse" />
                </div>
                <div className="h-64 bg-zinc-800/20 rounded-2xl animate-pulse" />
            </div>
        </div>
    );
}
