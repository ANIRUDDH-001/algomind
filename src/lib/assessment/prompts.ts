import { CognitiveSkill, SkillDefinition } from '@/types/assessment';
import { MODE_ASSESSMENT_CONFIGS } from '../interview/mode-assessment-config';
import type { DifficultyMode } from '../interview/interview-config';

export interface ConversationTurn {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export function generateAssessmentPrompt(
  problem: { title: string; description: string; difficulty: string; difficultyMode?: DifficultyMode | 'employer' },
  transcript: ConversationTurn[],
  skillDefinitions: Record<CognitiveSkill, SkillDefinition>
): string {
  const mode = problem.difficultyMode ?? 'practice';
  const modeConfig = MODE_ASSESSMENT_CONFIGS[mode];
  const formattedTranscript = transcript
    .map(turn => `${turn.role.toUpperCase()}: ${turn.content}`)
    .join('\n');

  const skillsJsonShape = Object.entries(skillDefinitions).map(([id, def]) => `    "${id}": {
      "score": <weighted average of sub-criteria, 1-10>,
      "subCriteria": {
${def.subCriteria.map(sc => `        "${sc.id}": <1-10>`).join(',\n')}
      },
      "evidence": ["Exact quote from transcript", "..."],
      "strengths": ["..."],
      "improvements": ["..."]
    }`).join(',\n');

  return `# GENERATE FINAL INTERVIEW FEEDBACK

${modeConfig.contextBlock}

**Problem:** "${problem.title}"
**Difficulty:** ${problem.difficulty.toUpperCase()}
**Mode:** ${mode}

You are an expert technical interviewer and cognitive scientist evaluating a candidate's DSA problem-solving session.

PROBLEM STATEMENT:
Title: ${problem.title}
Problem: ${problem.description}
Difficulty Level: ${problem.difficulty}

CONVERSATION TRANSCRIPT:
${formattedTranscript}

## STRICTNESS ENFORCEMENT
${modeConfig.strictnessNote}

| Score | Gate (standard) |
|-------|-----------------|
| 1–3   | No understanding shown |
| 4–5   | Vague only — no explanation |
| 6–7   | Correct but prompted |
| 8–9   | Correct and unprompted |
| 10    | Exceptional, proactive |

## DIFFICULTY CALIBRATION
Problem difficulty is ${problem.difficulty.toUpperCase()}.
- EASY: A 6/10 performance means average — expected most candidates to reach here.
- MEDIUM: A 6/10 means the candidate met the bar. A 7+ means above average.
- HARD: A 6/10 means the candidate understood the approach. A 7+ is genuinely strong.
Calibrate your scores accordingly. Do not grade Easy problems on Hard-problem scale.

YOUR TASK:
Analyze this interview session and score the candidate across 8 cognitive skills.
For each skill, provide an objective score based on the rubric, supporting evidence from the transcript, and actionable feedback.

COGNITIVE SKILLS TO EVALUATE:
${Object.entries(skillDefinitions).map(([_id, def]) => `
- ${def.name}: ${def.description}
  Sub-criteria weights: ${def.subCriteria.map(sc => `${sc.label} (${sc.id}) = ${sc.weight}`).join(', ')}
  Rubric:
  1-2 (Level 1): ${def.rubric.level1}
  3-4 (Level 2): ${def.rubric.level2}
  5-6 (Level 3): ${def.rubric.level3}
  7-8 (Level 4): ${def.rubric.level4}
  9-10 (Level 5): ${def.rubric.level5}
`).join('\n')}

OUTPUT FORMAT (JSON ONLY):
{
  "skills": {
${skillsJsonShape}
  },
  ${modeConfig.bonusDimension ? `"${modeConfig.bonusDimension.jsonKey}": { "score": <1-10>, "evidence": ["..."] },` : ''}
  ${modeConfig.includeHireDecision ? '"hireDecision": "STRONG_HIRE|HIRE|BORDERLINE|NO_HIRE|STRONG_NO_HIRE",' : ''}
  "codeQuality": {
    "score": <1-10 or null if no code submitted>,
    "correctness": "<Does the code handle the examples? What fails?>",
    "clarity": "<Variable naming, code structure, readability>",
    "consistency": "<Does code match verbal approach described?>",
    "issues": ["specific issue 1", "specific issue 2"]
  },
  "overallFeedback": "High-level summary of performance",
  "nextSteps": ["Actionable recommendation 1", "..."],
  "knowledgeGaps": ["Specific concept missed (e.g. 'Loop invariants')", "..."]
}

IMPORTANT:
- Score each sub-criterion independently first. Then calculate the dimension score as the weighted average of its sub-criteria.
- Do not round-trip — the sub-criteria scores are authoritative.
- Return ONLY the JSON object.
- Quote EXACT phrases from the transcript as evidence.
- Be constructively critical. Don't give 10/10 unless the performance is truly exemplary.
- Consider problem difficulty. A "Hard" problem solved with minor gaps is better than an "Easy" problem solved perfectly but slowly.
- **knowledgeGaps**: List 1-3 specific technical concepts the candidate lacked or struggled with. If none, leave empty.

CODE QUALITY ASSESSMENT:
If the transcript includes a [FINAL CODE SUBMITTED] block:
- Evaluate whether the code is logically correct for the given problem
- Note naming quality (are variables meaningful?)
- Note whether the code structure matches what the candidate described verbally
- If the transcript has no code block, set codeQuality to null

${modeConfig.feedbackTone}
`;
}
