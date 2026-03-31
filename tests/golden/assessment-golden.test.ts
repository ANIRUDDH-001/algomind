import { describe, expect, it } from 'vitest';
import { CognitiveAnalyzer } from '@/lib/assessment/analyzer';
import type { ConversationTurn } from '@/lib/assessment/prompts';
import easyFixture from './fixtures/easy-interview.json';
import shortFixture from './fixtures/short-session.json';

type GoldenAnalyzeInput = {
  transcript: ConversationTurn[];
  difficulty: string;
  problemId: string;
  turnCount: number;
};

function asConversationTurns(
  transcript: Array<{ role: string; content: string }>
): ConversationTurn[] {
  return transcript.map((turn) => ({
    role: turn.role as ConversationTurn['role'],
    content: turn.content,
  }));
}

/**
 * Compatibility wrapper for the requested golden test shape.
 * Uses the workspace's current CognitiveAnalyzer API underneath.
 */
async function analyzeInterview(input: GoldenAnalyzeInput): Promise<{
  scores: Record<string, { score: number; confidence: number }>;
  overallScore: number;
  confidence: number;
}> {
  const analyzer = new CognitiveAnalyzer();
  const result = await analyzer.analyze(
    `golden-${input.problemId}-${Date.now()}`,
    {
      title: input.problemId,
      description: `Golden fixture for ${input.problemId}`,
      difficulty: 'medium',
      difficultyMode: input.difficulty as 'warm-up' | 'practice' | 'crunch' | 'sprint' | 'employer',
    },
    input.transcript
  );

  const confidenceValues = Object.values(result.skills).map((skill) => skill.confidence ?? 0);
  const averageConfidence =
    confidenceValues.length > 0
      ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
      : 0;

  return {
    scores: result.skills,
    overallScore: result.overallScore,
    confidence: averageConfidence,
  };
}

describe('Golden Assessment Suite', () => {
  // Skip in CI/local runs without AI provider keys (these tests hit real models).
  const shouldRun =
    !!process.env.GROQ_API_KEY ||
    !!process.env.GEMINI_API_KEY ||
    !!process.env.GOOGLE_API_KEY ||
    !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  it.skipIf(!shouldRun)('easy interview produces valid assessment structure', async () => {
    const result = await analyzeInterview({
      transcript: asConversationTurns(easyFixture.transcript),
      difficulty: easyFixture.difficulty,
      problemId: 'two-sum',
      turnCount: easyFixture.turns,
    });

    // Structure validation
    expect(result).toHaveProperty('scores');
    expect(result).toHaveProperty('overallScore');
    expect(result).toHaveProperty('confidence');

    // Score bounds
    const { overall_score_range, max_any_skill_score, confidence_range, required_skills } =
      easyFixture.expected;
    expect(result.overallScore).toBeGreaterThanOrEqual(overall_score_range[0]);
    expect(result.overallScore).toBeLessThanOrEqual(overall_score_range[1]);
    expect(result.confidence).toBeGreaterThanOrEqual(confidence_range[0]);
    expect(result.confidence).toBeLessThanOrEqual(confidence_range[1]);

    // All required skills present
    const scoreKeys = Object.keys(result.scores);
    for (const skill of required_skills) {
      expect(scoreKeys).toContain(skill);
    }

    // No individual skill exceeds max
    for (const [, score] of Object.entries(result.scores)) {
      expect((score as { score: number }).score).toBeLessThanOrEqual(max_any_skill_score);
    }
  }, 30000);

  it.skipIf(!shouldRun)('short session enforces score caps', async () => {
    const result = await analyzeInterview({
      transcript: asConversationTurns(shortFixture.transcript),
      difficulty: 'warm-up',
      problemId: 'reverse-string',
      turnCount: 3,
    });

    // Short session cap: max 5 for 2-3 user turns.
    for (const [, score] of Object.entries(result.scores)) {
      expect((score as { score: number }).score).toBeLessThanOrEqual(5);
    }
  }, 30000);
});
