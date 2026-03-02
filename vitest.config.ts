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
            // ── Scope ─────────────────────────────────────────────────
            // Cover all source files, not just voice/ai.
            include: ['src/**/*.ts', 'src/**/*.tsx'],
            exclude: [
                'src/**/__tests__/**',
                'src/**/*.test.ts',
                'src/**/*.test.tsx',
                'src/test-utils/**',
                'src/components/ui/**',         // shadcn primitives
                'src/data/**',                  // static JSON/MD data
                'src/types/**',                 // TypeScript type-only files
                'src/app/**/layout.tsx',        // Next.js layouts (tested via E2E)
                'src/app/**/page.tsx',          // Next.js pages (tested via E2E)
                'src/scripts/**',
                'src/lib/voice/types.ts',
                'src/lib/ai/types.ts',
            ],
            // ── Thresholds ────────────────────────────────────────────
            // Intentionally conservative first pass.
            // Raise by 5% per quarter as coverage improves.
            thresholds: {
                statements: 30,
                branches: 20,
                functions: 30,
                lines: 30,
                'src/lib/assessment/': { lines: 85, functions: 90 },
                'src/lib/interview/': { lines: 80, functions: 85 },
                'src/lib/spaced-repetition/': { lines: 85, functions: 90 },
                'src/lib/rag/': { lines: 75, functions: 80 },
                'src/lib/recommendations/': { lines: 75, functions: 80 },
                'src/lib/ai/memory-generator': { lines: 80, functions: 85 },
            },
        },

        // Timeout per test
        testTimeout: 5000,
    },
});
