/**
 * @codesage
 * @file      src/app/practice/loading.tsx
 * @purpose   Loading skeleton for the practice problems list.
 * @tech      React, Tailwind
 * @connects  None
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

export default function Loading() {
    return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="w-full max-w-5xl px-6">
                <div className="h-8 bg-zinc-800/40 rounded-lg animate-pulse w-1/4 mb-6" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-40 bg-zinc-800/30 rounded-xl animate-pulse" />
                    ))}
                </div>
            </div>
        </div>
    );
}
