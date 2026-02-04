import { CognitiveSkill, SkillDefinition } from '@/types/assessment';

export interface ConversationTurn {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export function generateAssessmentPrompt(
    problem: { title: string; description: string; difficulty: string },
    transcript: ConversationTurn[],
    skillDefinitions: Record<CognitiveSkill, SkillDefinition>
): string {
    const formattedTranscript = transcript
        .map(turn => `${turn.role.toUpperCase()}: ${turn.content}`)
        .join('\n');

    return `
You are an expert technical interviewer and cognitive scientist evaluating a candidate's DSA problem-solving session.

PROBLEM STATEMENT:
Title: ${problem.title}
Problem: ${problem.description}
Difficulty Level: ${problem.difficulty}

CONVERSATION TRANSCRIPT:
${formattedTranscript}

YOUR TASK:
Analyze this interview session and score the candidate across 8 cognitive skills.
For each skill, provide an objective score based on the rubric, supporting evidence from the transcript, and actionable feedback.

COGNITIVE SKILLS TO EVALUATE:
${Object.entries(skillDefinitions).map(([id, def]) => `
- ${def.name}: ${def.description}
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
    "problem-decomposition": {
      "score": number,
      "evidence": ["Exact quote from transcript", "..."],
      "strengths": ["..."],
      "improvements": ["..."]
    },
    ... (repeat for all 8 skills)
  },
  "overallFeedback": "High-level summary of performance",
  "nextSteps": ["Actionable recommendation 1", "..."]
}

IMPORTANT:
- Return ONLY the JSON object.
- Quote EXACT phrases from the transcript as evidence.
- Be constructively critical. Don't give 10/10 unless the performance is truly exemplary.
- Consider problem difficulty. A "Hard" problem solved with minor gaps is better than an "Easy" problem solved perfectly but slowly.
`;
}
