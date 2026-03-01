// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/feature-flags', () => ({
    getFeatureFlag: vi.fn(() => false),
    setFeatureFlag: vi.fn(),
    checkBrowserSupport: vi.fn(() => true),
    FEATURE_FLAGS: {
        ENABLE_WHISPER_STT: { storageKey: 'ff_whisper_stt', default: false },
        ENABLE_VAD_INTERRUPTIONS: { storageKey: 'ff_vad', default: true },
    },
}));

import { useFeatureFlag } from '../useFeatureFlag';

describe('useFeatureFlag — smoke', () => {
    it('returns enabled property', () => {
        const { result } = renderHook(() => useFeatureFlag('ENABLE_WHISPER_STT'));
        expect(result.current).toHaveProperty('enabled');
    });

    it('returns toggle function', () => {
        const { result } = renderHook(() => useFeatureFlag('ENABLE_WHISPER_STT'));
        expect(typeof result.current.toggle).toBe('function');
    });
});
