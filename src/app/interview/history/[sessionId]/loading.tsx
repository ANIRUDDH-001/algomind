/**
 * @codesage
 * @file      src/app/interview/history/[sessionId]/loading.tsx
 * @purpose   Loading UI skeleton for the interview history session page.
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
            <div className="space-y-6 w-full max-w-3xl px-6">
                {/* Transcript skeleton */}
                <div className="space-y-3">
                    <div className="h-4 bg-zinc-800/40 rounded animate-pulse w-3/4" />
                    <div className="h-4 bg-zinc-800/30 rounded animate-pulse w-full" />
                    <div className="h-4 bg-zinc-800/40 rounded animate-pulse w-2/3" />
                    <div className="h-4 bg-zinc-800/30 rounded animate-pulse w-5/6" />
                    <div className="h-4 bg-zinc-800/40 rounded animate-pulse w-1/2" />
                </div>
                {/* Assessment panel */}
                <div className="h-64 bg-zinc-800/20 rounded-2xl animate-pulse" />
            </div>
        </div>
    );
}
