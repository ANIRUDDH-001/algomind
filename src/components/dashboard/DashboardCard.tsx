'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface DashboardCardProps {
    title: string;
    subtitle?: string;
    action?: {
        label: string;
        onClick: () => void;
    };
    children: React.ReactNode;
    className?: string;
    isLoading?: boolean;
    delay?: number;
}

export function DashboardCard({
    title,
    subtitle,
    action,
    children,
    className,
    isLoading = false,
    delay = 0,
}: DashboardCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay }}
            className="h-full"
        >
            <Card className={cn("bg-slate-900/30 backdrop-blur-md border-slate-800/50 shadow-xl flex flex-col h-full", className)}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="space-y-1">
                        <CardTitle className="text-lg font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                            {title}
                        </CardTitle>
                        {subtitle && <p className="text-xs text-slate-500 font-medium tracking-wide uppercase">{subtitle}</p>}
                    </div>
                    {action && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={action.onClick}
                            className="text-xs font-bold text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                        >
                            {action.label}
                        </Button>
                    )}
                </CardHeader>
                <CardContent className="flex-1 relative min-h-[100px]">
                    {isLoading ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Loader2 className="w-8 h-8 text-blue-500 animate-spin opacity-50" />
                        </div>
                    ) : (
                        children
                    )}
                </CardContent>
            </Card>
        </motion.div>
    );
}
