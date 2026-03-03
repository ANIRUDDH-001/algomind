'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, User as UserIcon, Trash2, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { getSupabase } from '@/lib/supabase/client';

interface AdminUser {
    id: string;
    email: string;
    added_at: string;
}

export default function AdminsClient() {
    const [admins, setAdmins] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
    const [isOwner, setIsOwner] = useState(false);

    const [newEmail, setNewEmail] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [addError, setAddError] = useState<string | null>(null);
    const [addSuccess, setAddSuccess] = useState(false);

    const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

    const supabase = getSupabase();

    const fetchAdmins = async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch('/api/admin/admins');
            if (!res.ok) {
                throw new Error('Failed to load admins');
            }
            const data = await res.json();
            setAdmins(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const fetchUser = async () => {
            if (!supabase) return;
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.email) {
                setCurrentUserEmail(user.email);
            }
            fetch('/api/user/owner-status').then(res => res.json()).then(data => setIsOwner(!!data.isOwner)).catch(() => { });
        };
        fetchUser();
        fetchAdmins();
    }, []);

    const handleAddAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddError(null);
        setAddSuccess(false);

        if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
            setAddError('Please enter a valid email address');
            return;
        }

        try {
            setIsAdding(true);
            const res = await fetch('/api/admin/admins', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: newEmail }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to add admin');
            }

            setAddSuccess(true);
            setNewEmail('');
            fetchAdmins();

            setTimeout(() => setAddSuccess(false), 3000);
        } catch (err) {
            setAddError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsAdding(false);
        }
    };

    const handleRemoveAdmin = async (email: string) => {
        try {
            const res = await fetch('/api/admin/admins', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to remove admin');
            }

            setConfirmingDelete(null);
            fetchAdmins();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to remove admin');
            setConfirmingDelete(null);
        }
    };

    return (
        <div className="text-white p-6 lg:p-10">
            <div className="max-w-4xl mx-auto space-y-8">
                <div>
                    <h1 className="text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400 flex items-center gap-3">
                        <Shield className="w-8 h-8 text-indigo-400" />
                        Admin Users
                    </h1>
                    <p className="text-zinc-400 mt-2 font-medium">
                        Manage who has admin access to this panel
                    </p>
                </div>

                {/* Add Admin Section */}
                {isOwner && (
                    <Card className="p-6 bg-[var(--surface-1)]/40 border-[var(--surface-edge)]/50 backdrop-blur-sm shadow-xl">
                        <h3 className="font-bold mb-4 flex items-center gap-2 text-zinc-200">
                            <UserIcon className="w-5 h-5 text-indigo-400" />
                            Add New Admin
                        </h3>

                        <form onSubmit={handleAddAdmin} className="space-y-4">
                            <div className="flex flex-col sm:flex-row gap-3">
                                <input
                                    type="email"
                                    value={newEmail}
                                    onChange={(e) => setNewEmail(e.target.value)}
                                    placeholder="engineer@example.com"
                                    className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                    disabled={isAdding}
                                />
                                <Button
                                    type="submit"
                                    disabled={isAdding}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 shrink-0"
                                >
                                    {isAdding ? 'Adding...' : 'Add Admin'}
                                </Button>
                            </div>

                            {addError && (
                                <div className="flex items-center gap-2 text-red-400 text-sm font-medium">
                                    <AlertCircle className="w-4 h-4" />
                                    {addError}
                                </div>
                            )}

                            {addSuccess && (
                                <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                                    <CheckCircle2 className="w-4 h-4" />
                                    Admin added successfully
                                </div>
                            )}
                        </form>
                    </Card>
                )}

                {/* Admin List Section */}
                <div className="space-y-4">
                    <h3 className="font-bold text-zinc-200 px-1">Current Admins</h3>

                    {loading ? (
                        <div className="text-center py-10 text-zinc-500">Loading admins...</div>
                    ) : error ? (
                        <Card className="p-8 bg-[var(--surface-1)]/40 border-red-900/50 flex flex-col items-center justify-center text-center gap-4">
                            <AlertCircle className="w-8 h-8 text-red-500" />
                            <p className="text-red-400 font-medium">{error}</p>
                            <Button onClick={fetchAdmins} variant="outline" className="border-slate-700 active:scale-95 transition-all">
                                Retry
                            </Button>
                        </Card>
                    ) : admins.length === 0 ? (
                        <div className="text-center py-10 text-zinc-500">No admins found</div>
                    ) : (
                        <div className="grid gap-3">
                            {admins.map((admin) => (
                                <Card key={admin.id} className="p-4 sm:p-5 bg-[var(--surface-1)]/40 border-[var(--surface-edge)]/50 backdrop-blur-sm shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-zinc-400 shrink-0">
                                            {admin.email[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-white leading-none">{admin.email}</p>
                                                {currentUserEmail === admin.email && (
                                                    <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 px-1.5 py-0 text-[10px]">
                                                        You
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-xs text-zinc-500 font-medium mt-1.5">
                                                Added {format(new Date(admin.added_at || new Date()), 'MMM d, yyyy')}
                                            </p>
                                        </div>
                                    </div>

                                    {isOwner && (
                                        confirmingDelete === admin.email ? (
                                            <div className="flex items-center gap-2 animate-in fade-in zoom-in duration-200">
                                                <span className="text-sm text-zinc-400 mr-2">Are you sure?</span>
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    className="bg-red-500/20 text-red-500 hover:bg-red-500/30 border-red-500/20"
                                                    onClick={() => handleRemoveAdmin(admin.email)}
                                                >
                                                    Yes, remove
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="border-slate-700 bg-slate-800 text-zinc-300 hover:bg-slate-700 hover:text-white"
                                                    onClick={() => setConfirmingDelete(null)}
                                                >
                                                    Cancel
                                                </Button>
                                            </div>
                                        ) : (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors gap-2"
                                                disabled={admins.length <= 1}
                                                onClick={() => setConfirmingDelete(admin.email)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                <span className="hidden sm:inline">Remove</span>
                                            </Button>
                                        )
                                    )}
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
