'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Search, Zap, ShieldAlert, Key, Pause, Play } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export function UsersTab({ isPrimaryOwner }: { isPrimaryOwner: boolean }) {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    const fetchUsers = async (query = '') => {
        setLoading(true);
        try {
            const url = new URL('/api/owner/users', window.location.origin);
            if (query) url.searchParams.set('q', query);
            const res = await fetch(url.toString());
            if (!res.ok) throw new Error('Failed to fetch users');
            const data = await res.json();
            setUsers(data.users || []);
        } catch {
            toast.error('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Debounce search
        const timeout = setTimeout(() => {
            fetchUsers(search);
        }, 500);
        return () => clearTimeout(timeout);
    }, [search]);

    const handleUpdateType = async (userId: string, targetType: string, currentType: string) => {
        if (!confirm(`Are you sure you want to change this user from ${currentType} to ${targetType}?`)) return;

        setUpdatingId(userId);
        try {
            const res = await fetch('/api/owner/users', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, accountType: targetType }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Update failed');

            toast.success(`User updated to ${targetType}`);
            fetchUsers(search); // Refresh
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
            const res = await fetch('/api/owner/users', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, suspend: !isSuspended }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Update failed');

            toast.success(`User ${action}ed successfully`);
            fetchUsers(search); // Refresh
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setUpdatingId(null);
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

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                </div>
            ) : users.length === 0 ? (
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
                                <th className="px-6 py-4 font-bold whitespace-nowrap text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--surface-edge)]">
                            {users.map(user => (
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
                                        {format(new Date(user.updated_at || user.id ? Date.now() : Date.now()), 'MMM d, yyyy')}
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
                                                    onClick={() => handleSuspendToggle(user.id, user.is_suspended)}
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
