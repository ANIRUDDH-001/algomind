'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldAlert, Zap, Search } from 'lucide-react';
import { toast } from 'sonner';

export function RateLimitsTab() {
    const [email, setEmail] = useState('');
    const [overrideLimit, setOverrideLimit] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);

    const handleApplyOverride = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !email.includes('@')) return;

        setIsUpdating(true);
        try {
            // First lookup the user id by email from the proxy API
            const searchRes = await fetch(`/api/owner/users?q=${encodeURIComponent(email)}`);
            const searchData = await searchRes.json();

            const user = searchData.users?.find((u: any) => u.email === email);
            if (!user) {
                toast.error('User not found');
                setIsUpdating(false);
                return;
            }

            const res = await fetch('/api/owner/users', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    rateLimitOverride: overrideLimit ? parseInt(overrideLimit, 10) : null
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Update failed');

            toast.success(`Rate limit ${overrideLimit ? 'overridden' : 'reset to default'} for ${email}`);
            setEmail('');
            setOverrideLimit('');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl">
            <h2 className="text-xl font-bold text-white">Rate Limits & Traffic</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-6 bg-[var(--surface-1)]/40 border-[var(--surface-edge)]/50">
                    <p className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-2">Owner Default</p>
                    <p className="text-3xl font-black text-amber-400 flex items-center gap-2">
                        <Zap className="w-6 h-6" /> Unlimited
                    </p>
                </Card>
                <Card className="p-6 bg-[var(--surface-1)]/40 border-[var(--surface-edge)]/50">
                    <p className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-2">Admin Default</p>
                    <p className="text-3xl font-black text-indigo-400">500 <span className="text-sm font-medium text-zinc-500">/ day</span></p>
                </Card>
                <Card className="p-6 bg-[var(--surface-1)]/40 border-[var(--surface-edge)]/50">
                    <p className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-2">Employer Default</p>
                    <p className="text-3xl font-black text-emerald-400">200 <span className="text-sm font-medium text-zinc-500">/ day</span></p>
                </Card>
            </div>

            <Card className="p-6 bg-[var(--surface-1)]/40 border-indigo-500/20 backdrop-blur-sm shadow-xl">
                <h3 className="font-bold mb-4 flex items-center gap-2 text-zinc-200">
                    <Zap className="w-5 h-5 text-indigo-400" />
                    Configure Per-User Override
                </h3>

                <p className="text-sm text-zinc-400 mb-6">
                    Apply a custom daily rate limit to any specific user. Leaving the limit blank will reset them to their account-tier default.
                </p>

                <form onSubmit={handleApplyOverride} className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="user@example.com"
                            className="w-full bg-[var(--surface-2)]/50 border border-white/15 rounded-xl pl-9 pr-4 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50"
                            disabled={isUpdating}
                        />
                    </div>
                    <input
                        type="number"
                        min="1"
                        value={overrideLimit}
                        onChange={(e) => setOverrideLimit(e.target.value)}
                        placeholder="e.g. 50"
                        className="w-full sm:w-32 bg-[var(--surface-2)]/50 border border-white/15 rounded-xl px-4 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50"
                        disabled={isUpdating}
                    />
                    <Button
                        type="submit"
                        disabled={isUpdating || !email}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 shrink-0"
                    >
                        {isUpdating ? 'Applying...' : 'Apply Override'}
                    </Button>
                </form>
            </Card>

            <div className="rounded-xl p-4 bg-zinc-800/50 border border-zinc-700 flex items-start gap-4 text-zinc-400 text-sm">
                <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                    <strong className="block text-zinc-200 mb-1">How limits are evaluated:</strong>
                    <ol className="list-decimal list-inside space-y-1 ml-1">
                        <li>If user is owner/co-owner, grant <strong className="text-amber-400">Unlimited</strong> immediately.</li>
                        <li>If `rate_limit_override` exists on profile, enforce the custom limit.</li>
                        <li>Fallback to system default per tier (Candidate=50, Employer=200, Admin=500).</li>
                    </ol>
                </div>
            </div>
        </div>
    );
}
