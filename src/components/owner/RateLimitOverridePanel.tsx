'use client';

import { useState } from 'react';
import { Shield, Search } from 'lucide-react';

/**
 * Allows owner to set a per-user rate limit override.
 * rate_limit_override = null → use system default
 * rate_limit_override = 0   → unlimited (owner-tier)
 * rate_limit_override = N   → N sessions/week (combined)
 */
export function RateLimitOverridePanel() {
  const [email, setEmail] = useState('');
  const [limit, setLimit] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async () => {
    if (!email.trim()) return;
    setStatus('loading');
    setMessage('');
    try {
      const limitValue = limit === '' ? null : parseInt(limit, 10);
      const res = await fetch('/api/owner/user-rate-limit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), limit: limitValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      setStatus('success');
      setMessage(`Override set for ${email.trim()}: ${limitValue === null ? 'system default' : limitValue === 0 ? 'unlimited' : `${limitValue}/week`}`);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center">
          <Shield className="w-4.5 h-4.5 text-indigo-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-zinc-200">Per-User Rate Limit Override</h3>
          <p className="text-xs text-zinc-500">Set a custom weekly session limit for any user</p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">User Email</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full pl-8 pr-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">
            Weekly Limit Override
          </label>
          <input
            type="number"
            min={0}
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            placeholder="Leave blank to reset to default"
            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
          />
          <p className="text-xs text-zinc-600 mt-1">
            0 = unlimited · blank = system default · any number = custom weekly cap
          </p>
        </div>

        <button
          onClick={handleSubmit}
          disabled={status === 'loading' || !email.trim()}
          className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium text-white transition-colors"
        >
          {status === 'loading' ? 'Saving…' : 'Apply Override'}
        </button>

        {message && (
          <p className={`text-xs ${status === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
