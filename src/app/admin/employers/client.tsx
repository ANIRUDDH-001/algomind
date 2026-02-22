'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Trash2, Briefcase, Plus, Copy, Check } from 'lucide-react';
import { format } from 'date-fns';

interface EmployerInvite {
    id: string;
    invite_code: string;
    email: string | null;
    company_name: string;
    expires_at: string | null;
    is_active: boolean;
    used_by: string | null;
    used_at: string | null;
    created_at: string;
}

interface EmployerProfile {
    id: string;
    email: string;
    full_name: string | null;
    company_name: string | null;
    created_at: string;
}

export default function EmployersClient() {
    const [invites, setInvites] = useState<EmployerInvite[]>([]);
    const [employers, setEmployers] = useState<EmployerProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [companyName, setCompanyName] = useState('');
    const [email, setEmail] = useState('');
    const [expiresDays, setExpiresDays] = useState('7');
    const [isCreating, setIsCreating] = useState(false);

    const [copiedId, setCopiedId] = useState<string | null>(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);

            const [invitesRes, employersRes] = await Promise.all([
                fetch('/api/admin/employer-invites'),
                fetch('/api/admin/employers')
            ]);

            if (!invitesRes.ok) throw new Error('Failed to load invites');
            if (!employersRes.ok) throw new Error('Failed to load employers');

            const invitesData = await invitesRes.json();
            const employersData = await employersRes.json();

            setInvites(invitesData.invites || []);
            setEmployers(employersData.employers || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCreateInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!companyName.trim()) return;

        try {
            setIsCreating(true);
            const expiresAt = expiresDays ? new Date(Date.now() + parseInt(expiresDays) * 24 * 60 * 60 * 1000).toISOString() : null;

            const res = await fetch('/api/admin/employer-invites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    companyName: companyName.trim(),
                    email: email.trim() || null,
                    expiresAt
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to create invite');
            }

            setCompanyName('');
            setEmail('');
            setExpiresDays('7');
            fetchData();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeactivate = async (id: string) => {
        if (!confirm('Are you sure you want to deactivate this invite?')) return;

        try {
            const res = await fetch(`/api/admin/employer-invites?id=${id}`, {
                method: 'DELETE',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to deactivate invite');
            }

            fetchData();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to deactivate invite');
        }
    };

    const copyToClipboard = (id: string, code: string) => {
        navigator.clipboard.writeText(code);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    return (
        <div className="text-white p-6 lg:p-10">
            <div className="max-w-5xl mx-auto space-y-8">
                <div>
                    <h1 className="text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400 flex items-center gap-3">
                        <Briefcase className="w-8 h-8 text-blue-400" />
                        Employer Accounts
                    </h1>
                    <p className="text-slate-400 mt-2 font-medium">
                        Manage employer access and invite codes
                    </p>
                </div>

                {/* Create Invite Section */}
                <Card className="p-6 bg-slate-900/40 border-slate-800/50 backdrop-blur-sm shadow-xl">
                    <h3 className="font-bold mb-4 flex items-center gap-2 text-slate-200">
                        <Plus className="w-5 h-5 text-blue-400" />
                        Generate Invite Code
                    </h3>

                    <form onSubmit={handleCreateInvite} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 mb-1">Company Name *</label>
                                <input
                                    type="text"
                                    value={companyName}
                                    onChange={(e) => setCompanyName(e.target.value)}
                                    placeholder="Acme Corp"
                                    className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    required
                                    disabled={isCreating}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 mb-1">Email (Optional)</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="ceo@acme.com"
                                    className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    disabled={isCreating}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 mb-1">Expires In (Days)</label>
                                <input
                                    type="number"
                                    value={expiresDays}
                                    onChange={(e) => setExpiresDays(e.target.value)}
                                    min="0"
                                    className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    disabled={isCreating}
                                />
                                <span className="text-[10px] text-slate-500 mt-1 block">0 for no expiry</span>
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <Button
                                type="submit"
                                disabled={isCreating || !companyName.trim()}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6"
                            >
                                {isCreating ? 'Generating...' : 'Generate Invite'}
                            </Button>
                        </div>
                    </form>
                </Card>

                {/* Employers List Section */}
                <div className="space-y-4">
                    <h3 className="font-bold text-slate-200 px-1">Active Employers</h3>

                    {loading ? (
                        <div className="text-center py-6 text-slate-500">Loading employers...</div>
                    ) : error ? (
                        <div className="text-center py-6 text-red-500 text-sm">{error}</div>
                    ) : employers.length === 0 ? (
                        <div className="text-center py-6 text-slate-500">No active employer accounts found</div>
                    ) : (
                        <div className="grid gap-3">
                            {employers.map((emp) => (
                                <Card key={emp.id} className="p-5 bg-slate-900/40 border-slate-800/50 backdrop-blur-sm shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full md:w-auto flex-1">
                                        <div>
                                            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Company</p>
                                            <p className="font-medium text-slate-200">{emp.company_name || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">User Details</p>
                                            <div className="space-y-0.5">
                                                <p className="text-sm text-slate-300">{emp.full_name || 'No Name'}</p>
                                                <p className="text-xs text-slate-400">{emp.email}</p>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Joined</p>
                                            <p className="text-sm text-slate-300">{format(new Date(emp.created_at), 'MMM d, yyyy')}</p>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>

                {/* Invites List Section */}
                <div className="space-y-4">
                    <h3 className="font-bold text-slate-200 px-1">All Invites</h3>

                    {loading ? (
                        <div className="text-center py-10 text-slate-500">Loading invites...</div>
                    ) : error ? (
                        <Card className="p-8 bg-slate-900/40 border-red-900/50 flex flex-col items-center justify-center text-center gap-4">
                            <AlertCircle className="w-8 h-8 text-red-500" />
                            <p className="text-red-400 font-medium">Failed to load data.</p>
                            <Button onClick={fetchData} variant="outline" className="border-slate-700">
                                Retry
                            </Button>
                        </Card>
                    ) : invites.length === 0 ? (
                        <div className="text-center py-10 text-slate-500">No invites found</div>
                    ) : (
                        <div className="grid gap-3">
                            {invites.map((invite) => {
                                const isExpired = invite.expires_at && new Date(invite.expires_at) < new Date();
                                const isUsed = !!invite.used_by;
                                let statusColor = 'text-green-400 bg-green-400/10 border-green-400/20';
                                let statusText = 'Active';

                                if (isUsed) {
                                    statusColor = 'text-slate-400 bg-slate-400/10 border-slate-400/20';
                                    statusText = 'Used';
                                } else if (!invite.is_active) {
                                    statusColor = 'text-red-400 bg-red-400/10 border-red-400/20';
                                    statusText = 'Deactivated';
                                } else if (isExpired) {
                                    statusColor = 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
                                    statusText = 'Expired';
                                }

                                return (
                                    <Card key={invite.id} className="p-5 bg-slate-900/40 border-slate-800/50 backdrop-blur-sm shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full md:w-auto flex-1">
                                            <div>
                                                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Company</p>
                                                <p className="font-medium text-slate-200">{invite.company_name}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Code</p>
                                                <div className="flex items-center gap-2">
                                                    <code className="bg-slate-800 px-2 py-0.5 rounded text-sm text-blue-300 font-mono">
                                                        {invite.invite_code}
                                                    </code>
                                                    <button
                                                        onClick={() => copyToClipboard(invite.id, invite.invite_code)}
                                                        className="text-slate-500 hover:text-white transition-colors"
                                                        title="Copy Code"
                                                    >
                                                        {copiedId === invite.id ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Status</p>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${statusColor}`}>
                                                    {statusText}
                                                </span>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Details</p>
                                                <div className="text-xs text-slate-400 space-y-0.5">
                                                    {invite.email && <p>Email: {invite.email}</p>}
                                                    {invite.expires_at && <p>Expires: {format(new Date(invite.expires_at), 'MMM d, yyyy')}</p>}
                                                    <p>Created: {format(new Date(invite.created_at), 'MMM d, yyyy')}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {!isUsed && invite.is_active && !isExpired && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors gap-2 shrink-0"
                                                onClick={() => handleDeactivate(invite.id)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                <span className="hidden sm:inline">Deactivate</span>
                                            </Button>
                                        )}
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
