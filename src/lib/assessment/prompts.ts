/**
 * assessment/prompts.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * AlgoMind — Post-Interview Cognitive Assessment Prompt Generator
 *
 * Used by CognitiveAnalyzer in assessment/analyzer.ts.
 * This is the authoritative assessment prompt.
 *
 * AUDIT FIXES IN THIS FILE
 * ─────────────────────────
 * SA-01  overallScore removed from AI output. Computed by computeOverallScore()
 *        in analyzer.ts. AI-reported overall always diverged from weighted calc.
 *
 * SA-02  Short-session score cap now inside the prompt so AI evidence matches
 *        capped scores from the start. Previously validator capped mechanically
 *        while AI evidence still justified 7+, creating a score/evidence mismatch.
 *
 * SA-03  Bonus dimensions (timeEfficiency/contextSwitching) now in a dedicated
 *        bonusDimensions block with explicit instruction they contribute 10% to
 *        the overall score via computeOverallScoreWithBonus() in analyzer.ts.
 *
 * AC-03  All skill dimension keys must be dash-case ("problem-decomposition")
 *        to match SKILL_DEFINITIONS. CamelCase keys cause silent validator drops.
 *
 * EMPLOYER MODE
 * ─────────────
 * Maximum strictness. No encouragement in feedback tone.
 * Assessment structure identical — only thresholds and tone differ.
 */

import { CognitiveSkill, SkillDefinition } from '@/types/assessment';
import { MODE_ASSESSMENT_CONFIGS } from '../interview/mode-assessment-config';
import type { DifficultyMode } from '../interview/interview-config';

