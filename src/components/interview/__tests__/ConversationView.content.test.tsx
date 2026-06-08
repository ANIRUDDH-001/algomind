/**
 * @codesage
 * @file      src/components/interview/__tests__/ConversationView.content.test.tsx
 * @purpose   Tests for ConversationView defensive content rendering.
 * @tech      Vitest, React Testing Library
 * @connects  ../ConversationView
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None observed
 * @audit     CODESAGE-v1
 * @skip      test-file
 */
// @vitest-environment jsdom
/**
 * BUG-V7-06 Regression: ConversationView must safely render every
 * content shape variant without throwing or showing "[object Object]".
 */
// @ts-expect-error -- automated unused local suppression
import React from 'react';
// @ts-expect-error -- automated unused local suppression
import { render, screen, within } from '@testing-library/react';
// @ts-expect-error -- automated unused local suppression
import { describe, it, expect, vi, beforeAll } from 'vitest';

// ─── jsdom polyfills ───
Element.prototype.scrollIntoView = vi.fn();

// ─── Mock heavy deps used by ConversationView ───
// (ConversationView no longer imports VAD or InterruptionManager after A4 cleanup)

// ─── Import component under test ───
import { ConversationView } from '../ConversationView';

// ─── Helpers ───
const now = new Date('2026-02-21T12:00:00Z');

/** Build a message object with a given content value (typed as `any` to test defensive extraction). */
function makeMsg(role: 'user' | 'assistant', content: unknown) {
    return {
        id: `msg-${Math.random().toString(36).slice(2)}`,
        role,
        content: content as string, // cast to satisfy TS; the component handles anything at runtime
        timestamp: now,
        status: 'complete' as const,
    };
}

// ─── Tests ───
describe('ConversationView content shape variants (BUG-V7-06)', () => {
    const baseProps = {
        isAISpeaking: false,
        isProcessing: false,
    };

    it('renders plain string content verbatim', () => {
        const msg = makeMsg('assistant', 'Plain string content');
        const { container } = render(<ConversationView messages={[msg]} {...baseProps} />);

        expect(screen.getByText('Plain string content')).toBeDefined();
        expect(container.textContent).toContain('Plain string content');
        expect(container.textContent).not.toContain('[object Object]');
    });

    it('renders object with text key', () => {
        const msg = makeMsg('assistant', { text: 'Object with text key' });
        const { container } = render(<ConversationView messages={[msg]} {...baseProps} />);

        expect(screen.getByText('Object with text key')).toBeDefined();
        expect(container.textContent).not.toContain('[object Object]');
    });

    it('renders object with sentence key', () => {
        const msg = makeMsg('assistant', { sentence: 'Object with sentence key' });
        const { container } = render(<ConversationView messages={[msg]} {...baseProps} />);

        expect(screen.getByText('Object with sentence key')).toBeDefined();
        expect(container.textContent).not.toContain('[object Object]');
    });

    it('renders object with content key', () => {
        const msg = makeMsg('assistant', { content: 'Object with content key' });
        const { container } = render(<ConversationView messages={[msg]} {...baseProps} />);

        expect(screen.getByText('Object with content key')).toBeDefined();
        expect(container.textContent).not.toContain('[object Object]');
    });

    it('renders ResponseChunk-shaped object (extracts text)', () => {
        const msg = makeMsg('assistant', { id: '1', isFinal: true, text: 'ResponseChunk' });
        const { container } = render(<ConversationView messages={[msg]} {...baseProps} />);

        expect(screen.getByText('ResponseChunk')).toBeDefined();
        expect(container.textContent).not.toContain('[object Object]');
    });

    it('renders null content without throwing', () => {
        const msg = makeMsg('assistant', null);
        // Should not throw
        const { container } = render(<ConversationView messages={[msg]} {...baseProps} />);

        // Content should be empty string (not "null" or error)
        expect(container.textContent).not.toContain('[object Object]');
        expect(container.textContent).not.toContain('null');
    });

    it('renders undefined content without throwing', () => {
        const msg = makeMsg('assistant', undefined);
        const { container } = render(<ConversationView messages={[msg]} {...baseProps} />);

        expect(container.textContent).not.toContain('[object Object]');
        expect(container.textContent).not.toContain('undefined');
    });

    it('renders user message string content verbatim', () => {
        const msg = makeMsg('user', 'User message string');
        const { container } = render(<ConversationView messages={[msg]} {...baseProps} />);

        expect(screen.getByText('User message string')).toBeDefined();
        expect(container.textContent).not.toContain('[object Object]');
    });

    it('renders multiple variant messages in a single conversation', () => {
        const messages = [
            makeMsg('assistant', 'Plain string content'),
            makeMsg('assistant', { text: 'Object with text key' }),
            makeMsg('assistant', { sentence: 'Object with sentence key' }),
            makeMsg('assistant', { content: 'Object with content key' }),
            makeMsg('assistant', { id: '1', isFinal: true, text: 'ResponseChunk' }),
            makeMsg('assistant', null),
            makeMsg('assistant', undefined),
            makeMsg('user', 'User message string'),
        ];

        const { container } = render(<ConversationView messages={messages} {...baseProps} />);

        // All string extractions visible
        expect(screen.getAllByText('Plain string content').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Object with text key').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Object with sentence key').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Object with content key').length).toBeGreaterThan(0);
        expect(screen.getAllByText('ResponseChunk').length).toBeGreaterThan(0);
        expect(screen.getAllByText('User message string').length).toBeGreaterThan(0);

        // No [object Object] anywhere
        expect(container.textContent).not.toContain('[object Object]');
    });

    it('renders object with no known keys via JSON.stringify fallback', () => {
        const msg = makeMsg('assistant', { unknownKey: 'fallback-value' });
        const { container } = render(<ConversationView messages={[msg]} {...baseProps} />);

        // Should show the JSON-stringified version, not [object Object]
        expect(container.textContent).toContain('fallback-value');
        expect(container.textContent).not.toContain('[object Object]');
    });
});
