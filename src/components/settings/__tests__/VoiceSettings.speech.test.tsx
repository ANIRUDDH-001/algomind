/**
 * @codesage
 * @file      src/components/settings/__tests__/VoiceSettings.speech.test.tsx
 * @purpose   Voice settings: English-only voice list, preview through SpeechQueue, no onvoiceschanged clobbering.
 * @tech      Vitest, React Testing Library
 * @connects  ../VoiceSettings
 * @apis      none
 * @db        user_preferences (mocked)
 * @state     none
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

const queue = vi.hoisted(() => ({ configure: vi.fn(), stop: vi.fn(), enqueue: vi.fn(), on: vi.fn(() => () => {}) }));
vi.mock('@/lib/voice/speech-queue', () => ({ getSpeechQueue: () => queue }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/lib/supabase/user-preferences', () => ({
    getUserPreferences: vi.fn().mockResolvedValue({ preferredVoiceName: 'Google US English', voiceRate: 1.0, ttsProvider: 'auto' }),
    saveUserPreferences: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { VoiceSettings } from '../VoiceSettings';

const v = (name: string, lang: string) => ({ name, lang, default: false, localService: true, voiceURI: name }) as SpeechSynthesisVoice;

describe('VoiceSettings speech', () => {
    let synth: { getVoices: () => SpeechSynthesisVoice[]; addEventListener: ReturnType<typeof vi.fn>; removeEventListener: ReturnType<typeof vi.fn>; onvoiceschanged: null; speak: ReturnType<typeof vi.fn>; cancel: ReturnType<typeof vi.fn> };
    beforeEach(() => {
        vi.clearAllMocks();
        synth = {
            getVoices: () => [v('Google US English', 'en-US'), v('Microsoft Hemant - Hindi (India)', 'hi-IN'), v('Google UK English Female', 'en-GB')],
            addEventListener: vi.fn(), removeEventListener: vi.fn(), onvoiceschanged: null, speak: vi.fn(), cancel: vi.fn(),
        };
        Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true, writable: true });
    });
    afterEach(cleanup);

    it('listens for voiceschanged with addEventListener and never assigns onvoiceschanged', () => {
        render(<VoiceSettings inline />);
        expect(synth.addEventListener).toHaveBeenCalledWith('voiceschanged', expect.any(Function));
        expect(synth.onvoiceschanged).toBeNull();
    });

    it('previews through the SpeechQueue with the selected voice, never speechSynthesis directly', async () => {
        render(<VoiceSettings inline />);
        const btn = await screen.findByRole('button', { name: /test voice/i });
        await waitFor(() => expect((btn as HTMLButtonElement).disabled).toBe(false));
        fireEvent.click(btn);
        expect(queue.configure).toHaveBeenCalledWith(expect.objectContaining({ preferredVoiceName: 'Google US English' }));
        expect(queue.enqueue).toHaveBeenCalledWith(expect.stringMatching(/Hello/));
        expect(synth.speak).not.toHaveBeenCalled();
        expect(synth.cancel).not.toHaveBeenCalled();
    });
});
