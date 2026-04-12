'use client';

import { useAuth } from './AuthProvider';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, Settings, LayoutDashboard } from 'lucide-react';
import Link from 'next/link';

export function UserButton() {
    const { user, signOut, isAuthenticated } = useAuth();

    if (!isAuthenticated) {
        return (
            <Link href="/login">
                <Button variant="outline" size="sm" className="border-white/10 text-zinc-300 hover:bg-[var(--surface-2)]">
                    Sign In
                </Button>
            </Link>
        );
    }

    const initials = user?.user_metadata?.full_name
        ?.split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || user?.email?.[0].toUpperCase() || 'U';

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar className="h-10 w-10 border-2 border-white/10">
                        <AvatarImage
                            src={user?.user_metadata?.avatar_url}
                            alt={user?.user_metadata?.full_name || 'User'}
                        />
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-bold">
                            {initials}
                        </AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 bg-[var(--surface-1)] border-white/8" align="end">
                <DropdownMenuLabel className="text-zinc-300">
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium text-white">
                            {user?.user_metadata?.full_name || 'User'}
                        </p>
                        <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-[var(--surface-2)]" />
                <DropdownMenuItem asChild className="text-zinc-300 focus:bg-[var(--surface-2)] focus:text-white cursor-pointer">
                    <Link href="/dashboard" className="flex items-center">
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        Dashboard
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="text-zinc-300 focus:bg-[var(--surface-2)] focus:text-white cursor-pointer">
                    <Link href="/settings" className="flex items-center">
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-[var(--surface-2)]" />
                <DropdownMenuItem
                    onClick={() => signOut()}
                    className="text-red-400 focus:bg-red-500/10 focus:text-red-400 cursor-pointer"
                >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
