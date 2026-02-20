import { logSystemEvent } from '@/lib/monitoring/events';
import { getRedis } from '@/lib/upstash/client';
import { createClient } from '@supabase/supabase-js';

export interface LeetCodeSubmission {
    title: string;
    titleSlug: string;
    timestamp: string;
    statusDisplay: string;
    lang: string;
}

export interface LeetCodeProfile {
    username: string;
    totalSolved: number;
    easySolved: number;
    mediumSolved: number;
    hardSolved: number;
    ranking: number | null;
    contestRating: number | null;
    recentSubmissions: LeetCodeSubmission[];
    fetchedAt: string;
}

const LEETCODE_GRAPHQL_URL = 'https://leetcode.com/graphql';

const LEETCODE_PROFILE_QUERY = `
query getUserProfile($username: String!) {
  matchedUser(username: $username) {
    profile { ranking }
    submitStats {
      acSubmissionNum { difficulty count }
    }
    userContestRanking { rating }
  }
  recentAcSubmissionList(username: $username, limit: 20) {
    title titleSlug timestamp statusDisplay lang
  }
}
`;

export async function fetchLeetCodeProfile(username: string): Promise<LeetCodeProfile | null> {
    try {
        const response = await fetch(LEETCODE_GRAPHQL_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Referer': 'https://leetcode.com'
            },
            body: JSON.stringify({
                query: LEETCODE_PROFILE_QUERY,
                variables: { username }
            }),
            signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
            return null;
        }

        const json = await response.json();

        // LeetCode API returns errors array if user not found, or matchedUser is null
        if (json.errors || !json.data?.matchedUser) {
            return null; // Expected if username doesn't exist, don't log as system error
        }

        const { matchedUser, recentAcSubmissionList } = json.data;

        let totalSolved = 0;
        let easySolved = 0;
        let mediumSolved = 0;
        let hardSolved = 0;

        const acSubmissionNum = matchedUser.submitStats?.acSubmissionNum || [];
        for (const stat of acSubmissionNum) {
            if (stat.difficulty === 'All') totalSolved = stat.count;
            if (stat.difficulty === 'Easy') easySolved = stat.count;
            if (stat.difficulty === 'Medium') mediumSolved = stat.count;
            if (stat.difficulty === 'Hard') hardSolved = stat.count;
        }

        return {
            username,
            totalSolved,
            easySolved,
            mediumSolved,
            hardSolved,
            ranking: matchedUser.profile?.ranking || null,
            contestRating: matchedUser.userContestRanking?.rating || null,
            recentSubmissions: recentAcSubmissionList || [],
            fetchedAt: new Date().toISOString()
        };
    } catch (error) {
        // Only log actual network/fetch failures
        const errorMessage = error instanceof Error ? error.message : String(error);
        await logSystemEvent({
            type: 'leetcode_fetch_failed',
            errorMessage: errorMessage,
            metadata: { username }
        });
        return null;
    }
}

export async function saveLeetCodeProfile(userId: string, profile: LeetCodeProfile): Promise<void> {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Supabase admin credentials not configured');
        }

        const supabase = createClient(supabaseUrl, supabaseKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        const { error } = await supabase
            .from('leetcode_profiles')
            .upsert({
                user_id: userId,
                username: profile.username,
                total_solved: profile.totalSolved,
                easy_solved: profile.easySolved,
                medium_solved: profile.mediumSolved,
                hard_solved: profile.hardSolved,
                ranking: profile.ranking,
                contest_rating: profile.contestRating,
                recent_submissions: profile.recentSubmissions,
                fetched_at: profile.fetchedAt,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });

        if (error) {
            throw error;
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await logSystemEvent({
            type: 'db_error',
            errorMessage: errorMessage,
            metadata: { context: 'save_leetcode_profile', userId }
        });
    }
}

export async function fetchAndSaveLeetCodeProfile(
    userId: string,
    username: string
): Promise<{ success: boolean; profile: LeetCodeProfile | null; error?: string }> {
    const lockKey = `lc_fetch_lock:${userId}`;
    const redis = getRedis();

    try {
        if (redis) {
            const isLocked = await redis.get(lockKey);
            if (isLocked) {
                return { success: false, profile: null, error: 'fetch_in_progress' };
            }
            // Set lock with 300s (5 min) TTL
            await redis.set(lockKey, 'locked', { ex: 300 });
        }

        const profile = await fetchLeetCodeProfile(username);

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (supabaseUrl && supabaseKey) {
            const supabase = createClient(supabaseUrl, supabaseKey, {
                auth: { autoRefreshToken: false, persistSession: false }
            });

            if (!profile && username) {
                // User provided a username but it wasn't found on LeetCode
                await supabase
                    .from('user_preferences')
                    .update({ leetcode_fetch_status: 'not_found' })
                    .eq('user_id', userId);
            } else if (profile) {
                await saveLeetCodeProfile(userId, profile);
                await supabase
                    .from('user_preferences')
                    .update({
                        leetcode_fetch_status: 'success',
                        leetcode_username: username
                    })
                    .eq('user_id', userId);
            }
        }

        return { success: !!profile, profile };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (supabaseUrl && supabaseKey) {
            const supabase = createClient(supabaseUrl, supabaseKey, {
                auth: { autoRefreshToken: false, persistSession: false }
            });
            await supabase
                .from('user_preferences')
                .update({
                    leetcode_fetch_status: 'failed',
                    leetcode_fetch_error: errorMessage
                })
                .eq('user_id', userId);
        }

        return { success: false, profile: null, error: errorMessage };
    } finally {
        if (redis) {
            await redis.del(lockKey);
        }
    }
}
