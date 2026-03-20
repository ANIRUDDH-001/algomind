import { Page } from '@playwright/test';

const TEST_API_SECRET = process.env.TEST_API_SECRET ?? '';

export async function resetUserKnowledgeGraph(page: Page, userId: string) {
  /**
   * Direct API call to test endpoint that clears concept_states,
   * learn_sessions, and user_weekly_usage for a user
   */
  if (!userId) {
    throw new Error('resetUserKnowledgeGraph requires userId');
  }

  const res = await page.request.delete(`/api/test/reset-kg/${userId}`, {
    headers: { 'x-test-secret': TEST_API_SECRET },
  });
  
  if (!res.ok()) {
    const details = await res.text();
    throw new Error(`Failed to reset KG for user ${userId}: ${res.status()} ${details}`);
  }
}

export async function setWeeklyUsage(page: Page, userId: string, used: number) {
  /**
   * Set how many sessions a user has used this week (for freemium gate testing)
   */
  if (!userId) {
    throw new Error('setWeeklyUsage requires userId');
  }

  const res = await page.request.post('/api/test/set-weekly-usage', {
    data: { userId, sessionsUsed: used },
    headers: { 'x-test-secret': TEST_API_SECRET },
  });
  
  if (!res.ok()) {
    const details = await res.text();
    throw new Error(`Failed to set weekly usage: ${res.status()} ${details}`);
  }
}

export async function createTestConceptState(
  page: Page,
  userId: string,
  conceptId: string,
  state: { due?: string; interval?: number; ease?: number; repetitions?: number } = {}
) {
  /**
   * Seed a concept state for a user (e.g., to test returning user state)
   */
  if (!userId) {
    throw new Error('createTestConceptState requires userId');
  }

  const res = await page.request.post('/api/test/seed-concept-state', {
    data: { userId, conceptId, ...state },
    headers: { 'x-test-secret': TEST_API_SECRET },
  });
  
  if (!res.ok()) {
    const details = await res.text();
    throw new Error(`Failed to seed concept state: ${res.status()} ${details}`);
  }
}
