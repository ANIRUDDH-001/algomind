/**
 * @codesage
 * @file      src/app/loading.tsx
 * @purpose   Global loading state fallback component
 * @tech      Next.js, Tailwind CSS
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
        <div className="flex-1 flex items-center justify-center bg-zinc-950">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-600/30 animate-pulse" />
                <div className="h-3 w-24 bg-zinc-800/50 rounded animate-pulse" />
            </div>
        </div>
    );
}
