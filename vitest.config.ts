import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        // Path aliases matching tsconfig
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },

        // Default to Node environment (voice tests mock their own browser globals)
        environment: 'node',

        // Include pattern
        include: ['src/**/__tests__/**/*.test.ts', 'src/**/*.test.ts', 'src/**/__tests__/**/*.test.tsx', 'src/**/*.test.tsx'],

        // Exclude Playwright integration tests (they use Playwright's test.describe API)
        exclude: [
            'src/__tests__/integration/error-recovery.test.tsx',
            'src/__tests__/integration/feature-flags.test.tsx',
            'src/__tests__/integration/voice-interview.test.tsx',
            'node_modules/**',
        ],

        // Coverage configuration
        coverage: {
            provider: 'v8',
            reporter: ['text', 'text-summary', 'lcov', 'json-summary'],
            include: [
                'src/lib/voice/**/*.ts',
                'src/lib/ai/**/*.ts',
                'src/hooks/useVoiceActivityDetection.ts',
            ],
            exclude: [
                'src/**/__tests__/**',
                'src/**/*.test.ts',
                'src/test-utils/**',
                'src/lib/voice/types.ts',
                'src/lib/ai/types.ts',
            ],
            thresholds: {
                statements: 80,
                branches: 70,
                functions: 80,
                lines: 80,
            },
        },

        // Timeout per test
        testTimeout: 5000,
    },
});
