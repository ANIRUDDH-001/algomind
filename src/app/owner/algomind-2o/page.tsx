import { KGStatsPanel } from '@/components/owner/KGStatsPanel';
import { SessionGateControlPanel } from '@/components/owner/SessionGateControlPanel';
import { RateLimitOverridePanel } from '@/components/owner/RateLimitOverridePanel';

export default function AlgoMind2OPage() {
  return (
    <div className="p-6 lg:p-10 max-w-[1400px] mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-black text-white mb-2">AlgoMind 2.0</h1>
        <p className="text-zinc-400">
          Control session gating limits and user rate limit overrides for AlgoMind 2.0 features.
        </p>
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        <KGStatsPanel />
        <SessionGateControlPanel />
        <RateLimitOverridePanel />
      </div>
    </div>
  );
}
