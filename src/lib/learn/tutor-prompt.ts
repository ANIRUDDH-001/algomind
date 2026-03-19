/**
 * @module learn/tutor-prompt
 * @description System prompt builder for concept-scoped Kai tutor sessions.
 * @phase Phase 2C
 */

import type { ConceptTag } from '@/types/knowledge-graph';
import { buildStudentContextPromptBlock } from '@/lib/kai-context';
import type { StudentContext } from '@/lib/kai-context';

export interface KaiTutorPromptConfig {
  conceptTag: ConceptTag;
  studentContext?: StudentContext;
  currentConfidence?: number;
  exchangeCount: number;
  spokenLanguage?: 'english' | 'hinglish';
  proactiveNudge?: string | null;
}

export function buildKaiTutorSystemPrompt(config: KaiTutorPromptConfig): string {
  const {
    conceptTag,
    studentContext,
    currentConfidence,
    exchangeCount,
    spokenLanguage = 'english',
    proactiveNudge,
  } = config;

  const studentContextBlock = studentContext
    ? `\n${buildStudentContextPromptBlock(studentContext)}\n`
    : '\n<student_context>unavailable</student_context>\n';

  const confidenceLine = typeof currentConfidence === 'number'
    ? `Current confidence on this concept: ${(currentConfidence * 100).toFixed(0)}%.`
    : 'Current confidence on this concept is unknown (new or sparse learner data).';

  const languageBlock = spokenLanguage === 'hinglish'
    ? `Language behavior:
- Candidate is speaking Hinglish.
- Explain naturally in Hinglish, but keep all technical DSA terms in English.
- No Devanagari script.`
    : `Language behavior:
- Use clear conversational English.
- Keep explanations concise and structured.`;

  const nudgeBlock = proactiveNudge
    ? `\nProactive nudge recommendation for this turn:\n${proactiveNudge}\n`
    : '';

  return `You are Kai, a Socratic DSA tutor focused on concept mastery.
Goal: help the learner internalize the concept through guided questions, short explanations, and checkpoints.

Concept in focus: ${conceptTag.display_name} (${conceptTag.id})
Concept description: ${conceptTag.description ?? 'No description available.'}
${confidenceLine}
Current exchange count: ${exchangeCount}

${languageBlock}

Teaching protocol:
1. Start from intuition before algorithm labels.
2. Ask one focused question at a time.
3. If learner is stuck, provide layered hints: nudge -> scaffold -> direct clue.
4. Do not dump full solution unless learner asks repeatedly and still cannot progress.
5. Every 2-3 turns, run a tiny check-for-understanding.
6. Keep responses short enough for live tutoring (2-6 sentences usually).

Session constraints:
- This is a concept-teaching session, not a mock interview.
- Adapt to learner history when available.
- Stay on the target concept and closely related sub-concepts.

${studentContextBlock}${nudgeBlock}`;
}
