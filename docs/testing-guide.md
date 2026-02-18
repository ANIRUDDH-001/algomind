# Testing Guide

## Quick Start

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Voice subsystem only
npm run test:voice

# AI subsystem only
npm run test:ai
```

## Test Structure

```
src/
├── test-utils/
│   └── voice-mocks.ts          # Shared browser API mocks
├── lib/
│   ├── voice/__tests__/
│   │   ├── vad-manager.test.ts  # VADManager singleton & state machine
│   │   ├── vad-utils.test.ts    # Browser support detection
│   │   ├── tts-manager.test.ts  # TTS wrapper
│   │   └── interruption-manager.test.ts
│   └── ai/__tests__/
│       ├── intent-classifier.test.ts
│       ├── response-cache.test.ts
│       └── response-chunker.test.ts
└── hooks/__tests__/
    └── useVoiceActivityDetection.test.ts
```

## Writing Tests

### Using Shared Mocks

```typescript
import {
    setupBrowserEnvironment,
    teardownBrowserEnvironment,
    createMockMicVAD,
} from '@/test-utils/voice-mocks';

beforeEach(() => setupBrowserEnvironment());
afterEach(() => teardownBrowserEnvironment());
```

### Testing VADManager Without init()

Since `init()` requires real browser scripts, bypass it by injecting mocks:

```typescript
function createInitialisedManager() {
    const manager = new VADManager();
    const mockVAD = createMockMicVAD();
    (manager as any)._state = VADState.PAUSED;
    (manager as any)._micVAD = mockVAD;
    return { manager, mockVAD };
}
```

### Node.js Gotchas

- **`navigator` is read-only** in Node — use `Object.defineProperty(globalThis, 'navigator', { value: ..., configurable: true, writable: true})`
- **No `require('vitest')`** — always use `import { vi } from 'vitest'`
- **Vitest environment** is `node` by default. Browser mocks are set up manually.

## Coverage

Configured in `vitest.config.ts`:

| Metric     | Threshold |
|------------|-----------|
| Statements | 80%       |
| Branches   | 70%       |
| Functions  | 80%       |
| Lines      | 80%       |

Run `npm run test:coverage` to generate a report. LCOV output is at `coverage/lcov.info`.
