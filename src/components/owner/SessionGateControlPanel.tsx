/**
 * @codesage
 * @file      src/components/owner/SessionGateControlPanel.tsx
 * @purpose   Admin panel to configure session gating and usage limits.
 * @tech      React, TailwindCSS
 * @connects  lucide-react
 * @apis      GET /api/owner/system-config, POST /api/owner/system-config
 * @db        None
 * @state     Local Component State
 * @env       None
 * @issues    No issues found
 * @audit     CODESAGE-v1
 */
'use client';

import { useState, useEffect } from 'react';
import { ToggleLeft, ToggleRight, Save } from 'lucide-react';

export function SessionGateControlPanel() {
  const [gatingEnabled, setGatingEnabled] = useState<boolean | null>(null);
  const [candidateLimit, setCandidateLimit] = useState<number>(20);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchConfig() {
    setIsLoading(true);

    try {
      const r = await fetch('/api/owner/system-config');
      const data = await r.json();

      if (!r.ok) {
        setError(data?.error || 'Failed to load config');
        return;
      }

      const configMap: Record<string, string> =
        Array.isArray(data.config)
          ? Object.fromEntries(data.config.map((item: { key: string; value: string }) => [item.key, item.value]))
          : data.config || {};

      setGatingEnabled(configMap.enable_session_gating === 'true');
      setCandidateLimit(parseInt(configMap.free_tier_weekly_interview_limit, 10) || 20);
      setError(null);
    } catch {
      setError('Failed to load config');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { fetchConfig(); }, []);

  const handleSave = async () => {
    if (gatingEnabled === null) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/owner/system-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: [
            { key: 'enable_session_gating', value: String(gatingEnabled) },
            { key: 'free_tier_weekly_interview_limit', value: String(candidateLimit) },
          ],
        }),
      });

      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save');
      }
    } catch {
      setError('Request failed');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-[#111118] border border-[#1E1E2E] rounded-2xl p-5">
      <h3 className="text-sm font-bold text-white mb-4">Session Gate Control</h3>

      {error && (
        <div className="flex items-center justify-between p-3 bg-red-950/20 rounded-lg mb-4">
          <span className="text-xs text-red-400">{error}</span>
          <button
            onClick={() => { setError(null); setIsLoading(true); fetchConfig(); }}
            className="text-xs text-red-300 hover:text-red-200 underline ml-3 shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-zinc-800/50 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {/* Master gate toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-300">Session Gating</p>
              <p className="text-xs text-zinc-500">Disable for demo/hackathon mode (all limits bypassed)</p>
            </div>
            <button
              onClick={() => setGatingEnabled((v) => !v)}
              disabled={gatingEnabled === null}
              className="flex items-center gap-2"
              aria-label="Toggle session gating"
            >
              {gatingEnabled
                ? <ToggleRight size={26} className="text-indigo-400" />
                : <ToggleLeft size={26} className="text-zinc-600" />}
              <span
                className={`text-xs font-medium ${
                  gatingEnabled ? 'text-indigo-400' : 'text-zinc-500'
                }`}
              >
                {gatingEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </button>
          </div>

          {/* Per-type limits */}
          <div className={`space-y-4 transition-opacity ${gatingEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
            <p className="text-xs text-zinc-500 border-t border-zinc-800 pt-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-2">
                Candidate Weekly Session Limit
                <span className="text-zinc-600 ml-1">(interviews + learn combined)</span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={candidateLimit}
                  onChange={(e) => setCandidateLimit(Number(e.target.value))}
                  className="w-24 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
                <span className="text-xs text-zinc-500">sessions / week</span>
              </div>
              <p className="text-xs text-zinc-600 mt-1.5">
                Applies to all candidate accounts. Admin and employer accounts use a fixed 20/week. Owner accounts are always unlimited.
              </p>
            </div>
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={isSaving || gatingEnabled === null}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              saved
                ? 'bg-emerald-600/30 text-emerald-400 border border-emerald-500/25'
                : 'bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white'
            }`}
          >
            <Save size={13} />
            {isSaving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  );
}
