'use client';

import { useState, useTransition } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Cloud, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { updateSystemConfig } from '@/app/actions/owner-mutations';

interface AWSConfigProps {
    isPrimaryOwner: boolean;
    config: Record<string, string>;
}

export function AWSConfigPanel({ isPrimaryOwner, config }: AWSConfigProps) {
    const [values, setValues] = useState({
        AWS_REGION: config['AWS_REGION'] || 'ap-south-1',
        AWS_BEDROCK_REGION: config['AWS_BEDROCK_REGION'] || 'us-east-1',
        AWS_S3_BUCKET: config['AWS_S3_BUCKET'] || 'algomind-transcripts-prod',
        AWS_BUDGET_LIMIT: config['AWS_BUDGET_LIMIT'] || '100'
    });
    const [isPending, startTransition] = useTransition();

    const handleSave = () => {
        startTransition(async () => {
            try {
                for (const [k, v] of Object.entries(values)) {
                    await updateSystemConfig(k, v);
                }
                toast.success('AWS settings updated');
            } catch (err: any) {
                toast.error(err.message || 'Update failed');
            }
        });
    };

    if (!isPrimaryOwner) {
        return (
            <Card className="p-5 bg-[var(--surface-1)] border-[var(--surface-edge)]">
                <h3 className="font-bold text-zinc-300 mb-3 flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-zinc-500" />
                    AWS Configuration Status
                </h3>
                <p className="text-zinc-500 text-sm">You do not have permission to view or edit AWS configuration. Only the primary owner can do this.</p>
            </Card>
        );
    }

    return (
        <Card className="p-5 bg-[var(--surface-1)] border-[var(--surface-edge)] relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-amber-500/10 text-amber-500 text-[10px] font-bold px-2 py-1 rounded-bl-lg uppercase tracking-wider">
                Primary Owner Only
            </div>
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-zinc-300 flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-zinc-500" />
                    AWS Configuration Details
                </h3>
                <Button onClick={handleSave} disabled={isPending} size="sm" className="bg-amber-600 hover:bg-amber-700 text-white font-semibold h-8">
                    {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                    Save Config
                </Button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                    <label className="block text-xs text-zinc-500 mb-1">Region</label>
                    <Input 
                        value={values.AWS_REGION} 
                        onChange={e => setValues(prev => ({ ...prev, AWS_REGION: e.target.value }))}
                        className="h-8 bg-black/50 border-white/10 text-sm"
                    />
                </div>
                <div>
                    <label className="block text-xs text-zinc-500 mb-1">Bedrock Region</label>
                    <Input 
                        value={values.AWS_BEDROCK_REGION} 
                        onChange={e => setValues(prev => ({ ...prev, AWS_BEDROCK_REGION: e.target.value }))}
                        className="h-8 bg-black/50 border-white/10 text-sm"
                    />
                </div>
                <div>
                    <label className="block text-xs text-zinc-500 mb-1">S3 Bucket</label>
                    <Input 
                        value={values.AWS_S3_BUCKET} 
                        onChange={e => setValues(prev => ({ ...prev, AWS_S3_BUCKET: e.target.value }))}
                        className="h-8 bg-black/50 border-white/10 text-sm"
                    />
                </div>
                <div>
                    <label className="block text-xs text-zinc-500 mb-1">Budget Limit ($)</label>
                    <Input 
                        type="number"
                        value={values.AWS_BUDGET_LIMIT} 
                        onChange={e => setValues(prev => ({ ...prev, AWS_BUDGET_LIMIT: e.target.value }))}
                        className="h-8 bg-black/50 border-white/10 text-sm"
                    />
                </div>
            </div>
        </Card>
    );
}
