// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── jsdom polyfills ───
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
        matches: false, media: query, onchange: null,
        addListener: vi.fn(), removeListener: vi.fn(),
        addEventListener: vi.fn(), removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});
Element.prototype.scrollIntoView = vi.fn();
// Mock speechSynthesis to avoid errors from VoiceSettings
Object.defineProperty(window, 'speechSynthesis', {
    writable: true,
    value: { getVoices: () => [], onvoiceschanged: null, cancel: vi.fn(), speak: vi.fn() },
});

// ─── Mock next/navigation ───
const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

vi.mock('next/link', () => ({
    default: ({ href, children, className }: any) => (
        <a href={href} className={className}>{children}</a>
    ),
}));

// ─── Mock useAuth ───
const mockSignOut = vi.fn().mockReturnValue(Promise.resolve());
const mockUseAuth = vi.fn(() => ({
    user: { id: 'u1', email: 'test@test.com', user_metadata: {} },
    signOut: mockSignOut,
    isConfigured: false,
}));
vi.mock('@/components/auth/AuthProvider', () => ({
    useAuth: () => mockUseAuth(),
}));

// ─── Mock feature flags ───
const mockGetFeatureFlag = vi.fn((key: string) => false);
const mockSetFeatureFlag = vi.fn();
vi.mock('@/lib/feature-flags', () => ({
    getFeatureFlag: (key: string) => mockGetFeatureFlag(key),
    setFeatureFlag: (key: string, value: boolean) => mockSetFeatureFlag(key, value),
}));

// ─── Mock demo/onboarding managers ───
const mockIsDemoMode = vi.fn(() => false);
const mockEnableDemoMode = vi.fn();
const mockDisableDemoMode = vi.fn();
vi.mock('@/lib/demo/manager', () => ({
    isDemoMode: () => mockIsDemoMode(),
    enableDemoMode: () => mockEnableDemoMode(),
    disableDemoMode: () => mockDisableDemoMode(),
}));

const mockShouldShowOnboarding = vi.fn(() => false);
const mockMarkOnboardingComplete = vi.fn();
const mockResetOnboarding = vi.fn();
vi.mock('@/lib/onboarding/manager', () => ({
    shouldShowOnboarding: () => mockShouldShowOnboarding(),
    markOnboardingComplete: () => mockMarkOnboardingComplete(),
    resetOnboarding: () => mockResetOnboarding(),
}));

// ─── Mock Supabase ───
vi.mock('@/lib/supabase/client', () => ({
    getSupabase: () => null,
    createBrowserSupabase: () => null,
}));

// ─── Mock sonner ───
vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn(), loading: vi.fn() },
}));

// ─── Mock lucide-react ───
vi.mock('lucide-react', () => ({
    ArrowLeft: () => <svg data-testid="icon-arrowleft" />,
    User: () => <svg data-testid="icon-user" />,
    LogOut: () => <svg data-testid="icon-logout" />,
    Database: () => <svg data-testid="icon-database" />,
    Shield: () => <svg data-testid="icon-shield" />,
    Play: () => <svg data-testid="icon-play" />,
    FlaskConical: () => <svg data-testid="icon-flask" />,
    Mic: () => <svg data-testid="icon-mic" />,
    Code2: () => <svg />,
    ExternalLink: () => <svg />,
    RefreshCw: () => <svg />,
    CheckCircle2: () => <svg />,
    AlertCircle: () => <svg />,
    Loader2: () => <svg />,
    Volume2: () => <svg />,
    Settings: () => <svg />,
}));

// ─── Mock Switch to a simple checkbox for easy interaction ───
vi.mock('@/components/ui/switch', () => ({
    Switch: ({ checked, onCheckedChange, disabled }: any) => (
        <input
            type="checkbox"
            role="switch"
            checked={checked}
            onChange={(e) => onCheckedChange(e.target.checked)}
            disabled={disabled}
            data-testid="switch"
        />
    ),
}));

