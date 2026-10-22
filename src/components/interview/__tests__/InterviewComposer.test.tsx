/**
 * @codesage
 * @file      src/components/interview/__tests__/InterviewComposer.test.tsx
 * @purpose   Tests for the typed answer box used in text-only interviews and "Type instead".
 * @tech      Vitest, React Testing Library
 * @connects  ../InterviewComposer
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None observed
 * @audit     CODESAGE-v1
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { InterviewComposer } from '../InterviewComposer';

describe('InterviewComposer', () => {
    beforeEach(() => sessionStorage.clear());
    afterEach(cleanup);

    it('sends trimmed text on Enter and clears the box', () => {
        const onSend = vi.fn();
        render(<InterviewComposer onSend={onSend} />);
        const box = screen.getByRole('textbox', { name: /your answer/i });
        fireEvent.change(box, { target: { value: '  use a hash map  ' } });
        fireEvent.keyDown(box, { key: 'Enter' });
        expect(onSend).toHaveBeenCalledWith('use a hash map');
        expect((box as HTMLTextAreaElement).value).toBe('');
    });

    it('Shift+Enter inserts a newline instead of sending', () => {
        const onSend = vi.fn();
        render(<InterviewComposer onSend={onSend} />);
        const box = screen.getByRole('textbox', { name: /your answer/i });
        fireEvent.change(box, { target: { value: 'line one' } });
        fireEvent.keyDown(box, { key: 'Enter', shiftKey: true });
        expect(onSend).not.toHaveBeenCalled();
    });

    it('does not send while disabled or when empty', () => {
        const onSend = vi.fn();
        const { rerender } = render(<InterviewComposer onSend={onSend} disabled />);
        const box = screen.getByRole('textbox', { name: /your answer/i });
        fireEvent.change(box, { target: { value: 'x' } });
        fireEvent.keyDown(box, { key: 'Enter' });
        rerender(<InterviewComposer onSend={onSend} />);
        fireEvent.change(box, { target: { value: '   ' } });
        fireEvent.click(screen.getByRole('button', { name: /send/i }));
        expect(onSend).not.toHaveBeenCalled();
    });
});
