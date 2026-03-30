/**
 * Integration test setup utilities.
 * Creates isolated test users and cleans up after each test.
 */
import { createClient } from '@supabase/supabase-js';
import { Redis } from '@upstash/redis';

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

const TEST_SUPABASE_URL = readEnv('SUPABASE_TEST_URL');
const TEST_SUPABASE_KEY = readEnv('SUPABASE_TEST_SERVICE_KEY');
const TEST_REDIS_URL = readEnv('REDIS_TEST_URL');
const TEST_REDIS_TOKEN = readEnv('REDIS_TEST_TOKEN');

export const hasIntegrationEnv = Boolean(
  TEST_SUPABASE_URL
  && TEST_SUPABASE_KEY
  && TEST_REDIS_URL
  && TEST_REDIS_TOKEN,
);

if (hasIntegrationEnv) {
  process.env.SUPABASE_DIRECT_URL = TEST_SUPABASE_URL!;
  process.env.NEXT_PUBLIC_SUPABASE_URL = TEST_SUPABASE_URL!;
  process.env.SUPABASE_SERVICE_ROLE_KEY = TEST_SUPABASE_KEY!;
  process.env.UPSTASH_REDIS_REST_URL = TEST_REDIS_URL!;
  process.env.UPSTASH_REDIS_REST_TOKEN = TEST_REDIS_TOKEN!;
}

export const testSupabase = createClient(TEST_SUPABASE_URL ?? 'http://localhost:54321', TEST_SUPABASE_KEY ?? 'test-key', {
  auth: { autoRefreshToken: false, persistSession: false },
});

export const testRedis = new Redis({
  url: TEST_REDIS_URL ?? 'https://localhost',
  token: TEST_REDIS_TOKEN ?? 'test-token',
});

export function getCurrentWeekStart(date = new Date()): string {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay();
  const offset = day === 0 ? 6 : day - 1;
  utc.setUTCDate(utc.getUTCDate() - offset);
  return utc.toISOString().split('T')[0] ?? '';
}

export async function createTestUser(suffix: string): Promise<{
  userId: string;
  email: string;
  cleanup: () => Promise<void>;
}> {
  const email = `test-${suffix}-${Date.now()}@algomind-test.com`;
  const password = 'TestPassword123!';

  const { data: authData, error } = await testSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !authData.user) {
    throw new Error(`Failed to create test user: ${error?.message ?? 'unknown'}`);
  }

  const userId = authData.user.id;

  await testSupabase.from('profiles').upsert({
    id: userId,
    email,
    account_type: 'candidate',
    subscription_status: 'free',
  });

  return {
    userId,
    email,
    cleanup: async () => {
      await testSupabase.from('learning_signals').delete().eq('user_id', userId);
      await testSupabase.from('concept_states').delete().eq('user_id', userId);
      await testSupabase.from('learn_sessions').delete().eq('user_id', userId);
      await testSupabase.from('user_weekly_usage').delete().eq('user_id', userId);
      await testSupabase.from('learner_profiles').delete().eq('user_id', userId);
      await testSupabase.from('interview_sessions').delete().eq('user_id', userId);
      await testSupabase.from('profiles').delete().eq('id', userId);
      await testSupabase.auth.admin.deleteUser(userId);

      await testRedis.del(`kg:concepts:${userId}`);
      await testRedis.del(`student_context:${userId}`);
    },
  };
}

export async function seedConceptTags(): Promise<void> {
  const { count } = await testSupabase
    .from('concept_tags')
    .select('id', { count: 'exact', head: true });

  if ((count ?? 0) >= 20) {
    return;
  }

  const tags = [
    { id: 'arrays-strings', display_name: 'Arrays & Strings', subject: 'dsa', sort_order: 1, is_active: true },
    { id: 'hashing-maps-sets', display_name: 'Hashing (Maps/Sets)', subject: 'dsa', sort_order: 2, is_active: true },
    { id: 'two-pointers-sliding-window', display_name: 'Two Pointers / Sliding Window', subject: 'dsa', sort_order: 3, is_active: true },
    { id: 'stacks-queues', display_name: 'Stacks & Queues', subject: 'dsa', sort_order: 4, is_active: true },
    { id: 'linked-lists', display_name: 'Linked Lists', subject: 'dsa', sort_order: 5, is_active: true },
    { id: 'binary-search', display_name: 'Binary Search', subject: 'dsa', sort_order: 6, is_active: true },
    { id: 'sorting', display_name: 'Sorting', subject: 'dsa', sort_order: 7, is_active: true },
    { id: 'graphs-bfs-dfs', display_name: 'Graphs (BFS/DFS)', subject: 'dsa', sort_order: 8, is_active: true },
    { id: 'dynamic-programming', display_name: 'Dynamic Programming', subject: 'dsa', sort_order: 9, is_active: true },
    { id: 'greedy', display_name: 'Greedy', subject: 'dsa', sort_order: 10, is_active: true },
    { id: 'recursion-backtracking', display_name: 'Recursion & Backtracking', subject: 'dsa', sort_order: 11, is_active: true },
    { id: 'trees-bst', display_name: 'Trees / BST', subject: 'dsa', sort_order: 12, is_active: true },
    { id: 'heaps-priority-queue', display_name: 'Heaps / Priority Queue', subject: 'dsa', sort_order: 13, is_active: true },
    { id: 'tries', display_name: 'Tries', subject: 'dsa', sort_order: 14, is_active: true },
    { id: 'union-find', display_name: 'Union Find', subject: 'dsa', sort_order: 15, is_active: true },
    { id: 'bit-manipulation', display_name: 'Bit Manipulation', subject: 'dsa', sort_order: 16, is_active: true },
    { id: 'math-number-theory', display_name: 'Math / Number Theory', subject: 'dsa', sort_order: 17, is_active: true },
    { id: 'intervals', display_name: 'Intervals', subject: 'dsa', sort_order: 18, is_active: true },
    { id: 'prefix-sum', display_name: 'Prefix Sum', subject: 'dsa', sort_order: 19, is_active: true },
    { id: 'design-data-structures', display_name: 'Design / Data Structures', subject: 'dsa', sort_order: 20, is_active: true },
  ];

  await testSupabase.from('concept_tags').upsert(tags, { onConflict: 'id' });
}
