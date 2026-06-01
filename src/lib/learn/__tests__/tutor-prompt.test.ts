/**
 * @codesage
 * @file      src/lib/learn/__tests__/tutor-prompt.test.ts
 * @purpose   Tests for System and tutor prompts for AI learning assistant.
 * @tech      Node.js
 * @connects  Imports app logic, configuration, and external library utilities
 * @apis      None directly visible
 * @db        None
 * @state     Stateless
 * @env       None
 * @issues    No major issues observed.
 * @audit     CODESAGE-v1 | @skip: test-file
 */
import { describe, it, expect } from 'vitest';
import { buildKaiTutorSystemPrompt, buildTutorMemoryUpdatePrompt, buildTutorOpeningMessage } from '../tutor-prompt';
import type { ConceptTag } from '@/types/knowledge-graph';

const mockConceptTag: ConceptTag = {
  id: 'arrays-strings',
  display_name: 'Arrays & Strings',
  description: 'Traversal, sliding window, two pointers',
  subject: 'dsa',
  icon: 'list',
  sort_order: 1,
  is_active: true,
  prerequisites: [],
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

  it('shows Knowledge Probing phase on turn 1', () => {
    const prompt = buildKaiTutorSystemPrompt({
      conceptTag: mockConceptTag,
      exchangeCount: 1,
    });
    expect(prompt).toContain('Knowledge Probing');
  });

  it('shows Consolidation phase on turn 14', () => {
    const prompt = buildKaiTutorSystemPrompt({
      conceptTag: mockConceptTag,
      exchangeCount: 14,
    });
    expect(prompt).toContain('Consolidation');
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

  it('includes nudge hint when proactive nudge is provided', () => {
    const prompt = buildKaiTutorSystemPrompt({
      conceptTag: mockConceptTag,
      exchangeCount: 3,
      proactiveNudge: 'Ask for complexity explicitly',
    });
    expect(prompt).toContain('<nudge_hint>Ask for complexity explicitly</nudge_hint>');
  });

  it('includes opening hint only on first turn', () => {
    const promptTurn0 = buildKaiTutorSystemPrompt({
      conceptTag: mockConceptTag,
      exchangeCount: 0,
    });
    const promptTurn2 = buildKaiTutorSystemPrompt({
      conceptTag: mockConceptTag,
      exchangeCount: 2,
    });
    expect(promptTurn0).toContain('<opening_hint>');
    expect(promptTurn2).not.toContain('<opening_hint>');
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

describe('buildTutorMemoryUpdatePrompt', () => {
  it('includes current memory fallback text when memory is null', () => {
    const prompt = buildTutorMemoryUpdatePrompt('Arrays', 'hello', null);
    expect(prompt).toContain('No prior memory.');
  });

  it('truncates very long transcripts to 3000 characters', () => {
    const transcript = `${'x'.repeat(2999)}A${'y'.repeat(3000)}TAIL_MARKER`;
    const prompt = buildTutorMemoryUpdatePrompt('Arrays', transcript, 'existing memory');
    const expectedSlice = transcript.slice(0, 3000);
    expect(prompt).toContain(expectedSlice);
    expect(prompt).not.toContain('TAIL_MARKER');
  });
});

describe('buildTutorOpeningMessage', () => {
  const baseStudentContext = {
    userId: 'u1',
    builtAt: new Date().toISOString(),
    hasCompletedDiagnostic: true,
    weakestConcepts: [],
    strongestConcepts: [],
    allConceptSummaries: [],
    nextRecommendedConcept: null,
    performance: {
      totalSessionsCompleted: 0,
      averageScore: null,
      lastSessionScore: null,
      lastSessionAt: null,
      streak: 0,
    },
    kaiMemoryText: null,
    kaiMemoryStructured: null,
    subscription: {
      status: 'free' as const,
      sessionsUsedThisWeek: 0,
      weeklyLimit: 5,
      sessionsRemaining: 5,
    },
    accountType: 'candidate' as const,
  };

  it('returns base opening when no student context', () => {
    const opening = buildTutorOpeningMessage(mockConceptTag);
    expect(opening.toLowerCase()).toContain('arrays and strings');
  });

  it('prefixes growth-area message when concept is weak', () => {
    const opening = buildTutorOpeningMessage(mockConceptTag, {
      ...baseStudentContext,
      weakestConcepts: [{ slug: 'arrays-strings', displayName: 'Arrays', confidence: 0.2, level: 'weak', evidenceCount: 2 }],
    });
    expect(opening).toContain('growth areas');
  });

  it('prefixes strong-foundation message when concept is strong', () => {
    const opening = buildTutorOpeningMessage(mockConceptTag, {
      ...baseStudentContext,
      strongestConcepts: [{ slug: 'arrays-strings', displayName: 'Arrays', confidence: 0.9, level: 'strong', evidenceCount: 5 }],
    });
    expect(opening).toContain('solid foundation');
  });
});

describe('tutor-behavioral-contract', () => {
  it('contains all 9 behavioral rules', async () => {
    const { KAI_TUTOR_BEHAVIORAL_CONTRACT } = await import('../tutor-behavioral-contract');
    for (let i = 1; i <= 9; i += 1) {
      expect(KAI_TUTOR_BEHAVIORAL_CONTRACT).toContain(`${i}.`);
    }
  });
});
