/**
 * @codesage
 * @file      src/app/learn/[slug]/loading.tsx
 * @purpose   Provides a loading skeleton for the learning session page.
 * @tech      React, Tailwind CSS
 * @connects  None
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 

export default function LearnSessionLoading() {
  return (
    <div className="h-full bg-[#0A0A0F] flex flex-col">
      <div className="px-4 py-3 border-b border-[#1E1E2E] flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-zinc-800 animate-pulse" />
        <div className="w-8 h-8 rounded-full bg-zinc-800 animate-pulse" />
        <div className="space-y-1">
          <div className="h-4 w-32 bg-zinc-800 rounded animate-pulse" />
          <div className="h-3 w-24 bg-zinc-700/50 rounded animate-pulse" />
        </div>
      </div>
      <div className="flex-1 px-4 py-6 space-y-4">
        {[0, 1].map((i) => (
          <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
            <div className={`h-14 rounded-2xl bg-zinc-800/50 animate-pulse ${i % 2 === 0 ? 'w-64' : 'w-48'}`} />
          </div>
        ))}
      </div>
    </div>
  );
}