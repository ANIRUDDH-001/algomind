import { createClient } from '@supabase/supabase-js';
import { computeDifficultyTier } from '../../src/lib/recommendations/difficulty-calibrator';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function getClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        throw new Error('Missing Supabase environment variables');
    }
    return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Computes deep stats (streaks, skill averages, difficulty tier, etc.)
 * for all active users based on their completed interview sessions.
 */
export async function computeAllLearnerProfiles() {
    const supabase = getClient();

    // Find users who have completed sessions
    const { data: users, error: userError } = await supabase
        .from('interview_sessions')
        .select('user_id')
        .eq('status', 'completed');

    if (userError) {
        console.error('[compute-learner-profiles] Failed to fetch users', userError);
        return;
    }

    const userIds = [...new Set(users?.map(u => u.user_id) || [])];
    console.log(`[compute-learner-profiles] Computing full profiles for ${userIds.length} users...`);

    // Process in batches of 10
    for (let i = 0; i < userIds.length; i += 10) {
        const batch = userIds.slice(i, i + 10);
        await Promise.allSettled(batch.map(id => computeProfileForUser(supabase, id)));

        if (i + 10 < userIds.length) {
            await sleep(500); // Backoff for DB load
        }
    }
}

/**
 * Lighter weight function that only updates the streak counters.
 * Efficient when cognitive averages don't need recalculation.
 */
export async function updateStreaksOnly() {
    const supabase = getClient();

    const { data: users } = await supabase
        .from('interview_sessions')
        .select('user_id')
        .eq('status', 'completed');

    const userIds = [...new Set(users?.map(u => u.user_id) || [])];

    for (let i = 0; i < userIds.length; i += 10) {
        const batch = userIds.slice(i, i + 10);
        await Promise.allSettled(batch.map(async id => {
            const { data: sessions } = await supabase
                .from('interview_sessions')
                .select('completed_at')
                .eq('user_id', id)
                .eq('status', 'completed');

            if (!sessions || sessions.length === 0) return;

            const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
            const sessionsThisWeek = sessions.filter(s => s.completed_at >= sevenDaysAgo).length;

            const sessionDates = new Set(sessions.map(s => s.completed_at.split('T')[0]));
            const today = new Date().toISOString().split('T')[0];
            const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

            let currentStreak = 0;
            let checkDate = today;
            // A streak is maintained if they practiced yesterday but haven't yet today
            if (!sessionDates.has(today) && sessionDates.has(yesterday)) {
                checkDate = yesterday;
            }

            let tempDate = new Date(checkDate);
            while (sessionDates.has(tempDate.toISOString().split('T')[0])) {
                currentStreak++;
                tempDate.setDate(tempDate.getDate() - 1);
            }

            await supabase.from('learner_profiles').upsert({
                user_id: id,
                sessions_this_week: sessionsThisWeek,
                current_streak: currentStreak,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });
        }));

        if (i + 10 < userIds.length) {
            await sleep(500);
        }
    }
}

// === Subroutines === 

async function computeProfileForUser(supabase: any, userId: string) {
    // 1. Fetch total session count & recent 7-day subset
    const { data: sessions } = await supabase
        .from('interview_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false });

    if (!sessions || sessions.length === 0) return;

    const totalSessions = sessions.length;

    // 2. Fetch sessions from last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const sessionsThisWeek = sessions.filter((s: any) => s.completed_at >= sevenDaysAgo).length;

    // 3. Compute `current_streak` & `longest_streak`
    const sessionDates = new Set(sessions.map((s: any) => s.completed_at.split('T')[0]));

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    let currentStreak = 0;

    let checkDate = today;
    if (!sessionDates.has(today) && sessionDates.has(yesterday)) {
        checkDate = yesterday;
    }

    let tempDate = new Date(checkDate);
    while (sessionDates.has(tempDate.toISOString().split('T')[0])) {
        currentStreak++;
        tempDate.setDate(tempDate.getDate() - 1);
    }

    let longestStreak = 0;
    let currentCount = 0;
    let prevDate: Date | null = null;

    const sortedDates = [...sessionDates].sort();
    for (const dStr of sortedDates) {
        const d = new Date(dStr as string);
        if (!prevDate) {
            currentCount = 1;
        } else {
            const diffDays = Math.floor((d.getTime() - prevDate.getTime()) / 86400000);
            if (diffDays === 1) {
                currentCount++;
            } else if (diffDays > 1) {
                currentCount = 1; // Gap encountered
            }
        }
        longestStreak = Math.max(longestStreak, currentCount);
        prevDate = d;
    }

    // 4. Compute avg_scores globally
    const skills = [
        'problem_decomposition', 'pattern_recognition', 'algorithmic_thinking',
        'complexity_analysis', 'communication_clarity', 'edge_case_awareness',
        'optimization_mindset', 'debugging_approach'
    ];

    const avgScores: Record<string, number> = {};
    for (const skill of skills) {
        let valid = 0;
        let sum = 0;
        for (const s of sessions) {
            if (s[skill] != null) {
                sum += Number(s[skill]);
                valid++;
            }
        }
        avgScores[skill] = valid > 0 ? Number((sum / valid).toFixed(2)) : 0;
    }

    // 5 & 6. Classify top 2 Strengths / Weaknesses
    const sortedSkills = skills.map(id => ({ id, score: avgScores[id] })).sort((a, b) => b.score - a.score);
    const topStrengths = sortedSkills.slice(0, 2).map(s => s.id);
    const topWeaknesses = sortedSkills.slice(-2).reverse().map(s => s.id);

    // 7. Update difficulty_tier 
    const { data: lcData } = await supabase
        .from('leetcode_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

    const lcSignal = lcData ? {
        contest_rating: lcData.contest_rating,
        medium_solved: lcData.medium_solved || 0,
        hard_solved: lcData.hard_solved || 0
    } : null;

    const sessionSummaries = sessions.map((s: any) => ({
        overall_score: Number(s.overall_score || 0),
        problem_difficulty: (s.problem_difficulty || 'medium') as 'easy' | 'medium' | 'hard'
    }));

    const { tier } = computeDifficultyTier(lcSignal, sessionSummaries);

    // Fetch `learner_profiles` row to inherit volatile data (e.g. kai_memory array string)
    const { data: existing } = await supabase
        .from('learner_profiles')
        .select('kai_memory, longest_streak')
        .eq('user_id', userId)
        .maybeSingle();

    // 8. Upsert DB injection
    const payload = {
        user_id: userId,
        total_sessions: totalSessions,
        sessions_this_week: sessionsThisWeek,
        current_streak: currentStreak,
        longest_streak: Math.max(existing?.longest_streak || 0, longestStreak),
        avg_scores: avgScores,
        top_strengths: topStrengths,
        top_weaknesses: topWeaknesses,
        difficulty_tier: tier.tier,
        kai_memory: existing?.kai_memory || null,
        updated_at: new Date().toISOString()
    };

    const { error: upsertError } = await supabase.from('learner_profiles').upsert(payload, { onConflict: 'user_id' });
    if (upsertError) {
        console.error(`[compute-learner-profiles] Failed mapping for user ${userId}`, upsertError.message);
    }
}