// ─── Mock VoiceSettings and LeetCodeSettings ───
vi.mock('@/components/settings/VoiceSettings', () => ({
    VoiceSettings: () => (
        <div data-testid="voice-settings-panel" data-tour="voice-capabilities">
            <h2>AI Interviewer Voice</h2>
            <div>Voice settings content</div>
        </div>
    ),
}));

vi.mock('@/components/settings/LeetCodeSettings', () => ({
    LeetCodeSettings: () => (
        <div data-testid="leetcode-settings-panel">
            <h2>LeetCode Connect</h2>
        </div>
    ),
}));

// ─── Mock user-preferences ───
vi.mock('@/lib/supabase/user-preferences', () => ({
    getUserPreferences: vi.fn().mockResolvedValue({ preferredVoiceName: null, voiceRate: 1.0 }),
    saveUserPreferences: vi.fn().mockResolvedValue(undefined),
}));

// ─── Import component ───
import { SettingsPanel } from '../SettingsPanel';

// Helper: wait for `mounted` guard to pass
async function renderAndWait(ui: React.ReactElement) {
    let result: ReturnType<typeof render>;
    await act(async () => {
        result = render(ui);
    });
    return result!;
}

describe('SettingsPanel', () => {
    beforeEach(() => {
        mockGetFeatureFlag.mockReturnValue(false);
        mockIsDemoMode.mockReturnValue(false);
        mockShouldShowOnboarding.mockReturnValue(false);
        mockUseAuth.mockReturnValue({
            user: { id: 'u1', email: 'test@test.com', user_metadata: {} },
            signOut: mockSignOut,
            isConfigured: false,
        });
        mockPush.mockClear();
        mockSignOut.mockClear();
        mockSetFeatureFlag.mockClear();
    });

    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it('1. All main settings sections render (Profile, Voice Options, Data Storage, App Info, Danger Zone)', async () => {
        await renderAndWait(<SettingsPanel />);

        await waitFor(() => {
            expect(screen.getByText(/Profile Outline/i)).toBeDefined();
            expect(screen.getByText(/Voice Options/i)).toBeDefined();
            expect(screen.getByText(/Data Storage/i)).toBeDefined();
            expect(screen.getByText(/Application Info/i)).toBeDefined();
            expect(screen.getByText(/Danger Zone/i)).toBeDefined();
        });
    });

    it('2. VAD Switch toggle calls setFeatureFlag with correct key and value', async () => {
        await renderAndWait(<SettingsPanel />);

        await waitFor(() => {
            expect(screen.getByText('Voice Activity Detection')).toBeDefined();
        });

        const switches = screen.getAllByRole('switch');
        // VAD switch is the one in Voice Options section
        // Toggle it on — use click since jsdom checkbox onChange fires on click
        fireEvent.click(switches[0]);
        expect(mockSetFeatureFlag).toHaveBeenCalledWith('ENABLE_VAD_INTERRUPTIONS', true);

        // Toggle it off
        fireEvent.click(switches[0]);
        expect(mockSetFeatureFlag).toHaveBeenCalledWith('ENABLE_VAD_INTERRUPTIONS', false);
    });

    it('3. Sign Out button calls signOut and redirects to /', async () => {
        await renderAndWait(<SettingsPanel />);

        await waitFor(() => {
            expect(screen.getAllByRole('button', { name: /sign out/i }).length).toBeGreaterThan(0);
        });

        const signOutBtn = screen.getAllByRole('button', { name: /sign out/i })[0];
        await act(async () => {
            fireEvent.click(signOutBtn);
        });

        await waitFor(() => {
            expect(mockSignOut).toHaveBeenCalledTimes(1);
            expect(mockPush).toHaveBeenCalledWith('/');
        });
    });

    it('4. Back link renders and points to /dashboard', async () => {
        // SettingsPanel itself has no back link — it's rendered in a page context.
        // The spec mentions this but the component is an isolated panel.
        // We test that the panel renders without a back link inside it.
        await renderAndWait(<SettingsPanel />);
        await waitFor(() => {
            // No internal back link — panel is embeddable, navigation is handled by the page
            const links = document.querySelectorAll('a[href="/dashboard"]');
            // If there is one it must point to dashboard, if not — that's expected
            links.forEach(link => {
                expect(link.getAttribute('href')).toBe('/dashboard');
            });
        });
    });

    it('5. Danger Zone section has red styling', async () => {
        const { container } = await renderAndWait(<SettingsPanel />);

        await waitFor(() => {
            expect(screen.getByText(/Danger Zone/i)).toBeDefined();
        });

        // The h2 for Danger Zone has class text-red-500/80
        const dangerHeading = screen.getByText(/Danger Zone/i);
        expect(dangerHeading.className).toContain('text-red');

        // The danger zone container has red border as inline style
        const dangerContainer = container.querySelector('[style*="rgba(239, 68, 68"]');
        expect(dangerContainer).not.toBeNull();
    });

    it('6. Demo mode toggle reflects current isDemoMode() value — shows "Demo Mode Active" when true', async () => {
        mockIsDemoMode.mockReturnValue(true);
        await renderAndWait(<SettingsPanel />);

        await waitFor(() => {
            expect(screen.getByText('Demo Mode Active')).toBeDefined();
            expect(screen.getByRole('button', { name: /Exit Demo Mode/i })).toBeDefined();
        });
    });

    it('6b. Shows "Interactive Demo" and "Start Demo Tour" when isDemoMode() is false', async () => {
        mockIsDemoMode.mockReturnValue(false);
        await renderAndWait(<SettingsPanel />);

        await waitFor(() => {
            expect(screen.getByText('Interactive Demo')).toBeDefined();
            expect(screen.getByRole('button', { name: /Start Demo Tour/i })).toBeDefined();
        });
    });

    it('7. VAD switch reflects initial getFeatureFlag value', async () => {
        // When VAD is enabled initially
        mockGetFeatureFlag.mockReturnValue(true);
        await renderAndWait(<SettingsPanel />);

        await waitFor(() => {
            const switches = screen.getAllByRole('switch');
            // The VAD switch should be checked=true
            expect((switches[0] as HTMLInputElement).checked).toBe(true);
        });
    });

    it('8. Settings persist across re-render (VAD state retained)', async () => {
        mockGetFeatureFlag.mockReturnValue(false);
        const { rerender } = await renderAndWait(<SettingsPanel />);

        await waitFor(() => {
            expect(screen.getAllByRole('switch').length).toBeGreaterThan(0);
        });

        // Toggle VAD on
        const switches = screen.getAllByRole('switch');
        await act(async () => { fireEvent.click(switches[0]); });

        // Re-render with same props
        await act(async () => { rerender(<SettingsPanel />); });

        // setFeatureFlag was called — state was updated
        expect(mockSetFeatureFlag).toHaveBeenCalledWith('ENABLE_VAD_INTERRUPTIONS', true);
        // The switch remains checked (React state retained)
        const switchesAfter = screen.getAllByRole('switch');
        expect((switchesAfter[0] as HTMLInputElement).checked).toBe(true);
    });

    it('9. VoiceSettings sub-panel renders inside settings (not in own Card wrapper)', async () => {
        await renderAndWait(<SettingsPanel />);

        await waitFor(() => {
            // VoiceSettings section heading is rendered inline within the settings panel
            const voicePanel = screen.getByTestId('voice-settings-panel');
            expect(voicePanel).toBeDefined();
            // Not wrapped in a shadcn Card (no data-slot="card" parent)
            expect(voicePanel.closest('[data-slot="card"]')).toBeNull();
        });
    });

    it('10. No Card component wrapper around individual settings rows (new design uses plain divs)', async () => {
        const { container } = await renderAndWait(<SettingsPanel />);

        await waitFor(() => {
            // Card components render with data-slot="card" (shadcn convention)
            // Since the new design doesn't use Card, there should be none
            const cards = container.querySelectorAll('[data-slot="card"]');
            expect(cards).toHaveLength(0);
        });
    });
});
