'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import {
    Users, Flag, Shield, Settings, Briefcase,
    Activity, Key, LayoutGrid, Database, BookOpen, Mic, BarChart2
} from 'lucide-react';
import { cn } from '@/lib/utils';
// We'll extract tab contents into separate components for maintainability
import { OverviewTab } from './tabs/overview-tab';
import { UsersTab } from './tabs/users-tab';
import { FlagsTab } from './tabs/flags-tab';
import { CoOwnersTab } from './tabs/co-owners-tab';
import { RateLimitsTab } from './tabs/rate-limits-tab';
import { AdminsTab } from './tabs/admins-tab';
import { EmployersTab } from './tabs/employers-tab';
import { ModelsTab } from './tabs/models-tab';
import { CacheTab } from './tabs/cache-tab';
import { KnowledgeTab } from './tabs/knowledge-tab';
import { VoiceDebugTab } from './tabs/voice-debug-tab';
import { AnalyticsTab } from './tabs/analytics-tab';
import { AIStatusTab } from './tabs/ai-status-tab';
import { ModelRoutingTab } from './tabs/model-routing-tab';
import { AWSBudgetTab } from './tabs/aws-budget-tab';
import { SystemConfigTab } from './tabs/system-config-tab';
import { useSearchParams, useRouter } from 'next/navigation';

export interface OwnerDashboardProps {
    stats: { totalUsers: number; totalAdmins: number; totalEmployers: number };
    featureFlags: any[];
    coOwners: any[];
    recentEvents: any[];
    isPrimaryOwner: boolean;
    userEmail: string;
}

const TABS = [
    { id: 'overview', label: 'Overview', icon: LayoutGrid },
    { id: 'flags', label: 'Feature Flags', icon: Flag },
    { id: 'aws-budget', label: 'AWS Budget', icon: Activity },
    { id: 'models', label: 'Models', icon: Activity },
    { id: 'ai-routing', label: 'AI Routing', icon: Activity },
    { id: 'cache', label: 'Cache & Redis', icon: Database },
    { id: 'rag', label: 'RAG Knowledge', icon: BookOpen },
    { id: 'voice-debug', label: 'Voice Debug', icon: Mic },
    { id: 'analytics', label: 'Analytics', icon: BarChart2 },
    { id: 'ai-status', label: 'AI Status', icon: Activity },
    { id: 'limits', label: 'Rate Limits', icon: Activity },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'co-owners', label: 'Co-Owners', icon: Key },
    { id: 'admins', label: 'Admins', icon: Shield },
    { id: 'employers', label: 'Employers', icon: Briefcase },
    { id: 'settings', label: 'Config', icon: Settings },
];

export function OwnerDashboardClient(props: OwnerDashboardProps) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const tabFromUrl = searchParams.get('tab') || 'overview';
    const [activeTab, setActiveTab] = useState(tabFromUrl);

    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        router.replace(`/owner?tab=${tab}`, { scroll: false });
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white p-6 lg:p-10">
            <div className="max-w-[1400px] mx-auto space-y-8">
                <div>
                    <h1 className="text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-orange-500 flex items-center gap-3">
                        <Key className="w-8 h-8 text-amber-500" />
                        Owner Dashboard
                    </h1>
                    <p className="text-zinc-400 mt-2 font-medium">
                        Absolute control over the AlgoMind platform. Proceed with caution.
                    </p>
                </div>

                <div className="flex flex-col lg:flex-row gap-8 items-start">
                    {/* Sidebar Navigation */}
                    <Card className="w-full lg:w-64 p-3 bg-[var(--surface-1)]/40 border-[var(--surface-edge)]/50 shrink-0">
                        <nav className="flex lg:flex-col gap-1 overflow-x-auto pb-2 lg:pb-0">
                            {TABS.map((tab) => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.id;
                                // Hide Co-Owners tab if not the primary owner
                                if (tab.id === 'co-owners' && !props.isPrimaryOwner) return null;

                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => handleTabChange(tab.id)}
                                        className={cn(
                                            "flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all text-sm whitespace-nowrap",
                                            isActive
                                                ? "bg-amber-500/10 text-amber-400"
                                                : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                                        )}
                                    >
                                        <Icon className="w-4 h-4" />
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </nav>
                    </Card>

                    {/* Main Content Area */}
                    <div className="flex-1 w-full relative min-h-[500px]">
                        {activeTab === 'overview' && <OverviewTab {...props} />}
                        {activeTab === 'users' && <UsersTab {...props} />}
                        {activeTab === 'flags' && <FlagsTab initialFlags={props.featureFlags} />}
                        {activeTab === 'aws-budget' && <AWSBudgetTab />}
                        {activeTab === 'co-owners' && props.isPrimaryOwner && <CoOwnersTab coOwners={props.coOwners} />}
                        {activeTab === 'limits' && <RateLimitsTab />}
                        {activeTab === 'admins' && <AdminsTab />}
                        {activeTab === 'employers' && <EmployersTab />}
                        {activeTab === 'models' && <ModelsTab />}
                        {activeTab === 'ai-routing' && <ModelRoutingTab />}
                        {activeTab === 'cache' && <CacheTab />}
                        {activeTab === 'rag' && <KnowledgeTab />}
                        {activeTab === 'voice-debug' && <VoiceDebugTab />}
                        {activeTab === 'analytics' && <AnalyticsTab />}
                        {activeTab === 'ai-status' && <AIStatusTab />}
                        {activeTab === 'settings' && <SystemConfigTab />}
                    </div>
                </div>
            </div>
        </div>
    );
}
