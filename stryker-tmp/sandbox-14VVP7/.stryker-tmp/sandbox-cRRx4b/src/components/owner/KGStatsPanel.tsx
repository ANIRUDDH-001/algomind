/**
 * @codesage
 * @file      src/components/owner/KGStatsPanel.tsx
 * @purpose   Admin panel displaying Knowledge Graph statistics.
 * @tech      React, TailwindCSS
 * @connects  lucide-react
 * @apis      GET /api/owner/kg-stats
 * @db        None
 * @state     Local Component State
 * @env       None
 * @issues    No issues found
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 

'use client';

import { useEffect, useState } from 'react';
import { Brain, TrendingDown } from 'lucide-react';

interface KGStats {
  usersWithDiagnostic: number;
  learnSessionsThisWeek: number;
  totalConceptStateRows: number;
  hardestConcepts: { slug: string; avg: number }[];
}

export function KGStatsPanel() {
  const [stats, setStats] = useState<KGStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/owner/kg-stats')
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          setError(data.error || 'Failed to load stats');
          setIsLoading(false);
          return;
        }
        setStats(data);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setIsLoading(false);
      });
  }, []);

  return (
    <div className="bg-[#111118] border border-[#1E1E2E] rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Brain size={16} className="text-indigo-400" />
        <h3 className="text-sm font-bold text-white">Knowledge Graph</h3>
      </div>

      {error ? (
        <div className="text-xs text-red-400 p-3 bg-red-950/20 rounded-lg">{error}</div>
      ) : isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 bg-zinc-800/50 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: 'Users diagnosed',
                value: stats?.usersWithDiagnostic ?? '—',
                icon: '👤',
              },
              {
                label: 'Learn sessions / week',
                value: stats?.learnSessionsThisWeek ?? '—',
                icon: '📖',
              },
              {
                label: 'Concept state rows',
                value: stats?.totalConceptStateRows ?? '—',
                icon: '🧠',
              },
            ].map(({ label, value, icon }) => (
              <div key={label} className="bg-zinc-900/40 rounded-xl p-3 text-center">
                <div className="text-lg">{icon}</div>
                <div className="text-xl font-black text-white tabular-nums">{value}</div>
                <div className="text-xs text-zinc-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          {/* Hardest concepts */}
          {(stats?.hardestConcepts?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs text-zinc-500 mb-2 flex items-center gap-1">
                <TrendingDown size={11} />
                Platform-wide weakest concepts
              </p>
              <div className="space-y-1.5">
                {stats!.hardestConcepts.map((c, i) => (
                  <div key={c.slug} className="flex items-center gap-2">
                    <span className="text-xs text-zinc-600 w-4 text-right">{i + 1}.</span>
                    <span className="text-xs text-zinc-300 flex-1">
                      {c.slug.replace(/-/g, ' ')}
                    </span>
                    <span className="text-xs text-red-400 tabular-nums">
                      avg {Math.round(c.avg * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