export interface ConversationTurn {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ASSESSMENT PROMPT
// ─────────────────────────────────────────────────────────────────────────────

export function generateAssessmentPrompt(
  problem: {
    title: string;
    description: string;
    difficulty: string;
    difficultyMode?: DifficultyMode | 'employer';
  },
  transcript: ConversationTurn[],
  skillDefinitions: Record<CognitiveSkill, SkillDefinition>
): string {
  const mode = problem.difficultyMode ?? 'practice';
  const modeConfig = MODE_ASSESSMENT_CONFIGS[mode];

  const formattedTranscript = transcript
    .map(t => `${t.role.toUpperCase()}: ${t.content}`)
    .join('\n');

  const userTurnCount = transcript.filter(t => t.role === 'user').length;
  const shortSessionNote = buildShortSessionNote(userTurnCount);

  // SA-01: overallScore NOT in this output shape
  // AC-03: all keys are dash-case
  const skillsShape = Object.entries(skillDefinitions)
    .map(([id, def]) => `    "${id}": {
      "score": <weighted average of sub-criteria below, 1–10>,
      "subCriteria": {
${def.subCriteria.map(sc => `        "${sc.id}": <1–10>`).join(',\n')}
      },
      "evidence": ["Exact quote or specific described moment from transcript"],
      "strengths": ["1–2 observed strengths for this dimension"],
      "improvements": ["1–2 actionable improvements for this dimension"]
    }`).join(',\n');

  // SA-03: dedicated bonus block
  const bonusDimBlock = modeConfig.bonusDimension
    ? `
  "bonusDimensions": {
    "${modeConfig.bonusDimension.jsonKey}": {
      "score": <1–10>,
      "evidence": ["specific observation from this session"],
      "description": "${modeConfig.bonusDimension.description}"
    }
  },`
    : '';

  return `# GENERATE FINAL INTERVIEW ASSESSMENT

${modeConfig.contextBlock}

**Problem:** "${problem.title}"
**Difficulty:** ${problem.difficulty.toUpperCase()}
**Mode:** ${mode}
**Candidate turns in transcript:** ${userTurnCount}

${shortSessionNote}

You are an expert technical interviewer and cognitive scientist evaluating a DSA problem-solving session.

---

## PROBLEM STATEMENT

${problem.title}
${problem.description}

---

## CONVERSATION TRANSCRIPT

${formattedTranscript}

---

## STRICTNESS ENFORCEMENT

${modeConfig.strictnessNote}

| Score | Gate |
|-------|------|
| 1–3   | No understanding shown, or refused to engage |
| 4–5   | Vague only — stated approach without explanation |
| 6–7   | Correct but only after direct questioning |
| 8–9   | Correct and unprompted |
| 10    | Exceptional — proactively exceeded all expectations |

Hard rules — no exceptions:
- "Use a hashmap" / "O(n) I think" with no explanation → score MAX 4.
- Correct only after direct question → score MAX 6.
- "Good effort" alone → never justifies 7+.
- Short session cap — see note above.

---

## DIFFICULTY CALIBRATION

${problem.difficulty.toUpperCase()} difficulty:
- EASY:   Score 6 = average. Most candidates reach here.
- MEDIUM: Score 6 = met the bar. Score 7+ = above average.
- HARD:   Score 6 = understood the approach. Score 7+ = genuinely strong.

---

## COGNITIVE SKILLS TO EVALUATE

CRITICAL FORMAT REQUIREMENT:
All dimension keys must be dash-case exactly as shown below.
"problem-decomposition" is correct. "problemDecomposition" will be rejected by the validation pipeline.

${Object.entries(skillDefinitions).map(([_id, def]) => `
### ${def.name}
Key (use exactly): "${def.id}"
${def.description}

Sub-criteria — score each independently first, then compute weighted average:
${def.subCriteria.map(sc => `- "${sc.id}" (weight ${sc.weight}): ${sc.label} — ${sc.description}`).join('\n')}

Rubric:
1–2: ${def.rubric.level1}
3–4: ${def.rubric.level2}
5–6: ${def.rubric.level3}
7–8: ${def.rubric.level4}
9–10: ${def.rubric.level5}
`).join('\n')}

---

## OUTPUT — RETURN ONLY VALID JSON, NO PROSE, NO CODE FENCES

{
  "skills": {
${skillsShape}
  },${bonusDimBlock}
  ${modeConfig.includeHireDecision
      ? '"hireDecision": "STRONG_HIRE|HIRE|BORDERLINE|NO_HIRE|STRONG_NO_HIRE",'
      : '// hireDecision omitted — this mode has no hiring signal'}
  "codeQuality": null,
  "overallFeedback": "2–3 sentence summary citing specific moments from this session",
  "nextSteps": ["Concrete recommendation naming a specific technique or concept", "..."],
  "knowledgeGaps": ["Specific concept missed — e.g. Loop invariants in sliding window", "..."]
}

For codeQuality: if [FINAL CODE SUBMITTED] block present in transcript, replace null with:
{
  "score": <1–10>,
  "correctness": "Does code handle the examples? What specific case fails?",
  "clarity": "Variable naming, code structure, readability",
  "consistency": "Does code match the verbal approach described?",
  "issues": ["specific issue 1", "specific issue 2"]
}
If no code submitted: codeQuality must be null — not 0, not empty object.

---

## SCORING INSTRUCTIONS

1. Score each sub-criterion independently first.
2. Compute dimension score as weighted average of its sub-criteria. Do not override with intuition.
3. Sub-criteria scores are authoritative — they feed into computeOverallScore() in the backend.
4. Do NOT include an "overallScore" field. It is computed programmatically.
5. Evidence must be concrete: exact phrase or described specific moment. "Seemed to understand X" is not acceptable.
6. knowledgeGaps: 1–3 specific concepts. Empty array if none.
7. Do not give 10/10 unless genuinely exceptional by expert-level standards.
8. bonusDimensions scores contribute 10% to the overall score via computeOverallScoreWithBonus() — score them accurately.

---

## ACTION ITEM GENERATION RULES

Before generating nextSteps (action items), you MUST classify every technical concept into one of three evidence levels:
- MENTIONED: candidate explicitly raised the concept, even briefly or imperfectly (e.g., said "I will use hat" meaning HashMap)
- PARTIAL: candidate started but didn't complete the reasoning, or had a severe misunderstanding
- ABSENT: concept never came up in the transcript at all

Before generating action items, list what the candidate explicitly mentioned. Do not create action items for things already mentioned, even if not fully elaborated.

Action items (nextSteps) should ONLY target:
- ABSENT concepts that would have been relevant
- PARTIAL concepts where the candidate had a severe misunderstanding (not just incomplete phrasing)

NEVER generate action items for MENTIONED concepts. If the candidate said "hash map" or any recognizable variant, do NOT recommend "Review how to use a Hash Map."

---

${modeConfig.feedbackTone}
`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SHORT SESSION NOTE — SA-02 fix
// ─────────────────────────────────────────────────────────────────────────────

function buildShortSessionNote(userTurnCount: number): string {
  if (userTurnCount <= 3) {
    return `⚠️ SHORT SESSION — ${userTurnCount} candidate turns detected.
MANDATORY: Cap ALL dimension scores at 5 regardless of what the transcript shows.
There is insufficient evidence to justify any score above 5.
State this in overallFeedback: "This was a brief session — scores capped at 5 due to limited evidence."
Do not write evidence that implies performance higher than a score of 5 would justify.`;
  }
  if (userTurnCount <= 5) {
    return `⚠️ SHORT SESSION — ${userTurnCount} candidate turns detected.
MANDATORY: Cap ALL dimension scores at 6 regardless of what the transcript shows.
There is insufficient evidence to justify any score above 6.
State this in overallFeedback: "This was a brief session — scores capped at 6 due to limited evidence."
Do not write evidence that implies performance higher than a score of 6 would justify.`;
  }
  return '';
}