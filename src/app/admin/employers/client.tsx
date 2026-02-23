'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Trash2, Briefcase, Plus, Copy, Check, Mail, Search, UserMinus, UserPlus } from 'lucide-react';
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

    // Invite States
    const [companyName, setCompanyName] = useState('');
    const [email, setEmail] = useState('');
    const [expiresDays, setExpiresDays] = useState('7');
    const [isCreating, setIsCreating] = useState(false);

    // Role Management States
    const [promoteEmail, setPromoteEmail] = useState('');
    const [promoteCompany, setPromoteCompany] = useState('');
    const [isPromoting, setIsPromoting] = useState(false);

    // Search States
    const [activeSearch, setActiveSearch] = useState('');
    const [invitesSearch, setInvitesSearch] = useState('');

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

    const handlePromote = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!promoteEmail.trim()) return;

        try {
            setIsPromoting(true);
            const res = await fetch('/api/admin/users', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: promoteEmail.trim(),
                    accountType: 'employer',
                    companyName: promoteCompany.trim() || undefined
                })
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({ error: 'Promote failed' }));
                throw new Error(data.error || 'Failed to promote user');
            }

            setPromoteEmail('');
            setPromoteCompany('');
            fetchData();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsPromoting(false);
        }
    };

    const handleDemote = async (email: string) => {
        if (!confirm(`Are you sure you want to demote ${email} to Candidate?`)) return;

        try {
            const res = await fetch('/api/admin/users', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    accountType: 'candidate',
                    companyName: null
                })
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({ error: 'Demote failed' }));
                throw new Error(data.error || 'Failed to demote user');
            }

            fetchData();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to demote user');
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

    const handleSendEmail = (invite: EmployerInvite) => {
        const subject = encodeURIComponent(`Your AlgoMind Employer Access Code`);
        const inviteUrl = `${window.location.origin}/employer`;
        const expiryLine = invite.expires_at
            ? `\nThis code expires on: ${format(new Date(invite.expires_at), 'PPP')}\n`
            : '';
        const body = encodeURIComponent(
            `Hi,\n\nYour AlgoMind employer invite code is:\n\n  ${invite.invite_code}\n\n` +
            `Use it at: ${inviteUrl}${expiryLine}\n` +
            `Welcome aboard!\n\nThe AlgoMind Team`
        );
        window.open(`mailto:${invite.email || ''}?subject=${subject}&body=${body}`);
    };

    // Filtered Lists
    const filteredEmployers = useMemo(() => {
        return employers.filter(emp =>
            emp.email.toLowerCase().includes(activeSearch.toLowerCase()) ||
            (emp.company_name?.toLowerCase() || '').includes(activeSearch.toLowerCase()) ||
            (emp.full_name?.toLowerCase() || '').includes(activeSearch.toLowerCase())
        );
    }, [employers, activeSearch]);

    const filteredInvites = useMemo(() => {
        return invites.filter(invite =>
            (invite.email?.toLowerCase() || '').includes(invitesSearch.toLowerCase()) ||
            invite.company_name.toLowerCase().includes(invitesSearch.toLowerCase()) ||
            invite.invite_code.toLowerCase().includes(invitesSearch.toLowerCase())
        );
    }, [invites, invitesSearch]);

    return (
        <div className="text-white p-6 lg:p-10">
            <div className="max-w-5xl mx-auto space-y-8 pb-20">
                <div>
                    <h1 className="text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400 flex items-center gap-3">
                        <Briefcase className="w-8 h-8 text-blue-400" />
                        Employer Accounts
                    </h1>
                    <p className="text-slate-400 mt-2 font-medium">
                        Manage employer access, roles, and invite codes
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Create Invite Section */}
                    <Card className="p-6 bg-slate-900/40 border-slate-800/50 backdrop-blur-sm shadow-xl">
                        <h3 className="font-bold mb-4 flex items-center gap-2 text-slate-200">
                            <Plus className="w-5 h-5 text-blue-400" />
                            Generate Invite Code
                        </h3>

                        <form onSubmit={handleCreateInvite} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                    <label className="block text-xs font-semibold text-slate-400 mb-1">Target Email *</label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="ceo@acme.com"
                                        className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                        disabled={isCreating}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row items-end gap-4">
                                <div className="flex-1 w-full">
                                    <label className="block text-xs font-semibold text-slate-400 mb-1">Expires In (Days)</label>
                                    <input
                                        type="number"
                                        value={expiresDays}
                                        onChange={(e) => setExpiresDays(e.target.value)}
                                        min="0"
                                        className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                        disabled={isCreating}
                                    />
                                </div>
                                <Button
                                    type="submit"
                                    disabled={isCreating || !companyName.trim()}
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 h-[42px]"
                                >
                                    {isCreating ? 'Generating...' : 'Generate'}
                                </Button>
                            </div>
                            <span className="text-[10px] text-slate-500 mt-1 block italic">* Email will be enforced during claim</span>
                        </form>
                    </Card>

                    {/* Promote User Section */}
                    <Card className="p-6 bg-slate-900/40 border-slate-800/50 backdrop-blur-sm shadow-xl">
                        <h3 className="font-bold mb-4 flex items-center gap-2 text-slate-200">
                            <UserPlus className="w-5 h-5 text-purple-400" />
                            Include Employer (Direct)
                        </h3>

                        <form onSubmit={handlePromote} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 mb-1">User Email *</label>
                                    <input
                                        type="email"
                                        value={promoteEmail}
                                        onChange={(e) => setPromoteEmail(e.target.value)}
                                        placeholder="user@example.com"
                                        className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                        required
                                        disabled={isPromoting}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 mb-1">Company (Optional)</label>
                                    <input
                                        type="text"
                                        value={promoteCompany}
                                        onChange={(e) => setPromoteCompany(e.target.value)}
                                        placeholder="Company Name"
                                        className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                        disabled={isPromoting}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end">
                                <Button
                                    type="submit"
                                    disabled={isPromoting || !promoteEmail.trim()}
                                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-8"
                                >
                                    {isPromoting ? 'Adding...' : 'Promote'}
                                </Button>
                            </div>
                            <span className="text-[10px] text-slate-500 mt-1 block italic">* Directly upgrades existing user to Employer</span>
                        </form>
                    </Card>
                </div>

                {/* Employers List Section */}
                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1">
                        <h3 className="font-bold text-slate-200">Active Employers</h3>
                        <div className="relative max-w-sm w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Search employees..."
                                value={activeSearch}
                                onChange={(e) => setActiveSearch(e.target.value)}
                                className="w-full bg-slate-900/50 border border-slate-800 rounded-lg pl-9 pr-4 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500/50"
                            />
                        </div>
                    </div>

                    <div className="max-h-[500px] overflow-y-auto pr-2 custom-scrollbar space-y-3">
                        {loading ? (
                            <div className="text-center py-10 text-slate-500">Loading employers...</div>
                        ) : error ? (
                            <div className="text-center py-10 text-red-500 text-sm">{error}</div>
                        ) : filteredEmployers.length === 0 ? (
                            <div className="text-center py-10 text-slate-500 border border-dashed border-slate-800 rounded-xl">
                                {activeSearch ? "No matching employers found" : "No active employer accounts found"}
                            </div>
                        ) : (
                            filteredEmployers.map((emp) => (
                                <Card key={emp.id} className="p-5 bg-slate-900/40 border-slate-800/50 backdrop-blur-sm shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 group">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full md:w-auto flex-1 text-left">
                                        <div>
                                            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1">Company</p>
                                            <p className="font-medium text-slate-200 truncate">{emp.company_name || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1">User Details</p>
                                            <div className="space-y-0.5">
                                                <p className="text-sm text-slate-300 truncate">{emp.full_name || 'No Name'}</p>
                                                <p className="text-xs text-slate-400 truncate">{emp.email}</p>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1">Joined</p>
                                            <p className="text-sm text-slate-300">{format(new Date(emp.created_at), 'MMM d, yyyy')}</p>
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleDemote(emp.email)}
                                        className="text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                                    >
                                        <UserMinus className="w-4 h-4 mr-2" />
                                        Delete
                                    </Button>
                                </Card>
                            ))
                        )}
                    </div>
                </div>

                {/* Invites List Section */}
                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1">
                        <h3 className="font-bold text-slate-200">Pending & History (Invites)</h3>
                        <div className="relative max-w-sm w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Search invites..."
                                value={invitesSearch}
                                onChange={(e) => setInvitesSearch(e.target.value)}
                                className="w-full bg-slate-900/50 border border-slate-800 rounded-lg pl-9 pr-4 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500/50"
                            />
                        </div>
                    </div>

                    <div className="max-h-[500px] overflow-y-auto pr-2 custom-scrollbar space-y-3">
                        {loading ? (
                            <div className="text-center py-10 text-slate-500">Loading invites...</div>
                        ) : filteredInvites.length === 0 ? (
                            <div className="text-center py-10 text-slate-500 border border-dashed border-slate-800 rounded-xl">
                                {invitesSearch ? "No matching invites found" : "No invites found"}
                            </div>
                        ) : (
                            filteredInvites.map((invite) => {
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
                                    <Card key={invite.id} className="p-5 bg-slate-900/40 border-slate-800/50 backdrop-blur-sm shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-left">
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full md:w-auto flex-1">
                                            <div>
                                                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1">Company</p>
                                                <p className="font-medium text-slate-200 truncate">{invite.company_name}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1">Code</p>
                                                <div className="flex items-center gap-2 font-mono">
                                                    <code className="bg-slate-800 px-2 py-0.5 rounded text-[12px] text-blue-300">
                                                        {invite.invite_code}
                                                    </code>
                                                    <button
                                                        onClick={() => copyToClipboard(invite.id, invite.invite_code)}
                                                        className="text-slate-500 hover:text-white transition-colors"
                                                    >
                                                        {copiedId === invite.id ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                                                    </button>
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1">Status</p>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusColor}`}>
                                                    {statusText}
                                                </span>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1">Created</p>
                                                <p className="text-xs text-slate-400">{format(new Date(invite.created_at), 'MMM d, yyyy')}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            {!isUsed && invite.is_active && !isExpired && (
                                                <>
                                                    {invite.email && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors h-8"
                                                            onClick={() => handleSendEmail(invite)}
                                                        >
                                                            <Mail className="w-4 h-4 mr-2" />
                                                            Email
                                                        </Button>
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors h-8"
                                                        onClick={() => handleDeactivate(invite.id)}
                                                    >
                                                        <Trash2 className="w-4 h-4 mr-2" />
                                                        Disable
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </Card>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #1e293b;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #334155;
                }
            `}</style>
        </div>
    );
}
