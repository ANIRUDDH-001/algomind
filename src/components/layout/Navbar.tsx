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
import { LogOut, Settings, BarChart, Home, Mic, Brain } from 'lucide-react';
import Link from 'next/link';

export function Navbar() {
    const { user, signOut, loading, isConfigured } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

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
        <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <button
                        onClick={() => router.push('/')}
                        className="flex items-center gap-2 font-bold text-xl text-white hover:text-blue-400 transition-colors"
                    >
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                            <Brain className="w-5 h-5 text-white" />
                        </div>
                        AlgoMind
                    </button>

                    {/* Navigation Links */}
                    {user && (
                        <div className="hidden md:flex items-center gap-6">
                            <Link
                                href="/"
                                className={`flex items-center gap-2 transition-colors ${pathname === '/' ? 'text-white' : 'text-slate-300 hover:text-white'
                                    }`}
                            >
                                <Home className="w-4 h-4" />
                                Home
                            </Link>
                            <Link
                                href="/dashboard"
                                className={`flex items-center gap-2 transition-colors ${pathname === '/dashboard' ? 'text-white' : 'text-slate-300 hover:text-white'
                                    }`}
                            >
                                <BarChart className="w-4 h-4" />
                                Dashboard
                            </Link>
                            <Link
                                href="/interview"
                                className={`flex items-center gap-2 transition-colors ${pathname === '/interview' ? 'text-white' : 'text-slate-300 hover:text-white'
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
                                    <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                                            {user.email?.[0].toUpperCase()}
                                        </div>
                                        <span className="text-sm font-medium text-white hidden sm:block max-w-[150px] truncate">
                                            {user.user_metadata?.full_name || user.email?.split('@')[0]}
                                        </span>
                                    </button>
                                </DropdownMenuTrigger>

                                {/* LIGHT THEME DROPDOWN - READABLE TEXT */}
                                <DropdownMenuContent
                                    align="end"
                                    className="w-56 bg-white border-slate-200"
                                >
                                    <DropdownMenuLabel className="text-slate-900 font-semibold">
                                        My Account
                                    </DropdownMenuLabel>
                                    <div className="px-2 py-1.5 text-sm text-slate-600">
                                        {user.email}
                                    </div>
                                    <DropdownMenuSeparator className="bg-slate-200" />

                                    <DropdownMenuItem
                                        onClick={() => router.push('/dashboard')}
                                        className="text-slate-700 hover:bg-slate-100 cursor-pointer focus:bg-slate-100 focus:text-slate-900"
                                    >
                                        <BarChart className="mr-2 h-4 w-4" />
                                        Dashboard
                                    </DropdownMenuItem>

                                    <DropdownMenuItem
                                        onClick={() => router.push('/settings')}
                                        className="text-slate-700 hover:bg-slate-100 cursor-pointer focus:bg-slate-100 focus:text-slate-900"
                                    >
                                        <Settings className="mr-2 h-4 w-4" />
                                        Settings
                                    </DropdownMenuItem>

                                    <DropdownMenuSeparator className="bg-slate-200" />

                                    <DropdownMenuItem
                                        onClick={handleLogout}
                                        className="text-red-600 hover:bg-red-50 cursor-pointer focus:bg-red-50 focus:text-red-700"
                                    >
                                        <LogOut className="mr-2 h-4 w-4" />
                                        Logout
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ) : (
                            <Button
                                onClick={() => router.push('/login')}
                                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                            >
                                Sign In
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Auth not configured warning */}
            {!isConfigured && (
                <div className="bg-yellow-500/10 border-t border-yellow-500/20 py-1 px-4 text-center">
                    <p className="text-xs text-yellow-500">
                        ⚠️ Running in guest mode - data stored locally
                    </p>
                </div>
            )}
        </nav>
    );
}
