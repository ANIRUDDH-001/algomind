import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { getKnowledgeGraphService } from '@/lib/knowledge-graph';
import { incrementWeeklyUsage } from '@/lib/rate-limit/weekly-session-limiter';
import {
  createTestUser,
  getCurrentWeekStart,
  hasIntegrationEnv,
  seedConceptTags,
  testRedis,
  testSupabase,
} from './setup';

const describeIfIntegration = hasIntegrationEnv ? describe : describe.skip;

describeIfIntegration('Learn Session Lifecycle (Integration)', () => {
  let testUser: Awaited<ReturnType<typeof createTestUser>> | null = null;

  beforeAll(async () => {
    await seedConceptTags();
  });

  afterEach(async () => {
    await testUser?.cleanup();
    testUser = null;
  });

  it('creates learn_session row when session starts', async () => {
    testUser = await createTestUser('learn-start');

    const { data: session, error } = await testSupabase
      .from('learn_sessions')
      .insert({
        user_id: testUser.userId,
        concept_slug: 'arrays-strings',
        status: 'active',
        session_type: 'concept',
        transcript: [],
        exchange_count: 0,
      })
      .select('*')
      .single();

    expect(error).toBeNull();
    expect(session?.status).toBe('active');
    expect(session?.concept_slug).toBe('arrays-strings');
  });

  it('updates transcript in learn_session on each turn', async () => {
    testUser = await createTestUser('learn-turns');

    const { data: session } = await testSupabase
      .from('learn_sessions')
      .insert({
        user_id: testUser.userId,
        concept_slug: 'arrays-strings',
        status: 'active',
        session_type: 'concept',
        transcript: [],
        exchange_count: 0,
      })
      .select('id')
      .single();

    const turn1 = [
      { role: 'assistant', content: 'Let us begin with arrays.', at: new Date().toISOString() },
      { role: 'user', content: 'Okay!', at: new Date().toISOString() },
    ];

    await testSupabase
      .from('learn_sessions')
      .update({ transcript: turn1, exchange_count: 1 })
      .eq('id', session!.id);

    const turn2 = [
      ...turn1,
      { role: 'assistant', content: 'How do you find pair sums?', at: new Date().toISOString() },
      { role: 'user', content: 'Use hash map.', at: new Date().toISOString() },
    ];

    await testSupabase
      .from('learn_sessions')
      .update({ transcript: turn2, exchange_count: 2 })
      .eq('id', session!.id);

    const { data: updated } = await testSupabase
      .from('learn_sessions')
      .select('transcript,exchange_count')
      .eq('id', session!.id)
      .single();

    const transcript = Array.isArray(updated?.transcript) ? updated.transcript : [];
    expect(transcript).toHaveLength(4);
    expect(updated?.exchange_count).toBe(2);
  });

  it('completes session, updates concept_states and learning_signals, and increments weekly usage', async () => {
    testUser = await createTestUser('learn-end');

    await testSupabase.rpc('initialize_concept_states', {
      p_user_id: testUser.userId,
      p_results: JSON.stringify([{ concept_slug: 'arrays-strings', confidence: 0.4 }]),
    });

    const { data: session } = await testSupabase
      .from('learn_sessions')
      .insert({
        user_id: testUser.userId,
        concept_slug: 'arrays-strings',
        status: 'active',
        session_type: 'concept',
        transcript: [
          { role: 'assistant', content: 'Opening prompt', at: new Date().toISOString() },
          { role: 'user', content: 'I understand two pointers now', at: new Date().toISOString() },
        ],
        exchange_count: 1,
      })
      .select('id')
      .single();

    await testSupabase
      .from('learn_sessions')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', session!.id);

    await getKnowledgeGraphService().onLearnSessionCompleted(session!.id, {
      understood: ['arrays-strings'],
      struggled: [],
      notes: 'Strong grasp of two pointers',
      confidenceDelta: 0.08,
    });

    await incrementWeeklyUsage(testUser.userId, 'learn');

    const [{ data: state }, { data: signals }, { data: usage }] = await Promise.all([
      testSupabase
        .from('concept_states')
        .select('*')
        .eq('user_id', testUser.userId)
        .eq('concept_slug', 'arrays-strings')
        .single(),
      testSupabase
        .from('learning_signals')
        .select('*')
        .eq('user_id', testUser.userId)
        .eq('session_id', session!.id),
      testSupabase
        .from('user_weekly_usage')
        .select('*')
        .eq('user_id', testUser.userId)
        .eq('week_start', getCurrentWeekStart())
        .single(),
    ]);

    expect(state?.last_session_type).toBe('learn');
    expect(Number(state?.confidence ?? 0)).toBeGreaterThan(0.4);
    expect((signals?.length ?? 0) >= 1).toBe(true);
    expect((usage?.learn_sessions_used ?? 0) >= 1).toBe(true);
  });

  it('invalidates Redis student_context cache when learn session completes', async () => {
    testUser = await createTestUser('learn-cache');

    const key = `student_context:${testUser.userId}`;
    await testRedis.set(key, { stale: true }, { ex: 60 });

    const { data: session } = await testSupabase
      .from('learn_sessions')
      .insert({
        user_id: testUser.userId,
        concept_slug: 'arrays-strings',
        status: 'completed',
        session_type: 'concept',
        transcript: [],
        exchange_count: 0,
      })
      .select('id')
      .single();

    await getKnowledgeGraphService().onLearnSessionCompleted(session!.id, {
      understood: ['arrays-strings'],
      struggled: [],
      notes: 'cache invalidation verification',
      confidenceDelta: 0.02,
    });

    const value = await testRedis.get(key);
    expect(value).toBeNull();
  });
});
