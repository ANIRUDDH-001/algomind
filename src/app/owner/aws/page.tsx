import { createServerSupabase } from '@/lib/supabase/server';
import { AWSConfigPanel } from './AWSConfigPanel';
import { AWSUsagePanel } from './AWSUsagePanel';
import { redirect } from 'next/navigation';
import { isPrimaryOwner } from '@/lib/auth/account-type';

export default async function AWSPage() {
    const supabase = await createServerSupabase();
    
    // Auth & role check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        redirect('/login');
    }
    
    const primaryOwner = await isPrimaryOwner(user.id);

    // Fetch config from .env
    const config = {
        AWS_REGION: process.env.AWS_REGION || 'Not set',
        AWS_BEDROCK_REGION: process.env.AWS_BEDROCK_REGION || 'Not set',
        AWS_S3_BUCKET: process.env.AWS_S3_BUCKET || 'Not set',
        AWS_BUDGET_LIMIT: process.env.AWS_BUDGET_LIMIT || '100'
    };

    const budgetLimit = parseFloat(config['AWS_BUDGET_LIMIT'] || '100');

    return (
        <div className="p-6 lg:p-10 max-w-[1400px] mx-auto space-y-6">
            <h1 className="text-3xl font-black text-white">AWS Configuration & Usage</h1>
            <p className="text-zinc-400">Monitor budget and manage your AWS integration settings.</p>

            <AWSConfigPanel isPrimaryOwner={primaryOwner} config={config} />
            <AWSUsagePanel budgetLimit={budgetLimit} />
        </div>
    );
}
