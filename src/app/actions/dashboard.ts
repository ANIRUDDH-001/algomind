/**
 * @codesage
 * @file      src/app/actions/dashboard.ts
 * @purpose   Server action to fetch user dashboard averages
 * @tech      Next.js Server Actions, Supabase
 * @connects  @/lib/supabase/server, @/lib/cache/dashboardCache
 * @apis      None
 * @db        get_user_sessions_with_assessment (RPC)
 * @state     None
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1
 */
'use server';

import { createServerSupabase } from '@/lib/supabase/server';
import { getCachedDashboardAverages, setCachedDashboardAverages, DashboardAverages } from '@/lib/cache/dashboardCache';
import { SKILL_DEFINITIONS } from '@/lib/assessment/skill-registry';
import { err, ok, type Result } from '@/lib/api/result';

export async function getDashboardAveragesAction(userId: string): Promise<Result<DashboardAverages | null>> {
    if (!userId) return err('Missing userId', 'missing_user_id');

    try {
        const averages = await getCachedDashboardAverages(userId);
        if (averages) {
            return ok(averages);
        }

        const supabase = await createServerSupabase();
        const { data, error } = await supabase.rpc('get_user_sessions_with_assessment', {
            p_user_id: userId,
            p_limit: 20
        });

        if (error || !data || data.length === 0) return ok(null);

        const calculatedAverages: Record<string, number> = {};
        const counts: Record<string, number> = {};

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data.forEach((row: any) => {
            Object.keys(SKILL_DEFINITIONS).forEach((skill) => {
                const dbKey = skill.replace(/-/g, '_');
                if (row[dbKey] != null && !isNaN(parseFloat(row[dbKey]))) {
                    calculatedAverages[skill] = (calculatedAverages[skill] || 0) + Number(row[dbKey]);
                    counts[skill] = (counts[skill] || 0) + 1;
                }
            });
        });

        Object.keys(calculatedAverages).forEach((skill) => {
            if (counts[skill] > 0) {
                calculatedAverages[skill] /= counts[skill];
            }
        });

        await setCachedDashboardAverages(userId, calculatedAverages);

        return ok(calculatedAverages);
    } catch (error) {
        console.error('Failed to load all-time session averages', error);
        return err('Failed to load averages', 'dashboard_load_failed');
    }
}
