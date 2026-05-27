import { describe, it, expect, beforeEach } from 'vitest';
import { InterviewStateMachine } from '../state-machine';

describe('InterviewStateMachine', () => {
    let machine: InterviewStateMachine;

    beforeEach(() => {
        machine = new InterviewStateMachine();
    });

    it('starts in idle state', () => {
        expect(machine.getState()).toBe('idle');
    });

    it('transitions to problem-intro on START', () => {
        machine.transition('START');
        expect(machine.getState()).toBe('problem-intro');
    });

    it('transitions to completed through a normal happy path', () => {
        machine.transition('START'); // problem-intro
        machine.transition('AI_FINISHED_SPEAKING'); // user-thinking
        machine.transition('MOVE_TO_SOLVING'); // user-solving
        machine.transition('SUBMIT_SOLUTION'); // solution-review
        machine.transition('FINISH_INTERVIEW'); // assessment
        machine.transition('AI_FINISHED_SPEAKING'); // completed
        expect(machine.getState()).toBe('completed');
    });

    it('handles coding workflow correctly', () => {
        machine.transition('START');
        machine.transition('AI_FINISHED_SPEAKING');
        machine.transition('MOVE_TO_SOLVING');
        
        machine.transition('USER_STARTED_CODING');
        expect(machine.getState()).toBe('user-coding');

        machine.transition('USER_SHARED_CODE');
        expect(machine.getState()).toBe('ai-feedback');

        machine.transition('USER_STARTED_CODING');
        expect(machine.getState()).toBe('user-coding');

        machine.transition('USER_STOPPED_CODING');
        expect(machine.getState()).toBe('user-solving');
    });

    it('transitions to complexity analysis from solution review', () => {
        machine.transition('START');
        machine.transition('AI_FINISHED_SPEAKING');
        machine.transition('MOVE_TO_SOLVING');
        machine.transition('SUBMIT_SOLUTION'); // solution-review
        machine.transition('MOVE_TO_COMPLEXITY');
        expect(machine.getState()).toBe('complexity-analysis');
        
        machine.transition('USER_FINISHED_SPEAKING');
        expect(machine.getState()).toBe('ai-feedback');
    });

    it('handles network disconnects and reconnects gracefully', () => {
        machine.transition('START');
        expect(machine.getState()).toBe('problem-intro');
        
        machine.transition('NETWORK_DISCONNECT');
        expect(machine.getState()).toBe('network-error');
        expect(machine.getSavedState()).toBe('problem-intro');

        machine.transition('NETWORK_RECONNECT');
        expect(machine.getState()).toBe('problem-intro');
        expect(machine.getSavedState()).toBeNull();
    });

    it('handles pause and resume gracefully', () => {
        machine.transition('START');
        machine.transition('AI_FINISHED_SPEAKING'); // user-thinking
        
        machine.transition('PAUSE_INTERVIEW');
        expect(machine.getState()).toBe('paused');
        expect(machine.getSavedState()).toBe('user-thinking');

        machine.transition('RESUME_INTERVIEW');
        expect(machine.getState()).toBe('user-thinking');
        expect(machine.getSavedState()).toBeNull();
    });

    it('ignores invalid transitions', () => {
        machine.transition('SUBMIT_SOLUTION'); // no-op from idle
        expect(machine.getState()).toBe('idle');
    });

    it('handles TERMINATE_INTERVIEW jumping to assessment', () => {
        machine.transition('START');
        machine.transition('AI_FINISHED_SPEAKING'); // user-thinking
        machine.transition('TERMINATE_INTERVIEW');
        expect(machine.getState()).toBe('assessment');
    });

    it('resets correctly to idle', () => {
        machine.transition('START');
        machine.reset();
        expect(machine.getState()).toBe('idle');
    });
});
