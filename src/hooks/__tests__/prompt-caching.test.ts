/**
 * @codesage
 * @file      src/hooks/__tests__/prompt-caching.test.ts
 * @purpose   Unit tests for system prompt caching and turn-based state updates.
 * @tech      Vitest
 * @connects  Tests updateSystemPromptForTurn from useInterviewControl
 * @apis      none
 * @db        none
 * @state     none
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
import { describe, it, expect } from 'vitest';
import { updateSystemPromptForTurn } from '../useInterviewControl';

describe('updateSystemPromptForTurn', () => {
    const basePrompt = `# Kai Prompt\n<session_state>\nTurns remaining: 20\nTime remaining: 30:00\n</session_state>\nRest of prompt`;

    it('updates session_state block with new turn values', () => {
        const updated = updateSystemPromptForTurn(basePrompt, 15, 1500, 30);
        expect(updated).toContain('Turns remaining: 15');
        expect(updated).toContain('Time remaining: 25:00');
        expect(updated).not.toContain('Turns remaining: 20');
    });

    it('adds urgency note when 3 turns remaining', () => {
        const updated = updateSystemPromptForTurn(basePrompt, 3, 1500, 30);
        expect(updated).toContain('session ending soon');
    });

    it('adds final turn note when 1 turn remaining', () => {
        const updated = updateSystemPromptForTurn(basePrompt, 1, undefined, 30);
        expect(updated).toContain('FINAL TURN');
    });

    it('adds final minutes note when less than 10% time remaining', () => {
        const updated = updateSystemPromptForTurn(basePrompt, 5, 120, 30);
        expect(updated).toContain('FINAL MINUTES');
    });

    it('preserves all content outside session_state block', () => {
        const updated = updateSystemPromptForTurn(basePrompt, 10, 1000, 30);
        expect(updated).toContain('# Kai Prompt');
        expect(updated).toContain('Rest of prompt');
    });

    it('returns prompt unchanged when no turns or time provided', () => {
        const updated = updateSystemPromptForTurn(basePrompt, undefined, undefined, 30);
        expect(updated).toBe(basePrompt);
    });

    it('appends block when no existing session_state in prompt', () => {
        const promptWithoutBlock = '# Kai Prompt\nNo session state here';
        const updated = updateSystemPromptForTurn(promptWithoutBlock, 10, 600, 30);
        expect(updated).toContain('<session_state>');
        expect(updated).toContain('Turns remaining: 10');
    });
});
