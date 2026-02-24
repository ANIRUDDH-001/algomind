'use client';

import { useAuth } from '@/components/auth/AuthProvider';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, Settings, BarChart, Home, Mic, Shield, Flag, Briefcase, BookOpen } from 'lucide-react';
import Link from 'next/link';
import { DemoBanner } from '@/components/demo/DemoBanner';
import { isDemoMode } from '@/lib/demo/manager';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { useAdmin } from '@/hooks/useAdmin';
import { motion } from 'framer-motion';

export function Navbar() {
    const { user, signOut, loading, isConfigured } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [isDemo, setIsDemo] = useState(false);
    const { isAdmin } = useAdmin();
    const [hasDeprecatedModels, setHasDeprecatedModels] = useState(false);
    const [accountType, setAccountType] = useState<'candidate' | 'employer' | 'admin'>('candidate');

    useEffect(() => {
        if (!user) return;
        const fetchAccountType = async () => {
            try {
                const res = await fetch('/api/user/account-type');
                if (res.ok) {
                    const data = await res.json();
                    setAccountType(data.accountType);
                }
            } catch { }
        };
        fetchAccountType();
    }, [user?.id]);

    const dashboardHref = accountType === 'employer'
        ? '/employer/dashboard'
        : '/dashboard';

    useEffect(() => {
        setIsDemo(isDemoMode());

        const checkModels = async () => {
            if (!isAdmin) return;
            try {
                const res = await fetch('/api/admin/events?type=model_deprecated&days=1&limit=1');
                if (res.ok) {
                    const data = await res.json();
                    setHasDeprecatedModels(data.count > 0);
                }
            } catch (error) {
                console.error("Failed to fetch model deprecation status:", error);
            }
        };

        if (isAdmin) {
            checkModels();
            const interval = setInterval(checkModels, 5 * 60 * 1000); // 5 mins
            return () => clearInterval(interval);
        }
    }, [pathname, isAdmin]);

    const handleLogout = async () => {
        await signOut();
        router.push('/');
    };

    // Hide navbar on certain pages
    const hideNavbarRoutes = ['/login'];
    if (hideNavbarRoutes.includes(pathname)) {
        return null;
    }

    return (
        <>
            <header className="fixed top-0 left-0 right-0 z-[100] flex flex-col" style={{ '--navbar-h': isDemo ? '104px' : '64px' } as React.CSSProperties}>
                <DemoBanner />
                <nav
                    className="backdrop-blur-xl h-16 shadow-2xl"
                    style={{
                        background: 'rgba(10,10,15,0.85)',
                        backdropFilter: 'blur(24px)',
                        borderBottom: '1px solid rgba(99,102,241,0.12)'
                    }}
                >
                    <div className="w-full px-6 lg:px-8">
                        <div className="flex items-center justify-between h-16">
                            {/* Logo */}
                            <button
                                onClick={() => router.push('/')}
                                className="flex items-center gap-3 font-bold text-xl text-white hover:text-indigo-400 transition-colors group shrink-0"
                            >
                                <img
                                    src="/icon-192x192.png"
                                    alt="AlgoMind Logo"
                                    className="w-8 h-8 group-hover:scale-110 transition-transform drop-shadow-[0_0_8px_rgba(99,102,241,0.5)] rounded-lg"
                                />
                                <span className="tracking-tight font-black bg-clip-text text-transparent bg-gradient-to-r from-zinc-100 to-zinc-500">AlgoMind</span>
                            </button>

                            {/* Navigation Links — Home+Practice for everyone, Dashboard+Assessments for auth */}
                            <div className="hidden md:flex items-center gap-6">
                                {[
                                    { href: '/', label: 'Home', authOnly: false },
                                    { href: '/practice', label: 'Practice', authOnly: false },
                                    ...(user ? [
                                        { href: dashboardHref, label: 'Dashboard', authOnly: true },
                                        { href: '/dashboard/interview-history', label: 'Assessments', authOnly: true },
                                    ] : []),
                                ].map((link) => {
                                    const isActive = pathname === link.href;
                                    return (
                                        <Link
                                            key={link.href}
                                            href={link.href}
                                            className={`relative py-2 text-sm font-bold transition-colors ${isActive ? 'text-indigo-400' : 'text-zinc-400 hover:text-zinc-100'}`}
                                        >
                                            {link.label}
                                            {isActive && (
                                                <motion.div
                                                    layoutId="nav-active"
                                                    className="absolute -bottom-0.5 left-0 right-0 h-0.5 rounded-full"
                                                    style={{ background: 'var(--accent-primary)' }}
                                                />
                                            )}
                                        </Link>
                                    );
                                })}
                            </div>

                            {/* User Menu */}
                            <div className="flex items-center gap-4">
                                {loading ? (
                                    <div className="w-8 h-8 rounded-full bg-zinc-800 animate-pulse" />
                                ) : user ? (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <button
                                                className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all shadow-lg border hover:scale-105 group"
                                                style={{ background: 'var(--surface-s2)', borderColor: 'var(--surface-edge)' }}
                                            >
                                                <div className="relative">
                                                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                                        style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                                                        {user.email?.[0].toUpperCase()}
                                                    </div>
                                                    <div className="absolute -inset-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                        style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', filter: 'blur(4px)', zIndex: -1 }} />
                                                </div>
                                                <span className="text-xs font-bold text-zinc-200 hidden sm:block max-w-[150px] truncate">
                                                    {user.user_metadata?.full_name || user.email?.split('@')[0]}
                                                </span>
                                            </button>
                                        </DropdownMenuTrigger>

                                        <DropdownMenuContent
                                            align="end"
                                            className="w-56 shadow-2xl p-2 rounded-2xl"
                                            style={{ background: 'var(--surface-2)', border: '1px solid rgba(255,255,255,0.08)' }}
                                        >
                                            <DropdownMenuLabel className="px-2 py-2">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Authenticated as</span>
                                                <span className="text-white text-sm font-bold block truncate">{user.email}</span>
                                            </DropdownMenuLabel>

                                            <DropdownMenuSeparator className="my-1" style={{ backgroundColor: 'var(--surface-edge)' }} />

                                            <DropdownMenuItem
                                                onClick={() => router.push('/dashboard')}
                                                className="text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer focus:bg-white/5 rounded-xl px-3 py-2 text-xs font-bold"
                                            >
                                                <BarChart className="mr-2 h-4 w-4" />
                                                My Progress Dashboard
                                            </DropdownMenuItem>

                                            <DropdownMenuItem
                                                onClick={() => router.push('/dashboard/interview-history')}
                                                className="text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer focus:bg-white/5 rounded-xl px-3 py-2 text-xs font-bold"
                                            >
                                                <Flag className="mr-2 h-4 w-4" />
                                                My Assessments
                                            </DropdownMenuItem>

                                            {accountType === 'employer' && (
                                                <DropdownMenuItem
                                                    onClick={() => router.push('/employer/dashboard')}
                                                    className="text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer focus:bg-white/5 rounded-xl px-3 py-2 text-xs font-bold"
                                                >
                                                    <Briefcase className="mr-2 h-4 w-4" />
                                                    Employer Dashboard
                                                </DropdownMenuItem>
                                            )}

                                            <DropdownMenuItem
                                                onClick={() => router.push('/settings')}
                                                className="text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer focus:bg-white/5 rounded-xl px-3 py-2 text-xs font-bold"
                                            >
                                                <Settings className="mr-2 h-4 w-4" />
                                                Settings
                                            </DropdownMenuItem>

                                            {accountType === 'candidate' && (
                                                <DropdownMenuItem
                                                    onClick={() => router.push('/employer')}
                                                    className="text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 cursor-pointer focus:bg-emerald-500/10 rounded-xl px-3 py-2 text-xs font-bold"
                                                >
                                                    <Briefcase className="mr-2 h-4 w-4" />
                                                    Employer Invite?
                                                </DropdownMenuItem>
                                            )}

                                            {/* Admin button - only visible to admins */}
                                            {isAdmin && (
                                                <DropdownMenuItem
                                                    onClick={() => router.push('/admin/models')}
                                                    className="text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 cursor-pointer focus:bg-amber-500/10 rounded-xl px-3 py-2 text-xs font-bold flex items-center justify-between"
                                                >
                                                    <div className="flex items-center">
                                                        <Shield className="mr-2 h-4 w-4" />
                                                        Admin Tools
                                                    </div>
                                                    {hasDeprecatedModels && (
                                                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse ml-2" />
                                                    )}
                                                </DropdownMenuItem>
                                            )}

                                            <DropdownMenuSeparator className="my-1" style={{ backgroundColor: 'var(--surface-edge)' }} />

                                            <DropdownMenuItem
                                                onClick={handleLogout}
                                                className="text-red-400 hover:bg-red-500/10 hover:text-red-300 cursor-pointer focus:bg-red-500/10 rounded-xl px-3 py-2 text-xs font-bold"
                                            >
                                                <LogOut className="mr-2 h-4 w-4" />
                                                Sign Out
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                ) : (
                                    <Button
                                        onClick={() => router.push('/login')}
                                        className="rounded-xl font-bold h-9 px-5 border transition-all hover:scale-105"
                                        style={{ background: 'var(--accent-primary)', color: 'white', borderColor: 'var(--accent-glowHi)' }}
                                    >
                                        Sign In
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Auth not configured warning */}
                    {!isConfigured && (
                        <div className="bg-yellow-500/10 border-t border-yellow-500/20 py-1 px-4 text-center overflow-x-auto">
                            <p className="text-[10px] font-black uppercase text-yellow-500 whitespace-nowrap">
                                ⚠️ Guest Mode Active (Local Storage)
                            </p>
                        </div>
                    )}
                </nav>
            </header>

            {/* MOBILE BOTTOM NAV — always show for non-interview pages */}
            {!['/interview', '/assess'].some(route => pathname.startsWith(route)) && (
                <nav className="fixed bottom-0 left-0 right-0 z-[100] md:hidden"
                    style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                    <div className="glass border-t border-white/5 px-2 py-1">
                        <div className="flex items-center justify-around">
                            {(user
                                ? (accountType === 'employer'
                                    ? [
                                        { href: '/', label: 'Home', icon: Home },
                                        { href: '/employer/dashboard', label: 'Campaigns', icon: Briefcase },
                                        { href: '/settings', label: 'Settings', icon: Settings }
                                    ]
                                    : [
                                        { href: '/', label: 'Home', icon: Home },
                                        { href: '/practice', label: 'Practice', icon: BookOpen },
                                        { href: '/dashboard', label: 'Progress', icon: BarChart },
                                        { href: '/settings', label: 'Settings', icon: Settings },
                                    ])
                                : [
                                    { href: '/', label: 'Home', icon: Home },
                                    { href: '/practice', label: 'Practice', icon: BookOpen },
                                ]
                            ).map((item) => {
                                const Icon = item.icon;
                                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                                return (
                                    <Link key={item.href} href={item.href}
                                        className="flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-all relative"
                                    >
                                        <motion.div whileTap={{ scale: 0.85 }}>
                                            <Icon className={`w-5 h-5 transition-colors ${isActive ? 'text-indigo-400' : 'text-zinc-500'}`} />
                                        </motion.div>
                                        <span className={`text-[10px] font-semibold transition-colors ${isActive ? 'text-indigo-400' : 'text-zinc-600'}`}>
                                            {item.label}
                                        </span>
                                        {isActive && (
                                            <motion.div layoutId="mobile-nav-active"
                                                className="absolute top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-400"
                                            />
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                </nav>
            )}

            {/* Spacer to push content down - dynamic height based on demo mode */}
            <div className={cn(
                "w-full transition-all duration-300",
                isDemo ? "h-[104px]" : "h-16"
            )} />
        </>
    );
}
