'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Code2, ExternalLink, RefreshCw, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/components/auth/AuthProvider';

interface LeetCodeProfileResponse {
    connected: boolean;
    username?: string;
    totalSolved?: number;
    easySolved?: number;
    mediumSolved?: number;
    hardSolved?: number;
    ranking?: number;
    contestRating?: number;
    fetchStatus?: 'pending' | 'success' | 'failed' | 'not_found';
    lastFetchedAt?: string;
}

export function LeetCodeSettings() {
    const { user } = useAuth();
    const [profile, setProfile] = useState<LeetCodeProfileResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [usernameInput, setUsernameInput] = useState('');
    const [isEditing, setIsEditing] = useState(false);

    const fetchStatus = async () => {
        try {
            const res = await fetch('/api/leetcode/status');
            if (res.ok) {
                const data = await res.json();
                setProfile(data);
                if (data.connected && data.username) {
                    setUsernameInput(data.username);
                }
            }
        } catch (error) {
            console.error('Failed to fetch LeetCode status:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchStatus();
        } else {
            setIsLoading(false); // Guest mode
        }
    }, [user]);

    // Polling mechanism if status is pending
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (profile?.connected && profile?.fetchStatus === 'pending') {
            interval = setInterval(() => {
                fetchStatus();
            }, 3000); // Check every 3 seconds while pending
        }
        return () => clearInterval(interval);
    }, [profile?.connected, profile?.fetchStatus]);

    const handleConnect = async () => {
        if (!usernameInput.trim()) return;

        setIsConnecting(true);
        try {
            const res = await fetch('/api/leetcode/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: usernameInput.trim() }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to connect');

            toast.success(data.message);
            setIsEditing(false);
            await fetchStatus();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Connection failed');
        } finally {
            setIsConnecting(false);
        }
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            const res = await fetch('/api/leetcode/refresh', { method: 'POST' });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Failed to refresh');

            toast.success('Refresh triggered. Syncing data...');
            // Immediately set status to pending to show syncing UI
            setProfile(prev => prev ? { ...prev, fetchStatus: 'pending' } : null);

            // Re-fetch status shortly after to catch updates
            setTimeout(fetchStatus, 2000);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Refresh failed');
        } finally {
            setIsRefreshing(false);
        }
    };

    if (!user) return null; // Hide entirely for guests

    // Decide what to render based on connection state
    const isConnected = profile?.connected;
    const fetchStatusState = profile?.fetchStatus;

    return (
        <div className="space-y-2 mb-8">
            <h2 className="text-xs font-black uppercase tracking-widest text-zinc-600 flex items-center justify-between">
                <span>LeetCode Connect</span>
                {isConnected && fetchStatusState === 'success' && (
                    <a
                        href={`https://leetcode.com/${profile.username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-yellow-500/70 hover:text-yellow-500 transition-colors flex items-center gap-1"
                    >
                        View Profile <ExternalLink className="w-3 h-3" />
                    </a>
                )}
            </h2>
            <div className="rounded-2xl overflow-hidden p-5"
                style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-edge)' }}>
                {isLoading ? (
                    <div className="flex items-center justify-center py-4 text-zinc-500">
                        <div className="w-6 h-6 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
                    </div>
                ) : !isConnected || isEditing ? (
                    // NOT CONNECTED or EDITING UI
                    <div className="flex flex-col sm:flex-row gap-3">
                        <Input
                            placeholder="your-leetcode-username"
                            value={usernameInput}
                            onChange={(e) => setUsernameInput(e.target.value)}
                            className="text-white placeholder:text-zinc-600 focus-visible:ring-yellow-500/50"
                            style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-edge)' }}
                            onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                        />
                        <div className="flex gap-2">
                            {isEditing && (
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setIsEditing(false);
                                        setUsernameInput(profile?.username || '');
                                    }}
                                    className="text-zinc-300 hover:text-white"
                                    style={{ background: 'var(--surface-3)', border: '1px solid var(--surface-edge)' }}
                                >
                                    Cancel
                                </Button>
                            )}
                            <Button
                                onClick={handleConnect}
                                disabled={isConnecting || !usernameInput.trim()}
                                className="bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500 hover:text-black border border-yellow-500/30 min-w-[100px] transition-all"
                            >
                                {isConnecting ? <div className="w-4 h-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" /> : 'Connect'}
                            </Button>
                        </div>
                    </div>
                ) : (
                    // CONNECTED UI
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <span className="font-bold text-lg text-white">{profile.username}</span>
                                {fetchStatusState === 'success' && (
                                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                                        <CheckCircle2 className="w-3 h-3 mr-1" /> Verified
                                    </Badge>
                                )}
                                {fetchStatusState === 'pending' && (
                                    <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">
                                        <div className="w-3 h-3 mr-1 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" /> Syncing...
                                    </Badge>
                                )}
                                {(fetchStatusState === 'failed' || fetchStatusState === 'not_found') && (
                                    <Badge className="bg-red-500/10 text-red-400 border-red-500/20">
                                        <AlertCircle className="w-3 h-3 mr-1" /> {fetchStatusState === 'not_found' ? 'Not Found' : 'Sync Failed'}
                                    </Badge>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsEditing(true)}
                                    className="h-8 text-zinc-300 hover:text-white"
                                    style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-edge)' }}
                                >
                                    Edit
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleRefresh}
                                    disabled={isRefreshing || fetchStatusState === 'pending'}
                                    className="h-8 w-9 p-0 text-zinc-300 hover:text-white"
                                    style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-edge)' }}
                                    title="Refresh stats (Limit: 1/hr)"
                                >
                                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                                </Button>
                            </div>
                        </div>

                        {fetchStatusState === 'success' && (
                            <>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                    <div className="space-y-1">
                                        <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Problems Solved ({profile.totalSolved})</p>
                                        <div className="flex items-center gap-3 text-sm font-medium">
                                            <span className="text-emerald-400">{profile.easySolved} Easy</span>
                                            <span className="text-zinc-600">•</span>
                                            <span className="text-amber-400">{profile.mediumSolved} Medium</span>
                                            <span className="text-zinc-600">•</span>
                                            <span className="text-red-400">{profile.hardSolved} Hard</span>
                                        </div>
                                    </div>

                                    {(profile.ranking || profile.contestRating) && (
                                        <div className="space-y-1">
                                            <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Global Standings</p>
                                            <div className="flex items-center gap-4 text-sm font-medium">
                                                {profile.ranking && (
                                                    <span className="text-zinc-400">Rank: <span className="text-white">#{profile.ranking.toLocaleString()}</span></span>
                                                )}
                                                {profile.contestRating && (
                                                    <span className="text-zinc-400">Rating: <span className="text-yellow-400">{Math.round(profile.contestRating)}</span></span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {profile.lastFetchedAt && (
                                    <p className="text-[10px] text-zinc-500 pt-3 mt-3 border-t border-[var(--surface-edge)] font-bold uppercase tracking-widest">
                                        Last updated: {formatDistanceToNow(new Date(profile.lastFetchedAt), { addSuffix: true })}
                                    </p>
                                )}
                            </>
                        )}

                        {(fetchStatusState === 'failed' || fetchStatusState === 'not_found') && (
                            <div className="pt-2 text-sm text-zinc-400">
                                {fetchStatusState === 'not_found'
                                    ? "We couldn't locate this username on LeetCode. Please check the spelling and try again."
                                    : "Failed to grab profile statistics. The API might be rate-limited."
                                }
                                <div className="mt-3">
                                    <Button
                                        size="sm"
                                        onClick={handleConnect}
                                        disabled={isConnecting}
                                        className="text-white"
                                        style={{ background: 'var(--surface-3)', border: '1px solid var(--surface-edge)' }}
                                    >
                                        {isConnecting ? <div className="w-4 h-4 mr-2 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                                        Retry Connection
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
