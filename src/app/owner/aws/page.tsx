import { createServerSupabase } from '@/lib/supabase/server';
import { AWSConfigPanel } from './AWSConfigPanel';
import { AWSUsagePanel } from './AWSUsagePanel';

export default async function AWSPage() {
    const supabase = await createServerSupabase();
    
    // Auth & role check
    const { data: { user } } = await supabase.auth.getUser();
    const roleRes = await getUserRole(supabase);
    const role = roleRes.role;
    
    const isPrimaryOwner = role === 'owner'; // Only owner, not co-owner

    // Fetch config for AWS
    const { data: configData } = await supabase
        .from('system_config')
        .select('key, value')
        .in('key', ['AWS_REGION', 'AWS_BEDROCK_REGION', 'AWS_S3_BUCKET', 'AWS_BUDGET_LIMIT']);

    const config = (configData || []).reduce((acc: any, c: any) => ({
        ...acc,
        [c.key]: c.value
    }), {});

    const budgetLimit = parseFloat(config['AWS_BUDGET_LIMIT'] || '100');

    return (
        <div className="p-6 lg:p-10 max-w-[1400px] mx-auto space-y-6">
            <h1 className="text-3xl font-black text-white">AWS Configuration & Usage</h1>
            <p className="text-zinc-400">Monitor budget and manage your AWS integration settings.</p>

            <AWSConfigPanel isPrimaryOwner={isPrimaryOwner} config={config} />
            <AWSUsagePanel budgetLimit={budgetLimit} />
        </div>
    );
}
