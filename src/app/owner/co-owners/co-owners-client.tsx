'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Key, Trash2, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { addCoOwner, removeCoOwner } from '@/app/actions/owner-mutations';

export function CoOwnersClient({ initialCoOwners }: { initialCoOwners: any[] }) {
    const [newEmail, setNewEmail] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [removingId, setRemovingId] = useState<string | null>(null);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEmail || !newEmail.includes('@')) return;

        setIsAdding(true);
        try {
            await addCoOwner(newEmail);
            toast.success('Co-owner added correctly. They now have full access.');
            setNewEmail('');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Unknown error occurred');
        } finally {
            setIsAdding(false);
        }
    };

    const handleRemove = async (id: string) => {
        setRemovingId(id);
        try {
            await removeCoOwner(id);
            toast.success('Access revoked for co-owner.');
        } catch {
            toast.error('Failed to revoke access');
        } finally {
            setRemovingId(null);
        }
    };

    return (
        <div className="space-y-8 max-w-3xl">
            <div className="rounded-xl p-4 bg-amber-500/5 border border-amber-500/20 flex flex-col sm:flex-row items-center gap-4 text-amber-500 text-sm font-medium">
                <AlertCircle className="w-6 h-6 shrink-0" />
                <p>
                    <strong>Danger Zone:</strong> Co-owners have the exact same privileges as the primary owner.
                    They can view all data, bypass rate limits, and modify any configuration. Only grant this to highly trusted individuals.
                </p>
            </div>

            <Card className="p-6 bg-[var(--surface-1)]/40 border-[var(--surface-edge)]/50">
                <h3 className="font-bold mb-4 flex items-center gap-2 text-zinc-200">
                    <UserPlus className="w-5 h-5 text-amber-400" />
                    Grant Co-Owner Access
                </h3>

                <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3">
                    <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="trusted.colleague@example.com"
                        className="flex-1 bg-[var(--surface-2)]/50 border border-white/15 rounded-xl px-4 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50"
                        disabled={isAdding}
                    />
                    <Button
                        type="submit"
                        disabled={isAdding || !newEmail}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-6 shrink-0"
                    >
                        {isAdding ? 'Granting...' : 'Grant Access'}
                    </Button>
                </form>
            </Card>

            <div className="space-y-4">
                <h3 className="font-bold text-zinc-200 px-1">Active Co-Owners</h3>
                {initialCoOwners.length === 0 ? (
                    <div className="text-zinc-500 text-sm px-1">No co-owners have been granted access.</div>
                ) : (
                    <div className="grid gap-3">
                        {initialCoOwners.map(owner => (
                            <Card key={owner.id} className="p-5 bg-[var(--surface-1)]/40 border-[var(--surface-edge)]/50 flex items-center justify-between gap-4 group">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-amber-500 shrink-0">
                                        <Key className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-white">{owner.email}</p>
                                        <p className="text-xs text-zinc-500 mt-1">
                                            Granted by {owner.granted_by} on {format(new Date(owner.granted_at), 'MMM d, yyyy')}
                                        </p>
                                    </div>
                                </div>

                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemove(owner.id)}
                                    disabled={removingId === owner.id}
                                    className="text-zinc-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all focus:opacity-100"
                                    title="Revoke access"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
