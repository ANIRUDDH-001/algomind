'use client';

import { useState } from 'react';

export function UserSubscriptionPanel() {
  const [userEmail, setUserEmail] = useState('');
  const [targetStatus, setTargetStatus] = useState<'free' | 'premium' | 'college'>('premium');
  const [expiresAt, setExpiresAt] = useState('');
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleUpdate = async () => {
    if (!userEmail) return;
    setIsLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/owner/manage-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          subscription_status: targetStatus,
          expires_at: expiresAt || null,
        }),
      });
      const data = await res.json();
      setResult({ ok: res.ok, message: data.message ?? data.error });

      if (res.ok) {
        setUserEmail('');
        setExpiresAt('');
        setTargetStatus('premium');
      }
    } catch {
      setResult({ ok: false, message: 'Request failed' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#111118] border border-[#1E1E2E] rounded-2xl p-5">
      <h3 className="text-sm font-bold text-white mb-4">User Subscription</h3>

      <div className="space-y-3">
        <input
          placeholder="user@example.com"
          value={userEmail}
          onChange={(e) => setUserEmail(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
        />

        <div className="flex gap-2">
          {(['free', 'premium', 'college'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setTargetStatus(s)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                targetStatus === s
                  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {targetStatus !== 'free' && (
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
          />
        )}

        <button
          onClick={handleUpdate}
          disabled={isLoading || !userEmail}
          className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-sm font-medium transition-colors"
        >
          {isLoading ? 'Updating…' : 'Update Subscription'}
        </button>

        {result && (
          <p
            className={`text-xs px-3 py-2 rounded-lg ${
              result.ok
                ? 'bg-emerald-950/30 text-emerald-400'
                : 'bg-red-950/30 text-red-400'
            }`}
          >
            {result.message}
          </p>
        )}
      </div>
    </div>
  );
}
