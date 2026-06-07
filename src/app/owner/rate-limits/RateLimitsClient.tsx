'use client';

import { useState, useTransition } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { setRateLimitOverride } from '@/app/actions/owner-mutations';

export function RateLimitsClient() {
    const [email, setEmail] = useState('');
    const [overrideLimit, setOverrideLimit] = useState('');
    const [isPending, startTransition] = useTransition();

    const handleApplyOverride = (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !email.includes('@')) return;

        startTransition(async () => {
            try {
                await setRateLimitOverride(email, overrideLimit ? parseInt(overrideLimit, 10) : null);
                toast.success(`Rate limit ${overrideLimit ? 'overridden' : 'reset to default'} for ${email}`);
                setEmail('');
                setOverrideLimit('');
            } catch (err: any) {
                toast.error(err.message || 'Update failed');
            }
        });
    };

    return (
        <form onSubmit={handleApplyOverride} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full bg-[var(--surface-2)]/50 border border-white/15 rounded-xl pl-9 pr-4 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50"
                    disabled={isPending}
                />
            </div>
            <input
                type="number"
                min="1"
                value={overrideLimit}
                onChange={(e) => setOverrideLimit(e.target.value)}
                placeholder="e.g. 50"
                className="w-full sm:w-32 bg-[var(--surface-2)]/50 border border-white/15 rounded-xl px-4 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50"
                disabled={isPending}
            />
            <Button
                type="submit"
                disabled={isPending || !email}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 shrink-0"
            >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply Override'}
            </Button>
        </form>
    );
}
