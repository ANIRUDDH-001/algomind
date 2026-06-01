'use client';

/**
 * @codesage
 * @file      src/components/layout/Navbar.tsx
 * @purpose   Provides the main top navigation bar and mobile bottom navigation for the application, handling user authentication state and role-based routing.
 * @tech      Next.js, React, Framer Motion, Lucide React, Tailwind CSS
 * @connects  Imports AuthProvider, useAdmin, useKeyboardShortcuts and UI components. Used by root layouts.
 * @apis      GET /api/user/account-type, GET /api/user/owner-status, GET /api/admin/events
 * @db        None
 * @state     useAuth context
 * @env       NEXT_PUBLIC_ENABLE_EMPLOYER_TIER
 * @issues    Empty catch block in fetchAccountType. console.error in checkModels.
 * @audit     CODESAGE-v1
 */

import { useAuth } from '@/components/auth/AuthProvider';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, Settings, BarChart, Home, Shield, History, Briefcase, BookOpen, Crown, Brain, LogIn } from 'lucide-react';
import Link from 'next/link';

import { useEffect, useState } from 'react';
import { useAdmin } from '@/hooks/useAdmin';
import { motion } from 'framer-motion';
import { useLearnKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

export function Navbar() {
    const { user, signOut, loading, isConfigured } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const { isAdmin } = useAdmin();
    const [hasDeprecatedModels, setHasDeprecatedModels] = useState(false);
    const [accountType, setAccountType] = useState<'candidate' | 'employer' | 'admin' | 'owner'>('candidate');
    const [isOwner, setIsOwner] = useState(false);

    useLearnKeyboardShortcuts();

    useEffect(() => {
        if (!user) return;
        const fetchAccountType = async () => {
            try {
                const res = await fetch('/api/user/account-type');
                if (res.ok) {
                    const data = await res.json();
                    setAccountType(data.accountType);
                    if (data.accountType === 'owner') {
                        setIsOwner(true);
                    }
                }

                // Check co-owner status (account_type won't be 'owner' for co-owners)
                const ownerRes = await fetch('/api/user/owner-status').catch(() => null);
                if (ownerRes && ownerRes.ok) {
                    const ownerData = await ownerRes.json();
                    if (ownerData.isOwner) setIsOwner(true);
                }
            } catch { }
        };
        fetchAccountType();
    }, [user]);

    useEffect(() => {
        const checkModels = async () => {
            if (!isAdmin) return;
            // Pause polling when tab is hidden
            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
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
            // Poll every 60 seconds (was 5 minutes but with pathname dependency causing re-mounts)
            const interval = setInterval(checkModels, 60 * 1000);
            return () => clearInterval(interval);
        }
    }, [isAdmin]);

    const handleLogout = async () => {
        await signOut();
        router.push('/');
    };

    // Hide navbar on certain pages
    const hideNavbarRoutes = ['/login'];
    if (hideNavbarRoutes.includes(pathname)) {
        return null;
    }

    const hideBottomNav =
        ['/interview', '/assess', '/learn/', '/replay/'].some(route => pathname.startsWith(route)) ||
        pathname === '/learn/diagnostic';

    return (
        <>
            <header className="fixed top-0 left-0 right-0 z-[100] flex flex-col" style={{ '--navbar-h': '64px' } as React.CSSProperties}>

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
                                aria-label="Go to AlgoMind homepage"
                                className="flex items-center gap-3 font-bold text-xl text-white hover:text-indigo-400 transition-colors group shrink-0"
                            >
                                <Image
                                    src="/icon-192x192.png"
                                    alt="AlgoMind Logo"
                                    width={32}
                                    height={32}
                                    className="w-8 h-8 group-hover:scale-110 transition-transform drop-shadow-[0_0_8px_rgba(99,102,241,0.5)] rounded-lg"
                                />
                                <span className="tracking-tight font-black bg-clip-text text-transparent bg-gradient-to-r from-zinc-100 to-zinc-500">AlgoMind</span>
                            </button>

                            {/* Navigation Links — Home for everyone, Dashboard+History for auth */}
                            <div className="hidden md:flex items-center gap-6">
                                {[
                                    { href: '/', label: 'Home', authOnly: false },
                                    ...(user ? [
                                        { href: '/practice', label: 'Practice', authOnly: true },
                                        { href: '/dashboard', label: 'Dashboard', authOnly: true },
                                        { href: '/learn', label: 'Learn', authOnly: true, isNew: true },
                                        ...(accountType === 'employer' && process.env.NEXT_PUBLIC_ENABLE_EMPLOYER_TIER === 'true'
                                            ? [{ href: '/employer/dashboard', label: 'Employer', authOnly: true }]
                                            : [{ href: '/dashboard/interview-history', label: 'History', authOnly: true }]),
                                    ] : []),
                                ].map((link) => {
                                    const isActive = link.href === '/'
                                        ? pathname === '/'
                                        : pathname === link.href || pathname.startsWith(link.href + '/');
                                    return (
                                        <Link
                                            key={link.href}
                                            href={link.href}
                                            data-testid={link.label === 'Learn' ? 'nav-learn' : link.label === 'Settings' ? 'nav-settings' : undefined}
                                            className={`relative py-2 text-sm font-bold transition-colors ${isActive ? 'text-indigo-400' : 'text-zinc-400 hover:text-zinc-100'}`}
                                        >
                                            <span className="inline-flex items-center gap-2">
                                                {link.label}
                                                {'isNew' in link && link.isNew && (
                                                    <span className="text-[10px] font-bold text-indigo-300 bg-indigo-950/60 border border-indigo-500/25 px-1.5 py-0.5 rounded-full leading-none">
                                                        New
                                                    </span>
                                                )}
                                            </span>
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
                                                aria-label={`Open account menu for ${user.email ?? 'user'}`}
                                                className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all shadow-lg border hover:scale-105 group"
                                                style={{ background: 'var(--surface-2)', borderColor: 'var(--surface-edge)' }}
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
                                                <History className="mr-2 h-4 w-4" />
                                                My History
                                            </DropdownMenuItem>

                                            {accountType === 'employer' && process.env.NEXT_PUBLIC_ENABLE_EMPLOYER_TIER === 'true' && (
                                                <DropdownMenuItem
                                                    onClick={() => router.push('/employer/dashboard')}
                                                    className="text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer focus:bg-white/5 rounded-xl px-3 py-2 text-xs font-bold"
                                                >
                                                    <Briefcase className="mr-2 h-4 w-4" />
                                                    Employer Dashboard
                                                </DropdownMenuItem>
                                            )}

                                            <DropdownMenuItem
                                                data-testid="nav-settings"
                                                onClick={() => router.push('/settings')}
                                                className="text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer focus:bg-white/5 rounded-xl px-3 py-2 text-xs font-bold"
                                            >
                                                <Settings className="mr-2 h-4 w-4" />
                                                Settings
                                            </DropdownMenuItem>

                                            {accountType === 'candidate' && process.env.NEXT_PUBLIC_ENABLE_EMPLOYER_TIER === 'true' && (
                                                <DropdownMenuItem
                                                    onClick={() => router.push('/employer')}
                                                    className="text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 cursor-pointer focus:bg-emerald-500/10 rounded-xl px-3 py-2 text-xs font-bold"
                                                >
                                                    <Briefcase className="mr-2 h-4 w-4" />
                                                    Employer Invite?
                                                </DropdownMenuItem>
                                            )}

                                            {/* Owner button - only visible to owners and co-owners */}
                                            {isOwner && (
                                                <DropdownMenuItem
                                                    onClick={() => router.push('/owner')}
                                                    className="text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 cursor-pointer focus:bg-amber-500/10 rounded-xl px-3 py-2 text-xs font-bold flex items-center justify-between"
                                                >
                                                    <div className="flex items-center">
                                                        <Crown className="mr-2 h-4 w-4" />
                                                        Owner Dashboard
                                                    </div>
                                                </DropdownMenuItem>
                                            )}

                                            {/* Admin button - only visible to admins or owners */}
                                            {(isAdmin || isOwner) && (
                                                <DropdownMenuItem
                                                    onClick={() => router.push('/admin')}
                                                    className="text-indigo-400 hover:bg-indigo-500/10 hover:text-indigo-300 cursor-pointer focus:bg-indigo-500/10 rounded-xl px-3 py-2 text-xs font-bold flex items-center justify-between"
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
                                                data-testid="sign-out-button"
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

            {/* MOBILE BOTTOM NAV — show on browse pages only */}
            {!hideBottomNav && (
                <nav className="fixed bottom-0 left-0 right-0 z-[100] md:hidden"
                    style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                    <div className="glass border-t border-white/5 px-2 py-1">
                        <div className="flex items-center justify-around">
                            {(user
                                ? (accountType === 'employer' && process.env.NEXT_PUBLIC_ENABLE_EMPLOYER_TIER === 'true'
                                    ? [
                                        { href: '/', label: 'Home', icon: Home },
                                        { href: '/dashboard', label: 'Progress', icon: BarChart },
                                        { href: '/employer/dashboard', label: 'Employer', icon: Briefcase },
                                        { href: '/settings', label: 'Settings', icon: Settings }
                                    ]
                                    : [
                                        { href: '/', label: 'Home', icon: Home },
                                        { href: '/practice', label: 'Practice', icon: BookOpen },
                                        { href: '/learn', label: 'Learn', icon: Brain },
                                        { href: '/dashboard', label: 'Progress', icon: BarChart },
                                        { href: '/settings', label: 'Settings', icon: Settings },
                                    ])
                                : [
                                    { href: '/', label: 'Home', icon: Home },
                                    { href: '/login', label: 'Sign In', icon: LogIn },
                                ]
                            ).map((item) => {
                                const Icon = item.icon;
                                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                                return (
                                    <Link key={item.href} href={item.href}
                                        aria-label={item.label}
                                        aria-current={isActive ? 'page' : undefined}
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

        </>
    );
}
