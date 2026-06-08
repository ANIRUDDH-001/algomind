// @ts-nocheck
// 
import { createServiceRoleSupabase } from '@/lib/supabase/server';
import { FlagsTab } from './FlagsClient';

export const revalidate = 0;

export default async function FlagsPage() {
    const adminSupabase = await createServiceRoleSupabase();
    const { data: initialFlags } = await adminSupabase
        .from('global_feature_flags')
        .select('*')
        .order('key');

    return <FlagsTab initialFlags={initialFlags || []} />;
}
