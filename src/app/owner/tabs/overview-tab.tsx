/**
 * @codesage
 * @file      src/app/owner/tabs/overview-tab.tsx
 * @purpose   Displays high-level platform stats and recent system events.
 * @tech      React, Lucide React, Tailwind
 * @connects  None
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1
 */
'use client';

import { Card } from '@/components/ui/card';
import { Users, Shield, Briefcase, Activity } from 'lucide-react';
import { OwnerDashboardProps } from '../client';
import { format } from 'date-fns';

export function OverviewTab({ stats, recentEvents }: OwnerDashboardProps) {
    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
                Platform Overview
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-6 bg-emerald-500/10 border-emerald-500/20">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                            <Users className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-emerald-400/80 uppercase tracking-wider">Total Users</p>
                            <p className="text-3xl font-black text-emerald-300">{stats.totalUsers.toLocaleString()}</p>
                        </div>
                    </div>
                </Card>

                <Card className="p-6 bg-indigo-500/10 border-indigo-500/20">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                            <Briefcase className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-indigo-400/80 uppercase tracking-wider">Employers</p>
                            <p className="text-3xl font-black text-indigo-300">{stats.totalEmployers.toLocaleString()}</p>
                        </div>
                    </div>
                </Card>

                <Card className="p-6 bg-amber-500/10 border-amber-500/20">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400">
                            <Shield className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-amber-400/80 uppercase tracking-wider">Admins</p>
                            <p className="text-3xl font-black text-amber-300">{stats.totalAdmins.toLocaleString()}</p>
                        </div>
                    </div>
                </Card>
            </div>

            <Card className="p-6 bg-[var(--surface-1)]/40 border-[var(--surface-edge)]/50">
                <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-4 flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Recent System Events
                </h3>

                {recentEvents.length === 0 ? (
                    <p className="text-zinc-500 text-sm">No recent events.</p>
                ) : (
                    <div className="space-y-3">
                        {recentEvents.map(event => (
                            <div key={event.id} className="flex flex-col sm:flex-row gap-2 sm:gap-4 sm:items-center py-2 border-b border-white/5 last:border-0">
                                <span className="text-xs text-zinc-500 font-mono w-32 shrink-0">
                                    {format(new Date(event.created_at), 'MMM d, HH:mm:ss')}
                                </span>
                                <span className="text-xs font-bold uppercase px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 shrink-0">
                                    {event.type}
                                </span>
                                <span className="text-sm text-zinc-300 truncate">
                                    {event.account_email || event.account_id || 'System'}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
}
