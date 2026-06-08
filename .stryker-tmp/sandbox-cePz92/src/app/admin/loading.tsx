/**
 * @codesage
 * @file      src/app/admin/loading.tsx
 * @purpose   Loading skeleton component for the admin pages while data is being fetched.
 * @tech      React, Next.js, Tailwind CSS
 * @connects  None
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None found
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

export default function Loading() {
    return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="space-y-4 w-full max-w-4xl px-6">
                <div className="h-8 bg-zinc-800/40 rounded-lg animate-pulse w-1/4" />
                {/* Table skeleton */}
                <div className="rounded-xl border border-zinc-800/50 overflow-hidden">
                    <div className="h-10 bg-zinc-800/40 animate-pulse" />
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-12 bg-zinc-800/20 animate-pulse border-t border-zinc-800/30" />
                    ))}
                </div>
            </div>
        </div>
    );
}
