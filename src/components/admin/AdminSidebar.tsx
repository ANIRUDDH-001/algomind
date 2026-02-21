'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
    Flag, Database, ShieldAlert, BarChart,
    MessageSquare, Settings, Activity, ServerCrash
} from 'lucide-react';

const STATIC_NAV_ITEMS = [
    { name: 'Model Health', href: '/admin/models', icon: ServerCrash },
    { name: 'Analytics', href: '/admin/analytics', icon: BarChart },
    { name: 'Feature Flags', href: '/admin/features', icon: Flag },
    { name: 'Cache Stats', href: '/admin/cache-stats', icon: Activity },
    { name: 'Knowledge Base', href: '/admin/knowledge', icon: Database },
    { name: 'Voice Debug', href: '/admin/voice-debug', icon: MessageSquare },
    { name: 'Admin Users', href: '/admin/admins', icon: ShieldAlert },
];

export function AdminSidebar() {
    const pathname = usePathname();
    const [hasDeprecatedModels, setHasDeprecatedModels] = useState(false);

    useEffect(() => {
        const checkModels = async () => {
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

        checkModels();
        // Poll every 5 minutes
        const interval = setInterval(checkModels, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <aside className="w-64 border-r border-slate-800 bg-slate-900/50 backdrop-blur-sm hidden lg:block shrink-0">
            <div className="p-6">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 px-3">
                    Admin Menu
                </h2>
                <nav className="space-y-1">
                    {STATIC_NAV_ITEMS.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`
                                    flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors
                                    ${isActive
                                        ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-sm'
                                        : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent'
                                    }
                                `}
                            >
                                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-500'}`} />
                                {item.name}

                                {/* Notification Dot Logic */}
                                {item.name === 'Model Health' && hasDeprecatedModels && (
                                    <span className="w-2 h-2 rounded-full bg-red-500 ml-auto animate-pulse" />
                                )}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            <div className="absolute bottom-6 left-6 right-6 p-4 rounded-xl border border-slate-800/50 bg-slate-900/50">
                <div className="flex items-center gap-3 text-sm text-slate-400">
                    <Settings className="w-4 h-4" />
                    <span className="font-medium truncate">System settings restricted to codebase</span>
                </div>
            </div>
        </aside>
    );
}
