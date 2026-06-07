'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Search, Zap, ShieldAlert, Key, Pause, Play } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { updateUserAccountType, toggleUserSuspension, updateUserTTSProvider } from '@/app/actions/owner-mutations';

export type OwnerUserRow = {
    id: string;
    email: string;
    account_type: 'owner' | 'admin' | 'employer' | 'candidate';
    created_at: string | null;
    updated_at?: string | null;
    is_suspended?: boolean | null;
    rate_limit_override?: number | null;
    tts_provider?: string | null;
};

export function UsersClient({ initialUsers, initialQuery }: { initialUsers: OwnerUserRow[], initialQuery: string }) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const [search, setSearch] = useState(initialQuery);
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    // Debounce search update to URL
    useEffect(() => {
        const timeout = setTimeout(() => {
            if (search !== initialQuery) {
                const params = new URLSearchParams(searchParams);
                if (search) {
                    params.set('q', search);
                } else {
                    params.delete('q');
                }
                startTransition(() => {
                    router.push(`${pathname}?${params.toString()}`);
                });
            }
        }, 500);
        return () => clearTimeout(timeout);
    }, [search, pathname, searchParams, router, initialQuery]);

    const handleUpdateType = async (userId: string, targetType: string, currentType: string) => {
        if (!confirm(`Are you sure you want to change this user from ${currentType} to ${targetType}?`)) return;

        setUpdatingId(userId);
        try {
            await updateUserAccountType(userId, targetType);
            toast.success(`User updated to ${targetType}`);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setUpdatingId(null);
        }
    };

    const handleSuspendToggle = async (userId: string, isSuspended: boolean) => {
        const action = isSuspended ? 'unsuspend' : 'suspend';
        if (!confirm(`Are you sure you want to ${action} this user?`)) return;

        setUpdatingId(userId);
        try {
            await toggleUserSuspension(userId, !isSuspended);
            toast.success(`User ${action}ed successfully`);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setUpdatingId(null);
        }
    };

    const handleTTSUpdate = async (userId: string, ttsProvider: string) => {
        try {
            await updateUserTTSProvider(userId, ttsProvider);
            toast.success(`TTS set to ${ttsProvider}`);
        } catch (err) {
            toast.error('Failed to update TTS setting');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between gap-4">
                <h2 className="text-xl font-bold text-white">Platform Users</h2>
                <div className="relative w-full sm:w-96">
                    <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search by email..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full bg-[var(--surface-1)] border border-[var(--surface-edge)] rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                    />
                </div>
            </div>

            {isPending ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                </div>
            ) : initialUsers.length === 0 ? (
                <Card className="p-10 text-center text-zinc-500 border-dashed border-zinc-800 bg-transparent">
                    {search ? 'No users found matching your search.' : 'No users found.'}
                </Card>
            ) : (
                <div className="bg-[var(--surface-0)] border border-[var(--surface-edge)] rounded-2xl overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-[var(--surface-1)] border-b border-[var(--surface-edge)] text-zinc-400">
                            <tr>
                                <th className="px-6 py-4 font-bold whitespace-nowrap">User</th>
                                <th className="px-6 py-4 font-bold whitespace-nowrap">Tier</th>
                                <th className="px-6 py-4 font-bold whitespace-nowrap">Joined</th>
                                <th className="px-6 py-4 font-bold whitespace-nowrap">Limits</th>
                                <th className="px-6 py-4 font-bold whitespace-nowrap">TTS</th>
                                <th className="px-6 py-4 font-bold whitespace-nowrap text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--surface-edge)]">
                            {initialUsers.map(user => (
                                <tr key={user.id} className="hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-white">{user.email}</span>
                                            {user.is_suspended && (
                                                <span className="text-xs text-red-400 font-medium flex items-center gap-1 mt-0.5">
                                                    <ShieldAlert className="w-3 h-3" /> Suspended
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <Badge variant="outline" className={`
                                            ${user.account_type === 'owner' ? 'border-amber-500/30 text-amber-400' : ''}
                                            ${user.account_type === 'admin' ? 'border-indigo-500/30 text-indigo-400' : ''}
                                            ${user.account_type === 'employer' ? 'border-emerald-500/30 text-emerald-400' : ''}
                                            ${user.account_type === 'candidate' ? 'border-zinc-500/30 text-zinc-400' : ''}
                                        `}>
                                            {user.account_type === 'owner' && <Key className="w-3 h-3 mr-1" />}
                                            {user.account_type.toUpperCase()}
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-4 text-zinc-400 whitespace-nowrap">
                                        {user.created_at ? format(new Date(user.created_at), 'MMM d, yyyy') : 'No join date'}
                                        <div className="text-xs text-zinc-600 mt-0.5">ID: {user.id.substring(0, 8)}...</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {user.rate_limit_override ? (
                                            <Badge variant="outline" className="border-indigo-500/30 text-indigo-400 gap-1.5 pl-1.5 pr-2.5">
                                                <Zap className="w-3 h-3" />
                                                {user.rate_limit_override} / day override
                                            </Badge>
                                        ) : (
                                            <span className="text-zinc-500 text-xs">Default</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <select
                                            defaultValue={user.tts_provider || 'auto'}
                                            onChange={(e) => handleTTSUpdate(user.id, e.target.value)}
                                            className="bg-[var(--surface-1)] border border-[var(--surface-edge)] rounded-lg px-2 py-1.5 text-xs text-zinc-300 w-24 focus:outline-none focus:border-indigo-500/50"
                                        >
                                            <option value="auto">Auto</option>
                                            <option value="polly">Polly</option>
                                            <option value="browser">Browser</option>
                                        </select>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {/* Account Type Demotion/Promotion */}
                                            {user.account_type !== 'owner' && (
                                                <div className="flex items-center gap-1 bg-[var(--surface-1)] rounded-lg p-1 border border-[var(--surface-edge)]">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className={`h-7 px-2 text-xs font-bold active:scale-95 transition-all ${user.account_type === 'candidate' ? 'bg-white/10 text-white' : 'text-zinc-500'}`}
                                                        onClick={() => handleUpdateType(user.id, 'candidate', user.account_type)}
                                                        disabled={updatingId === user.id}
                                                    >
                                                        C
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className={`h-7 px-2 text-xs font-bold active:scale-95 transition-all ${user.account_type === 'employer' ? 'bg-white/10 text-white' : 'text-zinc-500'}`}
                                                        onClick={() => handleUpdateType(user.id, 'employer', user.account_type)}
                                                        disabled={updatingId === user.id}
                                                    >
                                                        E
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className={`h-7 px-2 text-xs font-bold active:scale-95 transition-all ${user.account_type === 'admin' ? 'bg-white/10 text-white' : 'text-zinc-500'}`}
                                                        onClick={() => handleUpdateType(user.id, 'admin', user.account_type)}
                                                        disabled={updatingId === user.id}
                                                    >
                                                        A
                                                    </Button>
                                                </div>
                                            )}

                                            {/* Suspend Action (Cannot suspend owners) */}
                                            {user.account_type !== 'owner' && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className={`h-9 px-3 border active:scale-95 transition-all ${user.is_suspended
                                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                                                        : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
                                                        }`}
                                                    onClick={() => handleSuspendToggle(user.id, Boolean(user.is_suspended))}
                                                    disabled={updatingId === user.id}
                                                >
                                                    {user.is_suspended ? <Play className="w-4 h-4 mr-2" /> : <Pause className="w-4 h-4 mr-2" />}
                                                    {user.is_suspended ? 'Unsuspend' : 'Suspend'}
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
