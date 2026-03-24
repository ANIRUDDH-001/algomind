import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  buildStudentContext,
  buildStudentContextPromptBlock,
  invalidateStudentContext,
} from '@/lib/kai-context';
import {
  createTestUser,
  getCurrentWeekStart,
  hasIntegrationEnv,
  seedConceptTags,
  testRedis,
  testSupabase,
} from './setup';

const describeIfIntegration = hasIntegrationEnv ? describe : describe.skip;

describeIfIntegration('Student Context Assembly (Integration)', () => {
  let testUser: Awaited<ReturnType<typeof createTestUser>> | null = null;

  beforeAll(async () => {
    await seedConceptTags();
  });

  afterEach(async () => {
    await testUser?.cleanup();
    testUser = null;
  });

  it('assembles context with concept snapshots, usage, and recommendation', async () => {
    testUser = await createTestUser('ctx-assemble');

    await testSupabase.rpc('initialize_concept_states', {
      p_user_id: testUser.userId,
      p_results: JSON.stringify([
        { concept_slug: 'arrays-strings', confidence: 0.35 },
        { concept_slug: 'dynamic-programming', confidence: 0.75 },
      ]),
    });

    await testSupabase.from('user_weekly_usage').upsert({
      user_id: testUser.userId,
      week_start: getCurrentWeekStart(),
      interview_sessions_used: 1,
      learn_sessions_used: 2,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,week_start' });

    const context = await buildStudentContext(testUser.userId);

    expect(context.userId).toBe(testUser.userId);
    expect(context.hasCompletedDiagnostic).toBe(true);
    expect(context.allConceptSummaries.length).toBeGreaterThan(0);
    expect(context.weakestConcepts.some((c) => c.slug === 'arrays-strings')).toBe(true);
    expect(context.strongestConcepts.some((c) => c.slug === 'dynamic-programming')).toBe(true);
    expect(context.subscription.sessionsUsedThisWeek).toBe(3);

    const promptBlock = buildStudentContextPromptBlock(context);
    expect(promptBlock).toContain('<student_context>');
    expect(promptBlock).toContain('<weak_concepts>');
    expect(promptBlock).toContain('<subscription>');
  });

  it('stores assembled context in Redis and invalidates on request', async () => {
    testUser = await createTestUser('ctx-cache');

    const cacheKey = `student_context:${testUser.userId}`;

    const context = await buildStudentContext(testUser.userId);
    expect(context.userId).toBe(testUser.userId);

    const cached = await testRedis.get(cacheKey);
    expect(cached).not.toBeNull();

    await invalidateStudentContext(testUser.userId);

    const afterDelete = await testRedis.get(cacheKey);
    expect(afterDelete).toBeNull();
  });
});
