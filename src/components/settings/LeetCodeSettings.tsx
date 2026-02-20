'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
        <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
                <CardTitle className="text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Code2 className="w-5 h-5 text-yellow-500" />
                        LeetCode Profile
                    </div>
                    {isConnected && fetchStatusState === 'success' && (
                        <a
                            href={`https://leetcode.com/${profile.username}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-400 hover:text-blue-400 transition-colors"
                        >
                            <ExternalLink className="w-4 h-4" />
                        </a>
                    )}
                </CardTitle>
                <CardDescription>Connect your LeetCode account to get personalized difficulty recommendations</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex items-center justify-center p-6 text-slate-500">
                        <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                ) : !isConnected || isEditing ? (
                    // NOT CONNECTED or EDITING UI
                    <div className="flex flex-col sm:flex-row gap-3">
                        <Input
                            placeholder="your-leetcode-username"
                            value={usernameInput}
                            onChange={(e) => setUsernameInput(e.target.value)}
                            className="bg-slate-950/50 border-slate-700 text-white placeholder:text-slate-600"
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
                                    className="border-slate-700 hover:bg-slate-800 text-slate-300"
                                >
                                    Cancel
                                </Button>
                            )}
                            <Button
                                onClick={handleConnect}
                                disabled={isConnecting || !usernameInput.trim()}
                                className="bg-yellow-600/20 text-yellow-500 hover:bg-yellow-600 hover:text-white border border-yellow-900/50 min-w-[100px]"
                            >
                                {isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Connect'}
                            </Button>
                        </div>
                    </div>
                ) : (
                    // CONNECTED UI
                    <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 space-y-4">
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
                                        <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Syncing...
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
                                    className="h-8 border-slate-700 hover:bg-slate-700 text-slate-300"
                                >
                                    Edit
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleRefresh}
                                    disabled={isRefreshing || fetchStatusState === 'pending'}
                                    className={`h-8 border-slate-700 hover:bg-slate-700 text-slate-300 w-9 p-0`}
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
                                        <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Problems Solved ({profile.totalSolved})</p>
                                        <div className="flex items-center gap-3 text-sm font-medium">
                                            <span className="text-emerald-400">{profile.easySolved} Easy</span>
                                            <span className="text-slate-600">•</span>
                                            <span className="text-amber-400">{profile.mediumSolved} Medium</span>
                                            <span className="text-slate-600">•</span>
                                            <span className="text-red-400">{profile.hardSolved} Hard</span>
                                        </div>
                                    </div>

                                    {(profile.ranking || profile.contestRating) && (
                                        <div className="space-y-1">
                                            <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Global Standings</p>
                                            <div className="flex items-center gap-4 text-sm font-medium">
                                                {profile.ranking && (
                                                    <span className="text-slate-300">Rank: <span className="text-white">#{profile.ranking.toLocaleString()}</span></span>
                                                )}
                                                {profile.contestRating && (
                                                    <span className="text-slate-300">Rating: <span className="text-yellow-400">{Math.round(profile.contestRating)}</span></span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {profile.lastFetchedAt && (
                                    <p className="text-xs text-slate-500 pt-2 border-t border-slate-800/80">
                                        Last updated: {formatDistanceToNow(new Date(profile.lastFetchedAt), { addSuffix: true })}
                                    </p>
                                )}
                            </>
                        )}

                        {(fetchStatusState === 'failed' || fetchStatusState === 'not_found') && (
                            <div className="pt-2 text-sm text-slate-400">
                                {fetchStatusState === 'not_found'
                                    ? "We couldn't locate this username on LeetCode. Please check the spelling and try again."
                                    : "Failed to grab profile statistics. The API might be rate-limited."
                                }
                                <div className="mt-3">
                                    <Button
                                        size="sm"
                                        onClick={handleConnect}
                                        disabled={isConnecting}
                                        className="bg-slate-700 hover:bg-slate-600 text-white"
                                    >
                                        {isConnecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                                        Retry Connection
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card >
    );
}
