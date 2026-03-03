'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { ShieldAlert, Briefcase } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';

export function AdminTabsNav() {
    const router = useRouter();
    const pathname = usePathname();

    const tabs = [
        { id: '/admin', label: 'Admin Users', icon: ShieldAlert },
        { id: '/admin/employers', label: 'Employer Accounts', icon: Briefcase },
    ] as const;

    return (
        <div className="w-full overflow-x-auto mobile-scroll-container mb-8 -mx-2 px-2 flex justify-center">
            <nav className="flex items-center gap-1 p-1.5 backdrop-blur-xl rounded-2xl w-max min-w-full sm:w-fit shadow-2xl" style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-edge)' }}>
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    // Strict match for admin users, otherwise match path
                    const isActive = pathname === tab.id;

                    return (
                        <button
                            key={tab.id}
                            onClick={() => router.push(tab.id)}
                            className={cn(
                                "flex items-center gap-2 px-3 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 active:scale-95 group whitespace-nowrap",
                                isActive
                                    ? "text-white shadow-lg shadow-blue-500/20"
                                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                            )}
                            style={isActive ? { background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))' } : {}}
                        >
                            <Icon className={cn(
                                "w-4 h-4 transition-transform group-hover:scale-110 flex-shrink-0",
                                isActive ? "text-white" : "text-zinc-500"
                            )} />
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </nav>
        </div>
    );
}
