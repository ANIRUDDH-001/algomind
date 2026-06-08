/**
 * @codesage
 * @description Configuration mapping for mode-specific assessment logic, strictness, and feedback tone.
 * @section SEC-05: Core Libs: Interview & Voice
 * @author ANIRUDDH
 * @last_audited 2026-06-01
 */
// @ts-nocheck

// 

import { DifficultyMode } from './interview-config';

export interface ModeAssessmentConfig {
    /** Injected at top of feedback prompt — tells AI the evaluation context */
    contextBlock: string;
    /** Injected into the strictness block — mode-specific thresholds */
    strictnessNote: string;
    /** Optional 9th dimension unique to this mode */
    bonusDimension?: {
        id: string;
        name: string;
        description: string;
        jsonKey: string;
    };
    /** Feedback tone instruction */
    feedbackTone: string;
    /** Whether to show hire decision in output */
    includeHireDecision: boolean;
}

export const MODE_ASSESSMENT_CONFIGS: Record<DifficultyMode | 'employer', ModeAssessmentConfig> = {
    'warm-up': {
        contextBlock: `## ASSESSMENT CONTEXT: WARM-UP MODE
This was a Warm-Up session (20 min, 15 turns max, encouragement-focused).
Score for LEARNING MOMENTUM, not hire-pass readiness.
A 6/10 here means genuine effort and correct trajectory, not interview performance.
Do NOT produce a hire decision — this session has no hiring signal.
Compare to beginner baseline, not senior-engineer baseline.`,
        strictnessNote: `Warm-Up mode uses relaxed thresholds:
score 5-6 = candidate demonstrated the concept with help (acceptable for warm-up)
score 7-8 = candidate demonstrated correctly with minimal help
score 9-10 = candidate demonstrated proactively and independently`,
        feedbackTone: `Tone: Encouraging and developmental. Frame improvements as "next steps", not failures.
Use phrases like "building toward" and "next time try". Do NOT use "should have" or "failed to".`,
        includeHireDecision: false,
    },

    'practice': {
        contextBlock: `## ASSESSMENT CONTEXT: PRACTICE MODE
This was a standard Practice session (30 min, 20 turns, Google/Meta/Amazon bar).
Apply STANDARD interview scoring. This is the baseline for hire-decision signal.`,
        strictnessNote: `Standard thresholds apply. See strictness table above.`,
        feedbackTone: `Tone: Professional and direct. Balanced strengths/improvements. Hire decision required.`,
        includeHireDecision: true,
    },

    'crunch': {
        contextBlock: `## ASSESSMENT CONTEXT: CRUNCH MODE
This was a Crunch session (25 min, 12 turns, time pressure applied).
CRITICAL: Factor time efficiency into scoring.
- Correct optimal solution reached in < 18 minutes → bonus 0.5 to Algorithmic Thinking
- Still on brute-force at 20+ minutes with no optimisation discussion → penalty to Optimization Mindset
- Do NOT penalise communication for being brief under time pressure
Score for performance under real interview conditions, not ideal conditions.`,
        strictnessNote: `Crunch mode uses standard thresholds but rewards speed.
Reduce score by 1 for any dimension where candidate explicitly stalled for > 3 minutes.`,
        bonusDimension: {
            id: 'time-efficiency',
            name: 'Time Efficiency',
            description: 'Did candidate manage time well under pressure?',
            jsonKey: 'timeEfficiency',
        },
        feedbackTone: `Tone: Direct and efficient. The candidate chose pressure — give them a clear pass/fail assessment.
Hire decision required.`,
        includeHireDecision: true,
    },

    'sprint': {
        contextBlock: `## ASSESSMENT CONTEXT: SPRINT MODE
This was a Sprint session (45 min, 2 problems, 10 turns each).
Score BOTH problems individually, then provide a combined assessment.
Add a "Context Switching" score: did the candidate transfer any learnings from Problem 1 to Problem 2?
Flag if candidate spent > 60% of total turns on Problem 1 (time management issue).`,
        strictnessNote: `Sprint mode: apply standard thresholds per problem. Combined overall = average of both.`,
        bonusDimension: {
            id: 'context-switching',
            name: 'Context Switching',
            description: 'Applied learnings from Problem 1 to Problem 2',
            jsonKey: 'contextSwitching',
        },
        feedbackTone: `Tone: Professional. Provide per-problem breakdown, then combined assessment. Hire decision required.`,
        includeHireDecision: true,
    },

    'employer': {
        contextBlock: `## ASSESSMENT CONTEXT: EMPLOYER ASSESSMENT
This session is an EMPLOYER CAMPAIGN evaluation. A real hiring decision depends on this.
Apply the STRICTEST possible interpretation of every rubric level.
Vague answers MUST receive 4 or below. No exceptions for "effort" or "good attitude".
This is not a learning session — it is a candidate screening.`,
        strictnessNote: `EMPLOYER MODE: All strictness rules are MANDATORY, not guidelines.`,
        feedbackTone: `Tone: Completely objective. No encouragement. Report what happened factually.`,
        includeHireDecision: true,
    }
};
