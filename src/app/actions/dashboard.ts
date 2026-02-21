'use server';

import { createServerSupabase } from '@/lib/supabase/server';
import { getCachedDashboardAverages, setCachedDashboardAverages, DashboardAverages } from '@/lib/cache/dashboardCache';
import { SKILL_DEFINITIONS } from '@/lib/assessment/skill-registry';

export async function getDashboardAveragesAction(userId: string): Promise<DashboardAverages | null> {
    if (!userId) return null;

    try {
        let averages = await getCachedDashboardAverages(userId);
        if (averages) {
            return averages;
        }

        const supabase = await createServerSupabase();
        const { data, error } = await supabase.rpc('get_user_sessions_with_assessment', {
            p_user_id: userId,
            p_limit: 20
        });

        if (error || !data || data.length === 0) return null;

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

        return calculatedAverages;
    } catch (err) {
        console.error('Failed to load all-time session averages', err);
        return null;
    }
}
