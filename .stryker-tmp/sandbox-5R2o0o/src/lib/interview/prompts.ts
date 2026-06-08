/**
 * @codesage
 * @description Orchestrates the generation of per-turn AI prompts injected into the conversation.
 * @section SEC-05: Core Libs: Interview & Voice
 * @author ANIRUDDH
 * @last_audited 2026-06-01
 */
// @ts-nocheck

/**
 * prompts.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * AlgoMind — Interview Turn Prompt Orchestrator
 *
 * AUDIT FIXES IN THIS FILE
 * ─────────────────────────
 * B-02  DIFFICULTY_MODE_CONTEXT removed entirely. Mode behaviour lives only in
 *       interviewer-prompt.ts MODE_CONFIGS. The old overlay created contradictory
 *       hint thresholds (warm-up received 15s AND 30s AND 2-min simultaneously).
 * B-03  conversationHistory / methodHistory = '' removed.
 *       History lives in messages[] — never duplicated here.
 * B-04  generateFinalFeedbackPrompt dead wrapper removed.
 * B-06  difficultyMode and difficulty passed through correctly — no silent defaults.
 * FG-04 solution-review → testing, assessment → complexity so both phase
 *       branches are now reachable (were dead code before).
 * SR-04 MAX_USER_INPUT re-exported for useInterview.ts.
 *
 * GUEST MODE
 * ──────────
 * GUEST_INTRO_TEXT and GUEST_INTRO_BANNER are re-exported here.
 * The system prompt includes a note that the branded intro has already been
 * delivered — Kai must not repeat it.
 * isGuest is always locked to practice mode.
 */

import { InterviewState } from './state-machine';
import {
    generateInterviewerSystemPrompt,
    generateTurnPrompt as buildPhaseTurnPrompt,
    generateInterviewOpeningTrigger,
    MAX_USER_INPUT,
    GUEST_INTRO_TEXT,
    GUEST_INTRO_BANNER,
    InterviewConfig,
} from './interviewer-prompt';
import { Problem } from '@/types/problem';
import type { KaiMemoryStructured } from '@/types/kai-memory';

// Re-export so callers only need one import
export {
    MAX_USER_INPUT,
    GUEST_INTRO_TEXT,
    GUEST_INTRO_BANNER,
    generateInterviewOpeningTrigger,
};

export const PROMPT_REGISTRY_VERSION = 'phase3.v1';

export const PROMPT_VERSION_TAGS = {
    interviewChat: 'interview-chat.v1',
    assessmentChat: 'assessment-chat.v1',
    interviewerSystem: 'interviewer-system.v1',
} as const;

export type PromptVersionTag = (typeof PROMPT_VERSION_TAGS)[keyof typeof PROMPT_VERSION_TAGS];

