// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { VoiceSettings } from '../VoiceSettings';
import React from 'react';


// We'll set this up in beforeEach
global.fetch = vi.fn();

// Mock user-preferences
vi.mock('@/lib/supabase/user-preferences', () => ({
    getUserPreferences: vi.fn().mockResolvedValue({
        preferredVoiceName: null,
        preferredVoiceLang: 'en-US',
        voiceRate: 1.0,
        hinglishEnabled: false,
    }),
    saveUserPreferences: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/components/auth/AuthProvider', () => ({
    useAuth: vi.fn().mockReturnValue({ user: { id: 'test-user' } }),
}));

// Mock ResizeObserver
global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
};

// Mock SpeechSynthesis
Object.defineProperty(window, 'speechSynthesis', {
    value: {
        getVoices: vi.fn().mockReturnValue([{ name: 'Google US English', lang: 'en-US' }]),
        onvoiceschanged: null,
        cancel: vi.fn(),
        speak: vi.fn(),
    },
    writable: true,
});

describe('VoiceSettings — Hinglish Toggle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        
        // Reset fetch mock for true
        (global.fetch as any).mockImplementation((url: string) => {
            if (url === '/api/flags') {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ ENABLE_HINGLISH_SUPPORT: true }),
                });
            }
            return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
        });

        // Ensure getVoices returns voices immediately so loadPrefs is triggered
        (window.speechSynthesis.getVoices as any).mockReturnValue([
            { name: 'Google US English', lang: 'en-US' }
        ]);
    });

    afterEach(() => {
        cleanup();
    });

    it('shows Hinglish toggle when global flag is ON', async () => {
        render(<VoiceSettings />);
        await waitFor(() => {
            expect(screen.getByText(/Hinglish Mode/i)).toBeDefined();
        });
    });

    it('hides Hinglish toggle when global flag is OFF', async () => {
        (global.fetch as any).mockImplementation((url: string) => {
            if (url === '/api/flags') {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ ENABLE_HINGLISH_SUPPORT: false }),
                });
            }
        });
        render(<VoiceSettings />);
        await waitFor(() => {
            expect(screen.queryByText(/Hinglish Mode/i)).toBeNull();
        });
    });

    it('toggles state when clicked', async () => {
        render(<VoiceSettings />);
        // Find and click the toggle
        await waitFor(() => screen.getByText('Kai speaks in English'));
        fireEvent.click(screen.getByText('Kai speaks in English'));
        expect(screen.getByText('Kai speaks in Hinglish 🔊')).toBeDefined();
    });

    it('passes hinglishEnabled to saveUserPreferences on save', async () => {
        const { saveUserPreferences } = await import('@/lib/supabase/user-preferences');
        render(<VoiceSettings />);
        await waitFor(() => screen.getByText(/Hinglish Mode/i));
        
        // Toggle on
        fireEvent.click(screen.getByText('Kai speaks in English'));
        // Save
        fireEvent.click(screen.getByText('Save Settings'));
        
        await waitFor(() => {
            expect(saveUserPreferences).toHaveBeenCalledWith(
                'test-user',
                expect.objectContaining({ hinglishEnabled: true })
            );
        });
    });
});
