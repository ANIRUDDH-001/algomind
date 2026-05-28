/**
 * @module learn/tutor-prompt
 * @description Kai-Tutor system prompt builder.
 *              Called by /api/learn/concept on every turn.
 *              Produces a focused, voice-optimized teaching prompt.
 * @phase Phase 2D
 */

import { KAI_TUTOR_BEHAVIORAL_CONTRACT, getOpeningMessage } from './tutor-behavioral-contract';
import { buildStudentContextPromptBlock } from '@/lib/kai-context';
import type { StudentContext } from '@/lib/kai-context/types';
import type { ConceptTag } from '@/types/knowledge-graph';
import { getConfidenceLevel } from '@/types/knowledge-graph';

export interface KaiTutorPromptOptions {
  conceptTag: ConceptTag;
  studentContext?: StudentContext;
  currentConfidence?: number;
  exchangeCount: number;

  proactiveNudge?: string | null;
  masterySignal?: boolean;
}

/**
 * Build the complete Kai-Tutor system prompt for a given turn.
 * Kept under 2000 tokens by design.
 */
export function buildKaiTutorSystemPrompt(options: KaiTutorPromptOptions): string {
  const {
    conceptTag,
    studentContext,
    currentConfidence,
    exchangeCount,
    proactiveNudge,
    masterySignal,
  } = options;

  const confidenceLevel = currentConfidence !== undefined
    ? getConfidenceLevel(currentConfidence)
    : 'unknown';

  const confidenceNote = currentConfidence !== undefined
    ? `Student's tracked confidence for this concept: ${(currentConfidence * 100).toFixed(0)}% (${confidenceLevel})`
    : 'No prior data - treat as new student for this concept.';

  const studentContextBlock = studentContext
    ? buildStudentContextPromptBlock(studentContext)
    : '<student_context>No prior data available.</student_context>';

  const sessionPhase = getSessionPhase(exchangeCount, masterySignal);
  const languageHint = '';
  const nudgeHint = proactiveNudge
    ? `<nudge_hint>${proactiveNudge}</nudge_hint>`
    : '';
  const openingHint = exchangeCount === 0
    ? `<opening_hint>${getOpeningMessage(conceptTag.id, conceptTag.display_name)}</opening_hint>`
    : '';

  return `You are Kai, AlgoMind's AI tutor.

<concept_assignment>
Concept: ${conceptTag.display_name}
Slug: ${conceptTag.id}
Subject: ${conceptTag.subject.toUpperCase()}
Description: ${conceptTag.description ?? ''}
${confidenceNote}
</concept_assignment>

${studentContextBlock}

${openingHint}

${languageHint}

${nudgeHint}

<session_phase>
Current phase: ${sessionPhase.name} (turn ${exchangeCount + 1})
Phase instruction: ${sessionPhase.instruction}
</session_phase>

${KAI_TUTOR_BEHAVIORAL_CONTRACT}

<output_rules>
- Respond in plain spoken English only
- No markdown. No bullet points. No code blocks.
- Maximum 100 words per response.
- End every response with exactly ONE question (never zero, never two).
- MICRO-LESSON RULE: If the student struggles, says "I don't know", or asks for a hint, you MUST first provide a brief, clear explanation (a micro-lesson) with a simple example BEFORE asking your next guiding question. Do NOT just ask another question without explaining the concept first.
- In Closing phase: Do NOT ask a question. Instead, summarize the session and say goodbye.
- If the student says they want to end, stop asking questions immediately.
</output_rules>`;
}

interface SessionPhase {
  name: string;
  instruction: string;
}

function getSessionPhase(exchangeCount: number, masterySignal?: boolean): SessionPhase {
  if (exchangeCount === 0) {
    return {
      name: 'Opening',
      instruction: 'Warm greeting + probe existing knowledge. Ask what they already know.',
    };
  }
  if (masterySignal && exchangeCount >= 3) {
    return {
      name: 'Accelerated Consolidation',
      instruction: 'Student shows strong understanding. Push for edge cases, optimization, and complexity analysis. If they handle these well, proceed to closing.',
    };
  }
  if (exchangeCount <= 2) {
    return {
      name: 'Knowledge Probing',
      instruction: 'Assess baseline. Identify gaps. Do not teach yet - only listen and probe.',
    };
  }
  if (exchangeCount <= 10) {
    return {
      name: 'Core Teaching',
      instruction: 'Socratic dialogue. One concept at a time. Build from their answers.',
    };
  }
  if (exchangeCount <= 14) {
    return {
      name: 'Consolidation',
      instruction: 'Push for edge cases and complexity analysis. Challenge their understanding.',
    };
  }
  return {
    name: 'Closing',
    instruction: 'Wrap up the session. Give a brief summary of what was covered. Tell the student what they did well and what to review. Do NOT ask another teaching question — just summarize and say goodbye.',
  };
}

/**
 * Build the prompt for generating Kai's memory update after a learn session.
 */
export function buildTutorMemoryUpdatePrompt(
  conceptDisplayName: string,
  sessionTranscript: string,
  currentMemory: string | null
): string {
  return `You are updating AlgoMind's memory for a student after a tutoring session on "${conceptDisplayName}".

Current memory: ${currentMemory ?? 'No prior memory.'}

Session transcript:
${sessionTranscript.slice(0, 3000)}

Update the memory to reflect what was learned in this session.
Be concise (under 200 words). Focus on: concept gaps found, misconceptions corrected, what clicked.
Do not include generic praise. Be specific about the concept.

Respond with the updated memory text only. No preamble.`;
}

/**
 * Build Kai's opening message for a new concept session.
 */
export function buildTutorOpeningMessage(
  conceptTag: ConceptTag,
  studentContext?: StudentContext
): string {
  const baseOpening = getOpeningMessage(conceptTag.id, conceptTag.display_name);

  if (!studentContext) return baseOpening;

  const isKnownWeak = studentContext.weakestConcepts.some((concept) => concept.slug === conceptTag.id);
  const isKnownStrong = studentContext.strongestConcepts.some((concept) => concept.slug === conceptTag.id);

  if (isKnownWeak && studentContext.hasCompletedDiagnostic) {
    return `${conceptTag.display_name} is one of your growth areas - great choice to focus here! ${baseOpening}`;
  }

  if (isKnownStrong) {
    return `You have a solid foundation in ${conceptTag.display_name}! Let's go deeper today. ${baseOpening}`;
  }

  return baseOpening;
}

