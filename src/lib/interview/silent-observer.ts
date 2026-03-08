/**
 * silent-observer.ts  (REBUILT)
 *
 * Runs after each AI response exchange. Detects:
 *   - POSITIVE signals: surfaces real SkillBadge (delegates to turn-classifier.ts)
 *   - PROCEDURAL gaps: coaching nudges for missing steps
 *   - QUALITY failures: coaching nudges for reasoning errors
 *
 * Uses PER-SIGNAL cooldowns to allow multiple independent nudges.
 * Max 100 tokens, Groq model.
 */

import { getAIClient } from '../ai/client';
import { classifyTurnSignal } from './turn-classifier';
import type { CognitiveSkill } from '@/types/assessment';

export type InterviewState =
    | 'idle' | 'user-speaking' | 'ai-speaking'
    | 'user-thinking' | 'user-solving' | 'user-coding' | 'ai-clarifying' | 'completed';

export type NudgeType =
    | 'coaching'    // procedural or quality gap
    | 'positive';   // signal worth surfacing as badge

export interface ObserverResult {
    nudgeText: string | null;
    nudgeType: NudgeType | null;
    badgeSignal?: {
        dimension: CognitiveSkill;
        triggerPhrase: string;
    } | null;
}

interface CooldownTracker {
    [signalKey: string]: number;  // signal key → last fired timestamp
}

const COOLDOWNS_MS: Record<string, number> = {
    // Procedural nudges
    complexity_missing: 120_000,  // 2 min
    constraints_never_asked: 300_000, // 5 min (one-shot early in session)
    stuck_same_approach: 150_000,
    code_no_narration: 90_000,
    hint_available: 180_000,
    // Quality nudges
    vague_complexity_answer: 90_000,
    no_edge_cases: 150_000,
    // Positive — per dimension (handled by turn-classifier, not observer)
    global_positive: 30_000,  // min gap between any badge
    // Code analysis during user-coding state
    code_analysis: 30_000,
};

const OBSERVER_PROMPT = `You are a silent coaching observer for a technical interview.
Analyze the last 3 conversation turns and detect ONE issue or return PASS.

DETECT PROCEDURAL GAPS:
- P1: Candidate coded for 2+ turns without mentioning time complexity → return: { "type": "coaching", "key": "complexity_missing", "text": "Quick check — what is the time complexity of your approach?" }
- P2: Candidate has not asked any clarifying question in first 3 turns → return: { "type": "coaching", "key": "constraints_never_asked", "text": "Did you clarify the input constraints first?" }
- P3: Candidate repeated same flawed approach 2+ turns in a row → return: { "type": "coaching", "key": "stuck_same_approach", "text": "Consider stepping back — is there a fundamentally different angle?" }
- P4: Candidate writing code 2+ turns with zero verbal narration → return: { "type": "coaching", "key": "code_no_narration", "text": "Narrate your logic as you code — think out loud." }
- P5: Candidate visibly stuck, hasn't requested hint → return: { "type": "coaching", "key": "hint_available", "text": "It is okay to ask for a hint if you are stuck." }

DETECT QUALITY FAILURES:
- Q1: Candidate gave complexity answer like "O(n) I think" without explanation → return: { "type": "coaching", "key": "vague_complexity_answer", "text": "Can you walk through WHY it is O(n)?" }
- Q2: Candidate about to commit code with no mention of edge cases → return: { "type": "coaching", "key": "no_edge_cases", "text": "Before finalising — have you considered empty input or duplicates?" }

If NONE detected: return { "type": "pass" }

Return ONLY valid JSON. No prose.`;

export class SilentObserver {
    private cooldowns: CooldownTracker = {};
    private readonly MIN_TURNS = 4;
    private sessionFiredKeys: Set<string> = new Set();

    // One-shot signals (only fire once per session)
    private readonly ONE_SHOT_KEYS = new Set(['constraints_never_asked']);

