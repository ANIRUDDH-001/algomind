/**
 * @codesage
 * @file      src/hooks/__tests__/useGlobalFeatureFlag.override.test.ts
 * @purpose   Localhost-only flag override (voice live run turns ENABLE_VOICE_MODE on without touching the global row).
 * @tech      Vitest, React Testing Library
 * @connects  ../useGlobalFeatureFlag (fresh module per test — it caches flags at module level)
 * @apis      GET /api/flags (mocked)
 * @db        none
 * @state     none
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
// @vitest-environment jsdom
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const serverFlags = { ENABLE_VOICE_MODE: { value: false, description: '' } };

async function freshHook() {
    vi.resetModules();
    return import('../useGlobalFeatureFlag');
}

describe('useGlobalFeatureFlag local override', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(serverFlags), { status: 200 })));
    });
    afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); });

    it('on localhost, algomind.flagOverride.<FLAG> beats the global flag', async () => {
        expect(window.location.hostname).toBe('localhost');
        localStorage.setItem('algomind.flagOverride.ENABLE_VOICE_MODE', 'true');
        const { useGlobalFeatureFlag } = await freshHook();
        const { result } = renderHook(() => useGlobalFeatureFlag('ENABLE_VOICE_MODE', false));
        await waitFor(() => expect(result.current).toBe(true));
    });

    it('without an override the global flag wins', async () => {
        const { useGlobalFeatureFlag } = await freshHook();
        const { result } = renderHook(() => useGlobalFeatureFlag('ENABLE_VOICE_MODE', true));
        await waitFor(() => expect(result.current).toBe(false));
    });

    it('is ignored on any non-local host (production users cannot flip flags)', async () => {
        const { readLocalFlagOverride } = await freshHook();
        const storage = { getItem: (k: string) => (k === 'algomind.flagOverride.ENABLE_VOICE_MODE' ? 'true' : null) };
        expect(readLocalFlagOverride('ENABLE_VOICE_MODE', 'algomind.app', storage)).toBeNull();
        expect(readLocalFlagOverride('ENABLE_VOICE_MODE', 'localhost.evil.com', storage)).toBeNull();
        expect(readLocalFlagOverride('ENABLE_VOICE_MODE', '127.0.0.1', storage)).toBe(true);
        expect(readLocalFlagOverride('ENABLE_VOICE_MODE', 'app.localhost', storage)).toBe(true);
        expect(readLocalFlagOverride('ENABLE_VOICE_MODE', 'localhost', { getItem: () => 'yes' })).toBeNull();
        expect(readLocalFlagOverride('ENABLE_VOICE_MODE', 'localhost', { getItem: () => { throw new Error('blocked'); } })).toBeNull();
    });
});
