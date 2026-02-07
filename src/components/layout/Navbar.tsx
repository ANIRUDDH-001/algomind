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
import { LogOut, Settings, BarChart, Home, Mic, Shield } from 'lucide-react';
import Link from 'next/link';
import { DemoBanner } from '@/components/demo/DemoBanner';
import { isDemoMode } from '@/lib/demo/manager';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { useAdmin } from '@/hooks/useAdmin';

export function Navbar() {
    const { user, signOut, loading, isConfigured } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [isDemo, setIsDemo] = useState(false);
    const { isAdmin } = useAdmin();

    useEffect(() => {
        setIsDemo(isDemoMode());
    }, [pathname]); // Re-check on navigation

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
            <header className="fixed top-0 left-0 right-0 z-[100] flex flex-col">
                <DemoBanner />
                <nav className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 h-16 shadow-2xl">
                    <div className="w-full px-6 lg:px-8">
                        <div className="flex items-center justify-between h-16">
                            {/* Logo */}
                            {/* Logo */}
                            <button
                                onClick={() => router.push('/')}
                                className="flex items-center gap-3 font-bold text-xl text-white hover:text-blue-400 transition-colors group shrink-0"
                            >
                                <img
                                    src="/icon-192x192.png"
                                    alt="AlgoMind Logo"
                                    className="w-8 h-8 group-hover:scale-110 transition-transform drop-shadow-[0_0_8px_rgba(59,130,246,0.5)] rounded-lg"
                                />
                                <span className="tracking-tight font-black bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">AlgoMind</span>
                            </button>

                            {/* Navigation Links */}
                            {user && (
                                <div className="hidden md:flex items-center gap-6">
                                    <Link
                                        href="/"
                                        className={`flex items-center gap-2 text-sm font-bold transition-colors ${pathname === '/' ? 'text-blue-400' : 'text-slate-400 hover:text-white'
                                            }`}
                                    >
                                        <Home className="w-4 h-4" />
                                        Home
                                    </Link>
                                    <Link
                                        href="/dashboard"
                                        className={`flex items-center gap-2 text-sm font-bold transition-colors ${pathname === '/dashboard' ? 'text-blue-400' : 'text-slate-400 hover:text-white'
                                            }`}
                                    >
                                        <BarChart className="w-4 h-4" />
                                        Dashboard
                                    </Link>
                                    <Link
                                        href="/interview"
                                        className={`flex items-center gap-2 text-sm font-bold transition-colors ${pathname === '/interview' ? 'text-blue-400' : 'text-slate-400 hover:text-white'
                                            }`}
                                    >
                                        <Mic className="w-4 h-4" />
                                        Practice
                                    </Link>
                                </div>
                            )}

                            {/* User Menu */}
                            <div className="flex items-center gap-4">
                                {loading ? (
                                    <div className="w-8 h-8 rounded-full bg-slate-800 animate-pulse" />
                                ) : user ? (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/50 hover:bg-slate-700 transition-all border border-slate-700 hover:border-slate-500 shadow-lg">
                                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-black text-xs">
                                                    {user.email?.[0].toUpperCase()}
                                                </div>
                                                <span className="text-xs font-bold text-slate-200 hidden sm:block max-w-[150px] truncate">
                                                    {user.user_metadata?.full_name || user.email?.split('@')[0]}
                                                </span>
                                            </button>
                                        </DropdownMenuTrigger>

                                        <DropdownMenuContent
                                            align="end"
                                            className="w-56 bg-slate-900 border-slate-800 shadow-2xl p-2 rounded-2xl"
                                        >
                                            <DropdownMenuLabel className="px-2 py-2">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Authenticated as</span>
                                                <span className="text-white text-sm font-bold block truncate">{user.email}</span>
                                            </DropdownMenuLabel>

                                            <DropdownMenuSeparator className="bg-slate-800 my-1" />

                                            <DropdownMenuItem
                                                onClick={() => router.push('/dashboard')}
                                                className="text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer focus:bg-slate-800 rounded-xl px-3 py-2 text-xs font-bold"
                                            >
                                                <BarChart className="mr-2 h-4 w-4" />
                                                Dashboard
                                            </DropdownMenuItem>

                                            <DropdownMenuItem
                                                onClick={() => router.push('/settings')}
                                                className="text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer focus:bg-slate-800 rounded-xl px-3 py-2 text-xs font-bold"
                                            >
                                                <Settings className="mr-2 h-4 w-4" />
                                                Settings
                                            </DropdownMenuItem>

                                            {/* Admin button - only visible to admins */}
                                            {isAdmin && (
                                                <DropdownMenuItem
                                                    onClick={() => router.push('/admin/knowledge')}
                                                    className="text-emerald-400 hover:bg-emerald-900/30 hover:text-emerald-300 cursor-pointer focus:bg-emerald-800 rounded-xl px-3 py-2 text-xs font-bold"
                                                >
                                                    <Shield className="mr-2 h-4 w-4" />
                                                    Admin Dashboard
                                                </DropdownMenuItem>
                                            )}

                                            <DropdownMenuSeparator className="bg-slate-800 my-1" />

                                            <DropdownMenuItem
                                                onClick={handleLogout}
                                                className="text-red-400 hover:bg-red-500 hover:text-white cursor-pointer focus:bg-red-800 rounded-xl px-3 py-2 text-xs font-bold"
                                            >
                                                <LogOut className="mr-2 h-4 w-4" />
                                                Sign Out
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                ) : (
                                    <Button
                                        onClick={() => router.push('/login')}
                                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-xl font-bold h-9 px-5"
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
            {/* Spacer to push content down - dynamic height based on demo mode */}
            <div className={cn(
                "w-full transition-all duration-300",
                isDemo ? "h-[104px]" : "h-16"
            )} />
        </>
    );
}
