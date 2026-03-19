import { describe, it, expect } from 'vitest';
import { buildKaiTutorSystemPrompt } from '../tutor-prompt';
import type { ConceptTag } from '@/types/knowledge-graph';

const mockConceptTag: ConceptTag = {
  id: 'arrays-strings',
  display_name: 'Arrays & Strings',
  description: 'Traversal, sliding window, two pointers',
  subject: 'dsa',
  icon: 'list',
  sort_order: 1,
  is_active: true,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
};

describe('buildKaiTutorSystemPrompt', () => {
  it('includes concept assignment block', () => {
    const prompt = buildKaiTutorSystemPrompt({
      conceptTag: mockConceptTag,
      exchangeCount: 0,
    });
    expect(prompt).toContain('arrays-strings');
    expect(prompt).toContain('Arrays & Strings');
    expect(prompt).toContain('<concept_assignment>');
  });

  it('includes behavioral contract', () => {
    const prompt = buildKaiTutorSystemPrompt({
      conceptTag: mockConceptTag,
      exchangeCount: 0,
    });
    expect(prompt).toContain('NEVER give direct answers');
    expect(prompt).toContain('ONE QUESTION PER TURN');
  });

  it('shows Opening phase on turn 0', () => {
    const prompt = buildKaiTutorSystemPrompt({
      conceptTag: mockConceptTag,
      exchangeCount: 0,
    });
    expect(prompt).toContain('Opening');
  });

  it('shows Core Teaching phase on turn 5', () => {
    const prompt = buildKaiTutorSystemPrompt({
      conceptTag: mockConceptTag,
      exchangeCount: 5,
    });
    expect(prompt).toContain('Core Teaching');
  });

  it('shows Closing phase on turn 18', () => {
    const prompt = buildKaiTutorSystemPrompt({
      conceptTag: mockConceptTag,
      exchangeCount: 18,
    });
    expect(prompt).toContain('Closing');
  });

  it('includes confidence note when currentConfidence provided', () => {
    const prompt = buildKaiTutorSystemPrompt({
      conceptTag: mockConceptTag,
      exchangeCount: 0,
      currentConfidence: 0.3,
    });
    expect(prompt).toContain('30%');
    expect(prompt).toContain('weak');
  });

  it('includes no-data note when confidence unknown', () => {
    const prompt = buildKaiTutorSystemPrompt({
      conceptTag: mockConceptTag,
      exchangeCount: 0,
      currentConfidence: undefined,
    });
    expect(prompt).toContain('No prior data');
  });

  it('includes student context block when provided', () => {
    const prompt = buildKaiTutorSystemPrompt({
      conceptTag: mockConceptTag,
      exchangeCount: 0,
      studentContext: {
        userId: 'test',
        builtAt: new Date().toISOString(),
        hasCompletedDiagnostic: true,
        weakestConcepts: [{ slug: 'arrays-strings', displayName: 'Arrays', confidence: 0.2, level: 'weak', evidenceCount: 2 }],
        strongestConcepts: [],
        allConceptSummaries: [],
        nextRecommendedConcept: null,
        performance: { totalSessionsCompleted: 5, averageScore: 6.5, lastSessionScore: 7.0, lastSessionAt: null, streak: 3 },
        kaiMemoryText: null,
        kaiMemoryStructured: null,
        subscription: { status: 'free', sessionsUsedThisWeek: 2, weeklyLimit: 5, sessionsRemaining: 3 },
        accountType: 'candidate',
      },
    });
    expect(prompt).toContain('<student_context>');
    expect(prompt).toContain('Arrays');
  });

  it('keeps prompt under 2000 tokens (approx 8000 chars)', () => {
    const prompt = buildKaiTutorSystemPrompt({
      conceptTag: mockConceptTag,
      exchangeCount: 5,
    });
    expect(prompt.length).toBeLessThan(8000);
  });

  it('includes output rules section', () => {
    const prompt = buildKaiTutorSystemPrompt({
      conceptTag: mockConceptTag,
      exchangeCount: 0,
    });
    expect(prompt).toContain('<output_rules>');
    expect(prompt).toContain('No markdown');
    expect(prompt).toContain('100 words');
  });
});

describe('tutor-behavioral-contract', () => {
  it('contains all 10 behavioral rules', async () => {
    const { KAI_TUTOR_BEHAVIORAL_CONTRACT } = await import('../tutor-behavioral-contract');
    for (let i = 1; i <= 10; i += 1) {
      expect(KAI_TUTOR_BEHAVIORAL_CONTRACT).toContain(`${i}.`);
    }
  });
});