export function buildPromptVersionHeader(tag: PromptVersionTag): string {
    return `<prompt_version registry="${PROMPT_REGISTRY_VERSION}" tag="${tag}" />`;
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface PromptContext {
    state: InterviewState;
    problemTitle: string;
    problemContent: string;
    /** Current user message — this turn only. */
    transcript: string;
    /** Optional context from an interrupted AI response. */
    interruptionContext?: string;
    /** Turns remaining — passed to urgency note. */
    turnsRemaining?: number;
    /** Seconds remaining — passed to urgency note. */
    timeRemaining?: number;
}

export interface SystemPromptOptions {
    problem: Problem;
    ragContext?: string;
    kaiMemory?: string;
    kaiMemoryStructured?: KaiMemoryStructured | null;
    difficultyMode?: 'warm-up' | 'practice' | 'crunch' | 'sprint' | 'employer';
    difficulty?: 'easy' | 'medium' | 'hard';
    candidateLevel?: 'beginner' | 'intermediate' | 'advanced';
    language?: string;
    optimalApproach?: string;
    turnsRemaining?: number;
    timeRemaining?: number;
    isGuest?: boolean;
    sprintProblemIndex?: 0 | 1;
    secondProblem?: Pick<Problem, 'title' | 'content' | 'description' | 'difficulty'>;
}

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates the system prompt for the AI interviewer.
 *
 * INJECTION SAFETY:
 * ragContext and kaiMemory are injected with XML delimiters inside
 * generateInterviewerSystemPrompt(). route.ts must NOT re-inject them.
 *
 * GUEST MODE:
 * When isGuest = true, mode is locked to practice and the system prompt
 * contains a note that the branded intro has already been delivered.
 * useInterview.ts is responsible for injecting GUEST_INTRO_TEXT as a
 * hardcoded message before the first AI call — see INTEGRATION_GUIDE.md Step 1c.
 */
export function generateSystemPrompt(options: SystemPromptOptions): string {
    const {
        problem,
        ragContext,
        kaiMemory,
        kaiMemoryStructured,
        difficulty,
        candidateLevel,
        language,
        optimalApproach,
        turnsRemaining,
        timeRemaining,
        isGuest,
        sprintProblemIndex,
        secondProblem,
    } = options;

    // Guest users are always locked to practice
    const difficultyMode: InterviewConfig['difficultyMode'] = isGuest
        ? 'practice'
        : (options.difficultyMode ?? 'practice');

    const config: InterviewConfig = {
        problem,
        difficulty: difficulty ?? (problem.difficulty as 'easy' | 'medium' | 'hard') ?? 'medium',
        difficultyMode,
        ragContext: ragContext ?? '',
        kaiMemory: kaiMemory ?? '',
        kaiMemoryStructured: kaiMemoryStructured ?? undefined,
        candidateLevel,
        language,
        optimalApproach: optimalApproach ?? problem.solution ?? undefined,
        turnsRemaining,
        timeRemaining,
        isGuest,
        sprintProblemIndex,
        secondProblem,
    };

    return generateInterviewerSystemPrompt(config);
}

/**
 * Legacy shim for call sites that pass only (problem, ragContext, mode).
 * Prefer generateSystemPrompt() with full options for all new code.
 */
export function generateSystemPromptLegacy(
    problem?: Problem,
    ragContext?: string,
    mode?: string
): string {
    if (!problem) {
        return `You are "Kai", a technical interviewer at AlgoMind.
Conduct a mock DSA coding interview. Be friendly, encouraging, and rigorous.
Speak concisely — 2–3 sentences per response.
Do NOT give away the solution. Guide with hints if the candidate is stuck.`;
    }
    return generateSystemPrompt({
        problem,
        ragContext,
        difficultyMode: (['warm-up', 'practice', 'crunch', 'sprint', 'employer'].includes(mode ?? '')
            ? mode
            : 'practice') as SystemPromptOptions['difficultyMode'],
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// TURN PROMPT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates the per-turn instruction injected as a user-turn message alongside messages[].
 *
 * NOT included here:
 * - Conversation history → lives in messages[]
 * - RAG context → lives in system prompt
 * - kaiMemory → lives in system prompt
 *
 * STATE → PHASE MAPPING:
 * solution-review → 'testing'   (FG-04 fix: was 'wrap-up', branch was unreachable)
 * assessment      → 'complexity' (FG-04 fix: was 'wrap-up', branch was unreachable)
 */
export function generateTurnPrompt(context: PromptContext): string {
    const {
        state,
        problemTitle,
        transcript,
        interruptionContext,
        turnsRemaining,
        timeRemaining,
    } = context;

    const anchor = `[Problem: "${problemTitle}"]`;

    const stateToPhase: Record<
        InterviewState,
        'intro' | 'approach' | 'coding' | 'testing' | 'complexity' | 'wrap-up'
    > = {
        'idle':             'intro',
        'problem-intro':    'intro',
        'user-thinking':    'approach',
        'ai-clarifying':    'approach',
        'user-solving':     'coding',
        'ai-feedback':      'coding',
        'user-coding':      'coding',
        'solution-review':  'testing',    // FG-04 fix
        'assessment':       'complexity', // FG-04 fix
        'complexity-analysis': 'complexity',
        'network-error':    'wrap-up',
        'paused':           'approach',
        'completed':        'wrap-up',
    };

    const phase = stateToPhase[state] ?? 'approach';

    const phaseInstruction = buildPhaseTurnPrompt(
        phase,
        transcript,
        turnsRemaining,
        timeRemaining,
    );

    const interruptionBlock = interruptionContext ? `\n\n${interruptionContext}` : '';

    return `${anchor}\n\n${phaseInstruction}${interruptionBlock}`;
}