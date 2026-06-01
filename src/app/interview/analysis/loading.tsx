/**
 * @codesage
 * @file      src/app/interview/analysis/loading.tsx
 * @purpose   Loading UI skeleton for the interview analysis page.
 * @tech      React, Tailwind CSS
 * @connects  None
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1
 */
export default function Loading() {
    return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="space-y-8 w-full max-w-3xl px-6">
                {/* Score orb shimmer */}
                <div className="flex justify-center">
                    <div className="w-32 h-32 rounded-full bg-zinc-800/50 animate-pulse" />
                </div>
                {/* Skill cards grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="h-24 bg-zinc-800/30 rounded-xl animate-pulse" />
                    ))}
                </div>
                {/* Details section */}
                <div className="h-48 bg-zinc-800/20 rounded-2xl animate-pulse" />
            </div>
        </div>
    );
}
