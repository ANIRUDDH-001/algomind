'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Menu, X, ShieldCheck, LayoutDashboard, ChevronRight,
    ServerCrash, BarChart, Flag, Activity, Database,
    MessageSquare, ShieldAlert, Briefcase
} from 'lucide-react';
import { Drawer } from 'vaul';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
    { name: 'Model Health', href: '/admin/models', icon: ServerCrash },
    { name: 'Analytics', href: '/admin/analytics', icon: BarChart },
    { name: 'Feature Flags', href: '/admin/features', icon: Flag },
    { name: 'Cache Stats', href: '/admin/cache-stats', icon: Activity },
    { name: 'Knowledge Base', href: '/admin/knowledge', icon: Database },
    { name: 'Voice Debug', href: '/admin/voice-debug', icon: MessageSquare },
    { name: 'Admin Users', href: '/admin/admins', icon: ShieldAlert },
    { name: 'Employers', href: '/admin/employers', icon: Briefcase },
];

export function AdminMobileNav() {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);

    return (
        <header className="lg:hidden h-16 border-b border-slate-800 bg-slate-950 flex items-center justify-between px-4 sticky top-0 z-50">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/10">
                    <ShieldCheck className="w-5 h-5 text-white" />
                </div>
                <span className="text-sm font-black text-white uppercase tracking-tighter italic">
                    AlgoMind Admin
                </span>
            </div>

            <Drawer.Root open={open} onOpenChange={setOpen} direction="right">
                <Drawer.Trigger asChild>
                    <button className="p-2 text-slate-400 hover:text-white transition-colors">
                        <Menu className="w-6 h-6" />
                    </button>
                </Drawer.Trigger>
                <Drawer.Portal>
                    <Drawer.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
                    <Drawer.Content className="bg-slate-900 border-l border-slate-800 h-full w-[280px] fixed right-0 top-0 z-50 flex flex-col outline-none">
                        <div className="p-6 flex items-center justify-between border-b border-slate-800">
                            <h2 className="text-sm font-black text-white uppercase tracking-widest">Navigation</h2>
                            <Drawer.Close asChild>
                                <button className="p-2 text-slate-500 hover:text-white transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </Drawer.Close>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-6">
                            {/* Standalone Dashboard Link */}
                            <div className="space-y-2">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Systems</p>
                                <Link
                                    href="/dashboard"
                                    onClick={() => setOpen(false)}
                                    className={cn(
                                        "flex items-center justify-between p-3 rounded-xl border transition-all",
                                        pathname === '/dashboard'
                                            ? "bg-blue-600/10 border-blue-500/30 text-blue-400 shadow-lg shadow-blue-500/5"
                                            : "bg-slate-800/20 border-transparent text-slate-400"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <LayoutDashboard className="w-4 h-4" />
                                        <span className="font-bold">User Dashboard</span>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-slate-600" />
                                </Link>
                            </div>

                            {/* Admin Menu Sections */}
                            <div className="space-y-2">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Admin Tools</p>
                                <div className="grid grid-cols-1 gap-1">
                                    {NAV_ITEMS.map((item) => {
                                        const Icon = item.icon;
                                        const isActive = pathname === item.href;
                                        return (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                onClick={() => setOpen(false)}
                                                className={cn(
                                                    "flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-all",
                                                    isActive
                                                        ? "bg-slate-800 text-white border-l-2 border-blue-500"
                                                        : "text-slate-400 hover:bg-slate-800/50"
                                                )}
                                            >
                                                <Icon className={cn("w-4 h-4", isActive ? "text-blue-400" : "text-slate-500")} />
                                                {item.name}
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-800 bg-slate-900/50 mt-auto">
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight text-center">
                                AlgoMind v0.1.0 (Admin)
                            </p>
                        </div>
                    </Drawer.Content>
                </Drawer.Portal>
            </Drawer.Root>
        </header>
    );
}
