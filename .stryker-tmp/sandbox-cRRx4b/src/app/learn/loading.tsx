/**
 * @codesage
 * @file      src/app/learn/loading.tsx
 * @purpose   Renders a loading skeleton UI while the learn mode concepts are being fetched.
 * @tech      Next.js, React, Tailwind CSS
 * @connects  None
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

export default function LearnLoading() {
    return (
        <div className="flex-1 bg-[#0A0A0F] px-4 py-8">
            <div className="max-w-5xl mx-auto">
                <div className="mb-8 space-y-2">
                    <div className="h-8 w-52 bg-zinc-800 rounded animate-pulse" />
                    <div className="h-4 w-96 bg-zinc-700/50 rounded animate-pulse" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div
                            key={i}
                            className="h-24 rounded-xl bg-zinc-900/40 animate-pulse"
                            style={{ animationDelay: `${i * 25}ms` }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
