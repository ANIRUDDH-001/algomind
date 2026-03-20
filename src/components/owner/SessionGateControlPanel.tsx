'use client';

import { useState, useEffect } from 'react';
import { ToggleLeft, ToggleRight, Save } from 'lucide-react';

export function SessionGateControlPanel() {
  const [gatingEnabled, setGatingEnabled] = useState<boolean | null>(null);
  const [weeklyLimit, setWeeklyLimit] = useState<number>(5);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/owner/system-config')
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          setError('Failed to load config');
          setIsLoading(false);
          return;
        }
        // Create a config lookup (handle both array and object responses)
        const configMap: Record<string, string> =
          Array.isArray(data.config) ?
            Object.fromEntries(data.config.map((item: any) => [item.key, item.value]))
            : data.config || {};

        setGatingEnabled(configMap.enable_session_gating === 'true');
        setWeeklyLimit(parseInt(configMap.free_tier_weekly_session_limit) || 5);
        setIsLoading(false);
      })
      .catch(() => {
        setError('Failed to load config');
        setIsLoading(false);
      });
  }, []);

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
            { key: 'free_tier_weekly_session_limit', value: String(weeklyLimit) },
          ],
        }),
      });

      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save');
      }
    } catch (err) {
      setError('Request failed');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-[#111118] border border-[#1E1E2E] rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-sm font-bold text-white">Session Gate Control</h3>
      </div>

      {error && <div className="text-xs text-red-400 p-3 bg-red-950/20 rounded-lg mb-4">{error}</div>}

      {isLoading ? (
        <div className="space-y-3">
          <div className="h-10 bg-zinc-800/50 rounded animate-pulse" />
          <div className="h-10 bg-zinc-800/50 rounded animate-pulse" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Toggle gating */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-300">Session Gating</p>
              <p className="text-xs text-zinc-500">Disable for demo/hackathon mode</p>
            </div>
            <button
              onClick={() => setGatingEnabled((v) => !v)}
              className="flex items-center gap-2 text-sm"
              disabled={gatingEnabled === null}
            >
              {gatingEnabled
                ? (
                    <ToggleRight size={24} className="text-indigo-400" />
                  )
                : (
                    <ToggleLeft size={24} className="text-zinc-600" />
                  )}
              <span
                className={`text-xs font-medium ${
                  gatingEnabled ? 'text-indigo-400' : 'text-zinc-500'
                }`}
              >
                {gatingEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </button>
          </div>

          {/* Weekly limit */}
          <div>
            <label className="text-sm text-zinc-300">Free Tier Weekly Limit</label>
            <div className="flex items-center gap-3 mt-2">
              <input
                type="number"
                value={weeklyLimit}
                onChange={(e) => setWeeklyLimit(parseInt(e.target.value) || 5)}
                min={1}
                max={50}
                className="w-20 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white text-center focus:outline-none focus:border-indigo-500"
              />
              <span className="text-xs text-zinc-500">sessions per week</span>
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
