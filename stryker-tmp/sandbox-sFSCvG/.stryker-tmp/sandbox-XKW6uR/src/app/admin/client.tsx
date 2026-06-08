/**
 * @codesage
 * @file      src/app/admin/client.tsx
 * @purpose   Client component for managing admin users (adding, listing, and removing admins).
 * @tech      React, Next.js, Lucide Icons, date-fns
 * @connects  @/lib/supabase/client, @/lib/api/adapters/admin-adapter
 * @apis      None
 * @db        None directly (uses AdminAdapter)
 * @state     admins, loading, error, currentUserEmail, isOwner, newEmail, isAdding, confirmingDelete
 * @env       None
 * @issues    None found
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 

'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, User as UserIcon, Trash2, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { getSupabase } from '@/lib/supabase/client';
import { ApiClientError } from '@/lib/api/client';
import { AdminAdapter, type AdminUserDto } from '@/lib/api/adapters/admin-adapter';
import { SwipeableCard } from '@/components/ui/swipeable-card';

type AdminUser = AdminUserDto;

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
    const [openCardId, setOpenCardId] = useState<string | null>(null);

    const supabase = getSupabase();

    const fetchAdmins = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await AdminAdapter.getAdmins();
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
            AdminAdapter.getOwnerStatus().then(data => setIsOwner(!!data.isOwner)).catch(() => { });
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
            await AdminAdapter.addAdmin(newEmail);

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
            await AdminAdapter.removeAdmin(email);

            setConfirmingDelete(null);
            fetchAdmins();
        } catch (err) {
            if (err instanceof ApiClientError) {
                alert(err.message);
            } else {
                alert('Failed to remove admin');
            }
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
                                    className="flex-1 bg-[var(--surface-2)]/50 border border-white/15 rounded-xl px-4 py-2 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
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
                            <Button onClick={fetchAdmins} variant="outline" className="border-white/10 active:scale-95 transition-all">
                                Retry
                            </Button>
                        </Card>
                    ) : admins.length === 0 ? (
                        <div className="text-center py-10 text-zinc-500">No admins found</div>
                    ) : (
                        <>
                            <div className="hidden md:grid gap-3">
                                {admins.map((admin) => (
                                    <Card key={admin.id} className="p-4 sm:p-5 bg-[var(--surface-1)]/40 border-[var(--surface-edge)]/50 backdrop-blur-sm shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-zinc-400 shrink-0">
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
                                                        className="border-white/10 bg-[var(--surface-2)] text-zinc-300 hover:bg-[var(--surface-3)] hover:text-white"
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
                            <div className="md:hidden grid gap-4">
                                {admins.map((admin) => (
                                    <SwipeableCard
                                        key={admin.id}
                                        isOpen={openCardId === admin.id}
                                        onOpenChange={(isOpen) => {
                                            setOpenCardId(isOpen ? admin.id : null);
                                            if (!isOpen && confirmingDelete === admin.email) {
                                                setConfirmingDelete(null);
                                            }
                                        }}
                                        actionWidth={confirmingDelete === admin.email ? 220 : 100}
                                        actions={
                                            isOwner ? (
                                                confirmingDelete === admin.email ? (
                                                    <div className="flex items-center gap-2 h-full py-1">
                                                        <Button
                                                            className="h-full bg-red-500/20 text-red-500 hover:bg-red-500/30"
                                                            onClick={() => handleRemoveAdmin(admin.email)}
                                                        >
                                                            Yes
                                                        </Button>
                                                        <Button
                                                            className="h-full bg-[var(--surface-2)] text-zinc-300 hover:bg-[var(--surface-3)]"
                                                            onClick={() => setConfirmingDelete(null)}
                                                        >
                                                            Cancel
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="flex h-full gap-2 py-1 items-stretch">
                                                        <Button
                                                            className="h-full bg-red-500/20 text-red-400 hover:bg-red-500/30 px-6"
                                                            disabled={admins.length <= 1}
                                                            onClick={() => setConfirmingDelete(admin.email)}
                                                        >
                                                            <Trash2 className="w-5 h-5" />
                                                        </Button>
                                                    </div>
                                                )
                                            ) : null
                                        }
                                    >
                                        <Card className="p-4 bg-[var(--surface-1)]/40 border-[var(--surface-edge)]/50 backdrop-blur-sm flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-zinc-400 shrink-0">
                                                    {admin.email[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-bold text-white leading-none truncate max-w-[150px]">{admin.email}</p>
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
                                        </Card>
                                    </SwipeableCard>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
