import { createServerSupabase } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { Zap, ShieldAlert, Trash2 } from 'lucide-react';
import { RateLimitsClient } from './RateLimitsClient';
import { Button } from '@/components/ui/button';
import { setRateLimitOverride } from '@/app/actions/owner-mutations';

export default async function RateLimitsPage() {
    const supabase = await createServerSupabase();
    
    // Fetch users with rate limit override
    const { data: overriddenUsers } = await supabase
        .from('users')
        .select('id, email, rate_limit_override, role')
        .not('rate_limit_override', 'is', null);

    return (
        <div className="p-6 lg:p-10 max-w-[1400px] mx-auto space-y-6">
            <h2 className="text-2xl font-black text-white">Rate Limits & Traffic</h2>

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
                <RateLimitsClient />
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

            <Card className="bg-[var(--surface-1)]/40 border-[var(--surface-edge)]/50 overflow-hidden">
                <div className="p-4 border-b border-white/10 bg-[var(--surface-1)]/50">
                    <h3 className="font-bold text-zinc-200">Users with Overrides</h3>
                </div>
                {overriddenUsers && overriddenUsers.length > 0 ? (
                    <div className="overflow-x-auto mobile-scroll-container">
                        <table className="min-w-full text-sm text-left">
                            <thead className="text-xs text-zinc-500 uppercase bg-black/20">
                                <tr>
                                    <th className="px-4 py-3">Email</th>
                                    <th className="px-4 py-3">Role</th>
                                    <th className="px-4 py-3">Override Limit</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {overriddenUsers.map(user => (
                                    <tr key={user.id} className="hover:bg-white/5">
                                        <td className="px-4 py-3 text-white">{user.email}</td>
                                        <td className="px-4 py-3 text-zinc-400 capitalize">{user.role}</td>
                                        <td className="px-4 py-3 font-mono text-indigo-400">{user.rate_limit_override}</td>
                                        <td className="px-4 py-3 text-right">
                                            <form action={async () => {
                                                'use server';
                                                await setRateLimitOverride(user.email, null);
                                            }}>
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-zinc-500 hover:text-red-400" type="submit">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </form>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-8 text-center text-zinc-500">
                        No overrides currently active.
                    </div>
                )}
            </Card>
        </div>
    );
}
