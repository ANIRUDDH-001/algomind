/**
 * @codesage
 * @description Tests for the silent observer, ensuring accurate detection and throttling of coaching nudges.
 * @section SEC-05: Core Libs: Interview & Voice
 * @author ANIRUDDH
 * @last_audited 2026-06-01
 * @skip: test-file
 */
import { SilentObserver } from '../silent-observer';
import { getAIClient } from '../../ai/client';
import { classifyTurnSignal } from '../turn-classifier';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('../../ai/client');
vi.mock('../turn-classifier');

describe('SilentObserver', () => {
    let observer: SilentObserver;
    let mockGenerateCompletion: any;

    beforeEach(() => {
        vi.useFakeTimers();
        observer = new SilentObserver();
        vi.clearAllMocks();

        mockGenerateCompletion = vi.fn().mockResolvedValue({
            success: true,
            response: JSON.stringify({ type: 'pass' })
        });

        (getAIClient as any).mockReturnValue({
            generateCompletion: mockGenerateCompletion
        });

        (classifyTurnSignal as any).mockResolvedValue(null);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const createTurns = (count: number) =>
        Array.from({ length: count }).map((_, i) => ({
            role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
            content: `Turn ${i}`
        }));

    it('returns null if there are fewer than MIN_TURNS', async () => {
        const result = await observer.analyze({
            recentTurns: createTurns(3),
            interviewState: 'user-solving',
            elapsedSeconds: 60,
            problemTitle: 'Two Sum'
        });
        expect(result).toEqual({ nudgeText: null, nudgeType: null });
        expect(mockGenerateCompletion).not.toHaveBeenCalled();
    });

    it('returns null if interview state is not active', async () => {
        const result = await observer.analyze({
            recentTurns: createTurns(5),
            interviewState: 'completed',
            elapsedSeconds: 60,
            problemTitle: 'Two Sum'
        });
        expect(result).toEqual({ nudgeText: null, nudgeType: null });
        expect(mockGenerateCompletion).not.toHaveBeenCalled();
    });

    it('returns a procedural nudge if AI detects one', async () => {
        mockGenerateCompletion.mockResolvedValueOnce({
            success: true,
            response: JSON.stringify({ type: 'coaching', key: 'complexity_missing', text: 'What about complexity?' })
        });

        const result = await observer.analyze({
            recentTurns: createTurns(5),
            interviewState: 'user-solving',
            elapsedSeconds: 60,
            problemTitle: 'Two Sum'
        });

        expect(result.nudgeType).toBe('coaching');
        expect(result.nudgeText).toBe('What about complexity?');
        expect(result.badgeSignal).toBeNull();
    });

    it('enforces per-signal cooldowns correctly', async () => {
        // First call fires it
        mockGenerateCompletion.mockResolvedValueOnce({
            success: true,
            response: JSON.stringify({ type: 'coaching', key: 'complexity_missing', text: 'Time complexity?' })
        });

        await observer.analyze({
            recentTurns: createTurns(5),
            interviewState: 'user-solving',
            elapsedSeconds: 60,
            problemTitle: 'Two Sum'
        });

        // Second call should be blocked by cooldown even if AI tries to fire it
        mockGenerateCompletion.mockResolvedValueOnce({
            success: true,
            response: JSON.stringify({ type: 'coaching', key: 'complexity_missing', text: 'Time complexity?' })
        });

        const result2 = await observer.analyze({
            recentTurns: createTurns(5),
            interviewState: 'user-solving',
            elapsedSeconds: 60,
            problemTitle: 'Two Sum'
        });

        expect(result2.nudgeType).toBeNull();

        // Advance past cooldown (120s for complexity)
        vi.advanceTimersByTime(120_001);

        // Third call should fire
        mockGenerateCompletion.mockResolvedValueOnce({
            success: true,
            response: JSON.stringify({ type: 'coaching', key: 'complexity_missing', text: 'Time complexity again?' })
        });

        const result3 = await observer.analyze({
            recentTurns: createTurns(5),
            interviewState: 'user-solving',
            elapsedSeconds: 180,
            problemTitle: 'Two Sum'
        });

        expect(result3.nudgeType).toBe('coaching');
    });

    it('blocks ONE_SHOT signals from firing twice in a session regardless of time', async () => {
        // First fire
        mockGenerateCompletion.mockResolvedValueOnce({
            success: true,
            response: JSON.stringify({ type: 'coaching', key: 'constraints_never_asked', text: 'Constraints?' })
        });

        await observer.analyze({
            recentTurns: createTurns(5),
            interviewState: 'user-solving',
            elapsedSeconds: 60,
            problemTitle: 'Two Sum'
        });

        // Advance extreme time
        vi.advanceTimersByTime(10000000);

        // Try second fire
        mockGenerateCompletion.mockResolvedValueOnce({
            success: true,
            response: JSON.stringify({ type: 'coaching', key: 'constraints_never_asked', text: 'Constraints?' })
        });

        const result2 = await observer.analyze({
            recentTurns: createTurns(5),
            interviewState: 'user-solving',
            elapsedSeconds: 60,
            problemTitle: 'Two Sum'
        });

        expect(result2.nudgeType).toBeNull();
    });

    it('returns positive badge signal if turn-classifier detects one', async () => {
        (classifyTurnSignal as any).mockResolvedValueOnce({
            dimension: 'pattern-recognition',
            triggerPhrase: 'Sliding window detected'
        });

        const result = await observer.analyze({
            recentTurns: createTurns(5),
            interviewState: 'user-solving',
            elapsedSeconds: 60,
            problemTitle: 'Two Sum'
        });

        expect(result.nudgeType).toBe('positive');
        expect(result.badgeSignal).toEqual({
            dimension: 'pattern-recognition',
            triggerPhrase: 'Sliding window detected'
        });
        expect(mockGenerateCompletion).not.toHaveBeenCalled(); // Stops early if positive signal found
    });

    it('gracefully handles AI failure', async () => {
        mockGenerateCompletion.mockRejectedValueOnce(new Error('Network offline'));

        const result = await observer.analyze({
            recentTurns: createTurns(5),
            interviewState: 'user-solving',
            elapsedSeconds: 60,
            problemTitle: 'Two Sum'
        });

        expect(result).toEqual({ nudgeText: null, nudgeType: null });
    });
});
