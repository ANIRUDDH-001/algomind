/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
    ShieldAlert, Users, Settings, Briefcase,
    LayoutDashboard, ChevronDown, ChevronRight, ShieldCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const STATIC_NAV_ITEMS = [
    { name: 'Admin Users', href: '/admin/admins', icon: ShieldAlert },
    { name: 'All Users', href: '/admin/users', icon: Users },  // redirects to /owner?tab=users
];

export function AdminSidebar() {
    const pathname = usePathname();
    const [hasDeprecatedModels, setHasDeprecatedModels] = useState(false);
    const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(pathname.startsWith('/admin'));

    useEffect(() => {
        // No longer polling model health in the admin sidebar.
        // It belongs in the Owner dashboard now.
        setHasDeprecatedModels(false);
    }, []);

    // Set menu open if current path is an admin sub-path
    useEffect(() => {
        if (pathname.startsWith('/admin')) {
            setIsAdminMenuOpen(true);
        }
    }, [pathname]);

    return (
        <aside className="w-64 border-r border-slate-800 bg-slate-900 hidden lg:flex flex-col shrink-0 min-h-screen">
            <div className="p-6 flex-1 overflow-y-auto scrollbar-none">
                <div className="mb-8 flex items-center gap-3 px-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <ShieldCheck className="w-5 h-5 text-white" />
                    </div>
                    <h2 className="text-sm font-black text-white uppercase tracking-tighter italic">
                        Admin Console
                    </h2>
                </div>

                <nav className="space-y-4">
                    {/* Primary Dashboard Link - Standalone */}
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-3 mb-2">Systems</p>
                        <Link
                            href="/dashboard"
                            className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all border border-transparent hover:border-blue-500/20",
                                pathname === '/dashboard'
                                    ? "bg-blue-600/10 text-blue-400 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]"
                                    : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                            )}
                        >
                            <LayoutDashboard className={cn("w-4 h-4", pathname === '/dashboard' ? "text-blue-400" : "text-slate-500")} />
                            User Dashboard
                        </Link>
                    </div>

                    {/* Consolidated Admin Menu */}
                    <div className="space-y-1">
                        <div className="flex items-center justify-between px-3 mb-2">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Management</p>
                        </div>

                        <button
                            onClick={() => setIsAdminMenuOpen(!isAdminMenuOpen)}
                            className={cn(
                                "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-all group border border-transparent hover:border-blue-500/20",
                                pathname.startsWith('/admin')
                                    ? "text-white"
                                    : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <ShieldCheck className={cn("w-4 h-4", pathname.startsWith('/admin') ? "text-blue-400" : "text-slate-500")} />
                                Admin Tools
                            </div>
                            {isAdminMenuOpen ? (
                                <ChevronDown className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-400" />
                            ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-400" />
                            )}
                        </button>

                        <AnimatePresence>
                            {isAdminMenuOpen && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2, ease: "easeInOut" }}
                                    className="overflow-hidden bg-slate-800/20 rounded-xl"
                                >
                                    <div className="pl-4 py-1 space-y-0.5">
                                        {STATIC_NAV_ITEMS.map((item) => {
                                            const Icon = item.icon;
                                            const isActive = pathname === item.href;

                                            return (
                                                <Link
                                                    key={item.href}
                                                    href={item.href}
                                                    className={cn(
                                                        "flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-colors border border-transparent",
                                                        isActive
                                                            ? 'text-blue-400 bg-blue-400/5'
                                                            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                                                    )}
                                                >
                                                    <Icon className={cn("w-3.5 h-3.5", isActive ? 'text-blue-400' : 'text-slate-600')} />
                                                    {item.name}
                                                    {item.name === 'Model Health' && hasDeprecatedModels && (
                                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 ml-auto animate-pulse" />
                                                    )}
                                                </Link>
                                            );
                                        })}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                    {/* Enterprise Section - Separate from Admin Tools */}
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-3 mb-2">Enterprise</p>
                        <Link
                            href="/admin/employers"
                            className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all border border-transparent hover:border-blue-500/20",
                                pathname === '/admin/employers'
                                    ? "bg-blue-600/10 text-blue-400 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]"
                                    : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                            )}
                        >
                            <Briefcase className={cn("w-4 h-4", pathname === '/admin/employers' ? "text-blue-400" : "text-slate-500")} />
                            Employer Accounts
                        </Link>
                    </div>
                </nav>
            </div>

            <div className="p-6 mt-auto">
                <div className="p-4 rounded-xl border border-slate-800/50 bg-slate-900/50">
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                        <Settings className="w-3.5 h-3.5 shrink-0 text-slate-600" />
                        <span className="font-bold uppercase tracking-tight truncate leading-tight">Config restricted to codebase</span>
                    </div>
                </div>
            </div>
        </aside>
    );
}
