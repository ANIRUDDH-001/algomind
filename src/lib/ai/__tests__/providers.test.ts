import { describe, expect, test } from 'vitest';
import {
    CHAT_MODELS,
    EMBEDDING_MODELS,
    getModelConfig,
    getModelsByProvider,
    getModelsUpToTier,
    getTotalDailyCapacity,
    getTotalRPMCapacity
} from '../providers';

describe('providers', () => {
    test('CHAT_MODELS and EMBEDDING_MODELS exist', () => {
        expect(CHAT_MODELS.length).toBeGreaterThan(0);
        expect(EMBEDDING_MODELS.length).toBeGreaterThan(0);
    });

    test('getModelConfig', () => {
        const firstModel = CHAT_MODELS[0];
        expect(getModelConfig(firstModel.id)).toEqual(firstModel);
        expect(getModelConfig('non-existent')).toBeUndefined();
    });

    test('getModelsByProvider', () => {
        const groqModels = getModelsByProvider('groq');
        expect(groqModels.every(m => m.provider === 'groq')).toBe(true);
    });

    test('getModelsUpToTier', () => {
        const tier3 = getModelsUpToTier(3);
        expect(tier3.every(m => m.tier <= 3)).toBe(true);
    });

    test('getTotalDailyCapacity and getTotalRPMCapacity', () => {
        const totalRpd = getTotalDailyCapacity();
        let expectedRpd = 0;
        CHAT_MODELS.forEach(m => { expectedRpd += m.rpd });
        expect(totalRpd).toBe(expectedRpd);

        const totalRpm = getTotalRPMCapacity();
        let expectedRpm = 0;
        CHAT_MODELS.forEach(m => { expectedRpm += m.rpm });
        expect(totalRpm).toBe(expectedRpm);
    });
});
