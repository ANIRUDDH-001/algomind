import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { checkWeeklySessionLimit } from '@/lib/rate-limit/weekly-session-limiter';
import {
  createTestUser,
  getCurrentWeekStart,
  hasIntegrationEnv,
  testSupabase,
} from './setup';

const describeIfIntegration = hasIntegrationEnv ? describe : describe.skip;

function getPreviousWeekStart(): string {
  const today = new Date();
  const lastWeek = new Date(today);
  lastWeek.setUTCDate(today.getUTCDate() - 7);
  return getCurrentWeekStart(lastWeek);
}

describeIfIntegration('Freemium Gate (Integration)', () => {
  let testUser: Awaited<ReturnType<typeof createTestUser>> | null = null;
  let originalGatingValue: string | null = null;

  beforeAll(async () => {
    const { data } = await testSupabase
      .from('system_config')
      .select('value')
      .eq('key', 'enable_session_gating')
      .maybeSingle();

    originalGatingValue = data?.value ?? null;
  });

  afterEach(async () => {
    if (originalGatingValue !== null) {
      await testSupabase
        .from('system_config')
        .upsert({ key: 'enable_session_gating', value: originalGatingValue }, { onConflict: 'key' });
    }

    await testUser?.cleanup();
    testUser = null;
  });

  it('allows first 5 sessions for free user when only 4 used', async () => {
    testUser = await createTestUser('gate-allow-5');

    await testSupabase.from('user_weekly_usage').upsert({
      user_id: testUser.userId,
      week_start: getCurrentWeekStart(),
      interview_sessions_used: 0,
      learn_sessions_used: 4,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,week_start' });

    const result = await checkWeeklySessionLimit(testUser.userId);

    expect(result.allowed).toBe(true);
    expect(result.sessionsUsed).toBe(4);
  });

  it('blocks the 6th session for free user', async () => {
    testUser = await createTestUser('gate-block-6');

    await testSupabase.from('user_weekly_usage').upsert({
      user_id: testUser.userId,
      week_start: getCurrentWeekStart(),
      interview_sessions_used: 0,
      learn_sessions_used: 5,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,week_start' });

    const result = await checkWeeklySessionLimit(testUser.userId);

    expect(result.allowed).toBe(false);
    expect(result.sessionsUsed).toBe(5);
    expect(result.limit).toBe(5);
  });

  it('resets session count on new week boundary', async () => {
    testUser = await createTestUser('gate-week-reset');

    await testSupabase.from('user_weekly_usage').upsert({
      user_id: testUser.userId,
      week_start: getPreviousWeekStart(),
      interview_sessions_used: 0,
      learn_sessions_used: 5,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,week_start' });

    const result = await checkWeeklySessionLimit(testUser.userId);

    expect(result.allowed).toBe(true);
    expect(result.sessionsUsed).toBe(0);
  });

  it('bypasses gate for premium user with high usage', async () => {
    testUser = await createTestUser('gate-premium');

    await testSupabase
      .from('profiles')
      .update({ subscription_status: 'premium' })
      .eq('id', testUser.userId);

    await testSupabase.from('user_weekly_usage').upsert({
      user_id: testUser.userId,
      week_start: getCurrentWeekStart(),
      interview_sessions_used: 10,
      learn_sessions_used: 10,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,week_start' });

    const result = await checkWeeklySessionLimit(testUser.userId);

    expect(result.allowed).toBe(true);
    expect(result.sessionsUsed).toBe(0);
  });

  it('bypasses gate when enable_session_gating is false', async () => {
    testUser = await createTestUser('gate-disabled');

    await testSupabase
      .from('system_config')
      .upsert({ key: 'enable_session_gating', value: 'false' }, { onConflict: 'key' });

    await testSupabase.from('user_weekly_usage').upsert({
      user_id: testUser.userId,
      week_start: getCurrentWeekStart(),
      interview_sessions_used: 0,
      learn_sessions_used: 999,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,week_start' });

    const result = await checkWeeklySessionLimit(testUser.userId);

    expect(result.gatingEnabled).toBe(false);
    expect(result.allowed).toBe(true);
  });
});
