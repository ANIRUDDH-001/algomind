// @ts-nocheck
// 
'use client';

import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Cloud, Lock } from 'lucide-react';

interface AWSConfigProps {
    isPrimaryOwner: boolean;
    config: Record<string, string>;
}

export function AWSConfigPanel({ isPrimaryOwner, config }: AWSConfigProps) {
    if (!isPrimaryOwner) {
        return (
            <Card className="p-5 bg-[var(--surface-1)] border-[var(--surface-edge)]">
                <h3 className="font-bold text-zinc-300 mb-3 flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-zinc-500" />
                    AWS Configuration Status
                </h3>
                <p className="text-zinc-500 text-sm">You do not have permission to view AWS configuration. Only the primary owner can do this.</p>
            </Card>
        );
    }

    return (
        <Card className="p-5 bg-[var(--surface-1)] border-[var(--surface-edge)] relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-indigo-500/10 text-indigo-400 text-[10px] font-bold px-2 py-1 rounded-bl-lg uppercase tracking-wider flex items-center gap-1">
                <Lock className="w-3 h-3" /> Read Only
            </div>
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-zinc-300 flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-zinc-500" />
                    AWS Configuration Details
                </h3>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                    <label className="block text-xs text-zinc-500 mb-1">Region</label>
                    <Input 
                        value={config.AWS_REGION} 
                        readOnly
                        className="h-8 bg-black/30 border-white/5 text-sm text-zinc-400 focus-visible:ring-0 cursor-not-allowed"
                    />
                </div>
                <div>
                    <label className="block text-xs text-zinc-500 mb-1">Bedrock Region</label>
                    <Input 
                        value={config.AWS_BEDROCK_REGION} 
                        readOnly
                        className="h-8 bg-black/30 border-white/5 text-sm text-zinc-400 focus-visible:ring-0 cursor-not-allowed"
                    />
                </div>
                <div>
                    <label className="block text-xs text-zinc-500 mb-1">S3 Bucket</label>
                    <Input 
                        value={config.AWS_S3_BUCKET} 
                        readOnly
                        className="h-8 bg-black/30 border-white/5 text-sm text-zinc-400 focus-visible:ring-0 cursor-not-allowed"
                    />
                </div>
                <div>
                    <label className="block text-xs text-zinc-500 mb-1">Budget Limit ($)</label>
                    <Input 
                        type="number"
                        value={config.AWS_BUDGET_LIMIT} 
                        readOnly
                        className="h-8 bg-black/30 border-white/5 text-sm text-zinc-400 focus-visible:ring-0 cursor-not-allowed"
                    />
                </div>
            </div>
            <p className="text-xs text-zinc-500 mt-4">
                Values are securely loaded from the system environment variables and cannot be modified via the dashboard.
            </p>
        </Card>
    );
}
