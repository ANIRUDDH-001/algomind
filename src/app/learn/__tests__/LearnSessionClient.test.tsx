/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LearnSessionPageClient from '../[slug]/LearnSessionPageClient';
import { tagsToFirstConceptSlug } from '@/lib/knowledge-graph/tag-concept-map';
import { ALL_DSA_CONCEPT_SLUGS } from '@/types/knowledge-graph';

const hoisted = vi.hoisted(() => {
    const push = vi.fn();

    const session = {
        state: 'active' as 'idle' | 'starting' | 'active' | 'ending' | 'complete' | 'error',
        transcript: [] as Array<{ id: string; role: 'user' | 'assistant'; content: string; at?: string }>,
        sessionId: 'session-1',
        results: null,
        error: null as string | null,
        kaiTyping: false,
        startSession: vi.fn(),
        sendMessage: vi.fn(),
        endSession: vi.fn(),
        reset: vi.fn(),
    };

    const tts = {
        speak: vi.fn().mockResolvedValue(undefined),
        speakAndWait: vi.fn().mockResolvedValue(true),
        stop: vi.fn(),
        isSpeaking: false,
        provider: 'browser',
    };

    const vad = {
        mode: 'push-to-talk' as 'onnx' | 'push-to-talk',
        isListening: false,
        isReady: true,
        startListening: vi.fn(),
        stopListening: vi.fn(),
    };

    const stt = {
        isListening: false,
        transcript: '',
        interimTranscript: '',
        isTranscribing: false,
        startListening: vi.fn(),
        stopListening: vi.fn(),
        resetTranscript: vi.fn(),
        transcribeAudio: vi.fn(),
        resolvedProvider: 'whisper',
        permissionState: 'unknown',
    };

    return { push, session, tts, vad, stt };
});

// jsdom polyfills
global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
};

Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});

Element.prototype.scrollIntoView = vi.fn();

vi.mock('next/link', () => ({
    default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
        <a href={href} {...rest}>{children}</a>
    ),
}));

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: hoisted.push }),
}));

vi.mock('@/components/upgrade/UpgradeModal', () => ({
    UpgradeModal: () => null,
}));

vi.mock('@/components/voice/ZoomTranscript', () => ({
    ZoomTranscript: () => <div data-testid="zoom-transcript" />,
}));

vi.mock('@/components/voice/VoiceModeToggle', () => ({
    VoiceModeToggle: ({ onToggle }: { onToggle: (next: boolean) => void }) => (
        <button data-testid="voice-mode-toggle" onClick={() => onToggle(false)}>toggle</button>
    ),
}));

vi.mock('@/hooks/useLearnSession', () => ({
    useLearnSession: () => hoisted.session,
}));

vi.mock('@/hooks/useTTS', () => ({
    useTTS: () => hoisted.tts,
}));

vi.mock('@/hooks/useVAD', () => ({
    useVAD: () => hoisted.vad,
}));

vi.mock('@/hooks/useSTT', () => ({
    useSTT: () => hoisted.stt,
}));

describe('LearnSessionPageClient', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        hoisted.session.state = 'active';
        hoisted.session.transcript = [];
        hoisted.session.error = null;
        hoisted.session.kaiTyping = false;

        hoisted.vad.mode = 'push-to-talk';
        hoisted.vad.isListening = false;

        hoisted.stt.isListening = false;
        hoisted.stt.transcript = '';
        hoisted.stt.interimTranscript = '';
        hoisted.stt.isTranscribing = false;
    });

    afterEach(() => {
        cleanup();
    });

    describe('Text input', () => {
        it('renders text input', () => {
            render(<LearnSessionPageClient slug="arrays-strings" />);
            expect(screen.getByTestId('text-input')).toBeInTheDocument();
        });

        it('send button disabled when input empty', () => {
            render(<LearnSessionPageClient slug="arrays-strings" />);
            expect(screen.getByTestId('send-text-button')).toBeDisabled();
        });

        it('Enter key submits text', async () => {
            render(<LearnSessionPageClient slug="arrays-strings" />);

            const input = screen.getByTestId('text-input');
            fireEvent.change(input, { target: { value: 'Two pointers is my answer' } });
            fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', shiftKey: false });

            await waitFor(() => {
                expect(hoisted.session.sendMessage).toHaveBeenCalledWith('Two pointers is my answer');
            });
        });

        it('send button submits and clears input', async () => {
            render(<LearnSessionPageClient slug="arrays-strings" />);

            const input = screen.getByTestId('text-input') as HTMLTextAreaElement;
            fireEvent.change(input, { target: { value: 'Sliding window' } });
            fireEvent.click(screen.getByTestId('send-text-button'));

            await waitFor(() => {
                expect(hoisted.session.sendMessage).toHaveBeenCalledWith('Sliding window');
            });
            expect(input.value).toBe('');
        });
    });

    describe('Mic button', () => {
        it('renders mic button', () => {
            render(<LearnSessionPageClient slug="arrays-strings" />);
            expect(screen.getByTestId('send-button')).toBeInTheDocument();
        });

        it('mic button disabled when session not active', () => {
            hoisted.session.state = 'starting';
            render(<LearnSessionPageClient slug="arrays-strings" />);
            expect(screen.getByTestId('send-button')).toBeDisabled();
        });

        it('mic button starts STT in push-to-talk mode', async () => {
            hoisted.vad.mode = 'push-to-talk';
            hoisted.vad.isListening = false;

            render(<LearnSessionPageClient slug="arrays-strings" />);
            fireEvent.click(screen.getByTestId('send-button'));

            await waitFor(() => {
                expect(hoisted.stt.resetTranscript).toHaveBeenCalledTimes(1);
                expect(hoisted.stt.startListening).toHaveBeenCalledTimes(1);
            });
        });

        it('mic button disabled while Kai is thinking', () => {
            hoisted.session.kaiTyping = true;
            render(<LearnSessionPageClient slug="arrays-strings" />);
            expect(screen.getByTestId('send-button')).toBeDisabled();
        });
    });

    describe('useEffect double-start fix', () => {
        it('startSession called exactly once on mount', async () => {
            hoisted.session.state = 'idle';
            render(<LearnSessionPageClient slug="arrays-strings" />);

            await waitFor(() => {
                expect(hoisted.session.startSession).toHaveBeenCalledTimes(1);
            });
        });
    });
});

describe('tagsToFirstConceptSlug', () => {
    it('derives conceptSlug from problem tags', () => {
        // Test with arrays tag
        const result1 = tagsToFirstConceptSlug(['arrays', 'hashing'], null);
        expect(result1).toBeTruthy();
        expect(typeof result1).toBe('string');
        expect(result1.length).toBeGreaterThan(0);
        expect(ALL_DSA_CONCEPT_SLUGS.includes(result1)).toBe(true);

        // Test with hashing tag
        const result2 = tagsToFirstConceptSlug(['hashing'], null);
        expect(result2).toBeTruthy();
        expect(typeof result2).toBe('string');
        expect(ALL_DSA_CONCEPT_SLUGS.includes(result2)).toBe(true);

        // Test with empty tags falls back to null (component would use problem.id)
        const result3 = tagsToFirstConceptSlug([], null);
        expect(result3).toBeNull();
    });
});
