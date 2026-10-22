/**
 * @codesage
 * @file      src/lib/ai/key-pool.ts
 * @purpose   API key pools (comma-list env) + round-robin cursor, shared by the chat client and the STT route.
 * @tech      TypeScript
 * @connects  src/lib/ai/client.ts, src/app/api/voice/transcribe/route.ts
 * @apis      none
 * @db        none
 * @state     Module-level round-robin cursor
 * @env       GROQ_API_KEYS, GROQ_API_KEY, GEMINI_API_KEYS, GEMINI_API_KEY, GOOGLE_API_KEY
 * @issues    none
 * @audit     CODESAGE-v1
 */

// Free-tier providers rate-limit per API key. Supplying several keys via the
// *_API_KEYS comma-list env spreads load across them (each key has its own
// RPM/RPD budget), multiplying throughput. Single-key setups keep working via
// the legacy *_API_KEY fallback.
export function parseKeyPool(...envValues: (string | undefined)[]): string[] {
    const keys: string[] = [];
    for (const v of envValues) {
        if (!v) continue;
        for (const raw of v.split(',')) {
            const k = raw.trim();
            if (k && !keys.includes(k)) keys.push(k);
        }
    }
    return keys;
}

export function groqKeyPool(): string[] {
    return parseKeyPool(process.env.GROQ_API_KEYS, process.env.GROQ_API_KEY);
}

export function geminiKeyPool(): string[] {
    return parseKeyPool(process.env.GEMINI_API_KEYS, process.env.GEMINI_API_KEY, process.env.GOOGLE_API_KEY);
}

let groqCursor = 0;

/** Round-robin starting key index for a (model x key) failover sweep. */
export function nextGroqKeyStart(poolSize: number): number {
    if (poolSize <= 0) return 0;
    const start = groqCursor % poolSize;
    groqCursor = (groqCursor + 1) % poolSize;
    return start;
}