    public async analyze(params: {
        recentTurns: Array<{ role: 'user' | 'assistant'; content: string }>;
        interviewState: InterviewState;
        elapsedSeconds: number;
        problemTitle: string;
    }): Promise<ObserverResult> {
        const { recentTurns, interviewState, elapsedSeconds, problemTitle } = params;

        if (recentTurns.length < this.MIN_TURNS) return { nudgeText: null, nudgeType: null };

        // Only run in active phases
        const activePhases: InterviewState[] = ['user-thinking', 'user-solving', 'ai-clarifying'];
        if (!activePhases.includes(interviewState)) return { nudgeText: null, nudgeType: null };

        // Check last user message for positive badge signal first
        const lastUserMsg = [...recentTurns].reverse().find(t => t.role === 'user');
        if (lastUserMsg && !this.isOnCooldown('global_positive')) {
            const signal = await classifyTurnSignal(lastUserMsg.content, problemTitle);
            if (signal) {
                this.setCooldown('global_positive');
                return {
                    nudgeText: null,
                    nudgeType: 'positive',
                    badgeSignal: {
                        dimension: signal.dimension,
                        triggerPhrase: signal.triggerPhrase,
                    },
                };
            }
        }

        // Run quality/procedural observer
        const recentHistory = recentTurns.slice(-4).map(
            t => `${t.role.toUpperCase()}: ${t.content.substring(0, 200)}`
        ).join('\n---\n');

        try {
            const client = getAIClient();
            const result = await client.generateCompletion(
                [{
                    role: 'user',
                    content: `Elapsed: ${Math.floor(elapsedSeconds / 60)} min\n\nRecent turns:\n${recentHistory}\n\n${OBSERVER_PROMPT}`,
                }],
                {
                    maxTokens: 100,
                    preferredProvider: 'groq',
                    category: 'fast',
                }
            );

            if (!result.success || !result.response) return { nudgeText: null, nudgeType: null };

            const clean = result.response.replace(/```json|```/gi, '').trim();
            const parsed = JSON.parse(clean);

            if (parsed.type === 'pass') return { nudgeText: null, nudgeType: null };

            const key = parsed.key as string;

            // Check per-signal cooldown
            if (this.isOnCooldown(key)) return { nudgeText: null, nudgeType: null };

            // Check one-shot
            if (this.ONE_SHOT_KEYS.has(key) && this.sessionFiredKeys.has(key)) {
                return { nudgeText: null, nudgeType: null };
            }

            this.setCooldown(key);
            this.sessionFiredKeys.add(key);

            return {
                nudgeText: parsed.text,
                nudgeType: 'coaching',
                badgeSignal: null,
            };
        } catch (e) {
            console.error('[SilentObserver] Coaching nudge generation failed:', e);
            return { nudgeText: null, nudgeType: null };
        }
    }

    private isOnCooldown(key: string): boolean {
        const lastFired = this.cooldowns[key];
        if (!lastFired) return false;
        const cooldownMs = COOLDOWNS_MS[key] ?? 90_000;
        return (Date.now() - lastFired) < cooldownMs;
    }

    private setCooldown(key: string): void {
        this.cooldowns[key] = Date.now();
    }

    public reset(): void {
        this.cooldowns = {};
        this.sessionFiredKeys.clear();
    }

    /**
     * A3: Analyze code snapshot during user-coding state.
     * Returns brief inline hint (max 150 tokens) without interrupting the interview.
     */
    public async analyzeCode(params: {
        code: string;
        language: string;
        problemTitle: string;
    }): Promise<{ hint: string | null }> {
        const { code, language, problemTitle } = params;

        if (!code.trim() || code.trim().length < 20) {
            return { hint: null };
        }

        // Cooldown: only one code hint per 30 seconds
        if (this.isOnCooldown('code_analysis')) {
            return { hint: null };
        }

        try {
            const client = getAIClient();
            const result = await client.generateCompletion(
                [{
                    role: 'user',
                    content: `Problem: "${problemTitle}"\nLanguage: ${language}\n\nCandidate's code:\n\`\`\`${language}\n${code.substring(0, 1500)}\n\`\`\`\n\nGive ONE brief, actionable hint about a potential issue, edge case, or improvement. Max 1-2 sentences. If the code looks good, return "PASS".`,
                }],
                {
                    maxTokens: 150,
                    category: 'chat',
                    systemPrompt: 'You are a silent code reviewer during a technical interview. Give brief, helpful hints. Return "PASS" if no issues found.',
                }
            );

            if (!result.success || !result.response) return { hint: null };

            const response = result.response.trim();
            if (response === 'PASS' || response.toLowerCase().includes('looks good')) {
                return { hint: null };
            }

            this.setCooldown('code_analysis');
            return { hint: response };
        } catch (e) {
            console.error('[SilentObserver] Code analysis hint generation failed:', e);
            return { hint: null };
        }
    }
}
