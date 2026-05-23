import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestUser, hasIntegrationEnv, seedConceptTags, testSupabase } from './setup';

const describeIfIntegration = hasIntegrationEnv ? describe : describe.skip;

describeIfIntegration('Knowledge Graph Feedback Loop (Integration)', () => {
  let testUser: Awaited<ReturnType<typeof createTestUser>> | null = null;

  beforeAll(async () => {
    await seedConceptTags();
  });

  afterEach(async () => {
    await testUser?.cleanup();
    testUser = null;
  });

  describe('initialize_concept_states()', () => {
    it('creates concept_state rows for all provided slugs', async () => {
      testUser = await createTestUser('kg-init');

      const { error } = await testSupabase.rpc('initialize_concept_states', {
        p_user_id: testUser.userId,
        p_results: JSON.stringify([
          { concept_slug: 'arrays-strings', confidence: 0.7 },
          { concept_slug: 'dynamic-programming', confidence: 0.3 },
        ]),
      });

      expect(error).toBeNull();

      const { data: states, error: stateError } = await testSupabase
        .from('concept_states')
        .select('*')
        .eq('user_id', testUser.userId)
        .order('concept_slug');

      expect(stateError).toBeNull();
      expect(states).toHaveLength(2);
      expect(states?.find((s) => s.concept_slug === 'arrays-strings')?.confidence).toBeCloseTo(0.7, 2);
      expect(states?.find((s) => s.concept_slug === 'dynamic-programming')?.confidence).toBeCloseTo(0.3, 2);
    });

    it('creates learning_signals audit rows', async () => {
      testUser = await createTestUser('kg-signals');

      await testSupabase.rpc('initialize_concept_states', {
        p_user_id: testUser.userId,
        p_results: JSON.stringify([{ concept_slug: 'arrays-strings', confidence: 0.6 }]),
      });

      const { data: signals, error } = await testSupabase
        .from('learning_signals')
        .select('*')
        .eq('user_id', testUser.userId);

      expect(error).toBeNull();
      expect(signals).toHaveLength(1);
      expect(signals?.[0]?.signal_type).toBe('diagnostic_initial');
      expect(signals?.[0]?.concept_slug).toBe('arrays-strings');
    });

    it('is idempotent and updates confidence without duplicating rows', async () => {
      testUser = await createTestUser('kg-idempotent');

      for (const confidence of [0.5, 0.7]) {
        await testSupabase.rpc('initialize_concept_states', {
          p_user_id: testUser.userId,
          p_results: JSON.stringify([{ concept_slug: 'arrays-strings', confidence }]),
        });
      }

      const { data: states, error } = await testSupabase
        .from('concept_states')
        .select('*')
        .eq('user_id', testUser.userId)
        .eq('concept_slug', 'arrays-strings');

      expect(error).toBeNull();
      expect(states).toHaveLength(1);
      expect(states?.[0]?.confidence).toBeCloseTo(0.7, 2);
      expect(states?.[0]?.evidence_count).toBe(2);
    });
  });

  describe('Interview Session Trigger', () => {
    it('updates concept_states when interview_session status changes to completed', async () => {
      testUser = await createTestUser('kg-trigger');

      await testSupabase.rpc('initialize_concept_states', {
        p_user_id: testUser.userId,
        p_results: JSON.stringify([{ concept_slug: 'arrays-strings', confidence: 0.5 }]),
      });

      let { data: problem } = await testSupabase
        .from('problems')
        .select('id')
        .contains('tags', ['arrays-strings'])
        .limit(1)
        .single();

      if (!problem) {
        const { data: newProblem } = await testSupabase
          .from('problems')
          .insert({
            title: 'Test Arrays Strings Problem',
            description: 'Test problem',
            difficulty: 'easy',
            tags: ['arrays-strings'],
            created_at: new Date().toISOString()
          })
          .select('id')
          .single();
        problem = newProblem;
      }


      const { data: session, error: insertError } = await testSupabase
        .from('interview_sessions')
        .insert({
          user_id: testUser.userId,
          problem_id: problem!.id,
          status: 'in_progress',
          difficulty_mode: 'practice',
        })
        .select('id')
        .single();

      expect(insertError).toBeNull();

      await testSupabase
        .from('interview_sessions')
        .update({ status: 'completed', overall_score: 8.0 })
        .eq('id', session!.id);

      await new Promise((resolve) => setTimeout(resolve, 250));

      const { data: state, error: stateError } = await testSupabase
        .from('concept_states')
        .select('*')
        .eq('user_id', testUser.userId)
        .eq('concept_slug', 'arrays-strings')
        .single();

      expect(stateError).toBeNull();
      expect(Number(state?.confidence ?? 0)).toBeGreaterThan(0.5);
      expect(state?.last_session_type).toBe('interview');
    });

    it('increments user_weekly_usage on interview completion', async () => {
      testUser = await createTestUser('kg-weekly');

      let { data: problem } = await testSupabase
        .from('problems')
        .select('id')
        .contains('tags', ['arrays-strings'])
        .limit(1)
        .single();

      if (!problem) {
        const { data: newProblem } = await testSupabase
          .from('problems')
          .insert({
            title: 'Test Arrays Strings Problem 2',
            description: 'Test problem 2',
            difficulty: 'easy',
            tags: ['arrays-strings'],
            created_at: new Date().toISOString()
          })
          .select('id')
          .single();
        problem = newProblem;
      }


      const { data: session } = await testSupabase
        .from('interview_sessions')
        .insert({
          user_id: testUser.userId,
          problem_id: problem!.id,
          status: 'in_progress',
          difficulty_mode: 'practice',
        })
        .select('id')
        .single();

      await testSupabase
        .from('interview_sessions')
        .update({ status: 'completed', overall_score: 7.0 })
        .eq('id', session!.id);

      await new Promise((resolve) => setTimeout(resolve, 250));

      const { data: usageRows, error } = await testSupabase
        .from('user_weekly_usage')
        .select('*')
        .eq('user_id', testUser.userId)
        .order('week_start', { ascending: false })
        .limit(1);

      expect(error).toBeNull();
      expect((usageRows?.length ?? 0) > 0).toBe(true);
      expect((usageRows?.[0]?.interview_sessions_used ?? 0) >= 1).toBe(true);
    });
  });
});
