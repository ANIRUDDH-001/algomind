/**
 * @codesage
 * @file      src/lib/ai/provider-cooldown.ts
 * @purpose   Remember (provider, key, model) pairs that hit a quota so later turns skip them instead of re-paying the 429.
 * @tech      TypeScript, Upstash Redis
 * @connects  Used by src/lib/ai/client.ts (chat) and src/app/api/voice/transcribe/route.ts (STT)
 * @apis      none
 * @db        none
 * @state     One Redis JSON value per provider + 5s in-memory cache per instance
 * @env       none
 * @issues    Upstash auto-parses JSON on get — accept both object and string
 * @audit     CODESAGE-v1
 */
import { redisGet, redisSet } from '@/lib/upstash/client';

export type CooldownMap = Record<string, number>;
type Provider = 'groq' | 'gemini';

const MAX_COOLDOWN_S = 24 * 3600;
const MEMORY_TTL_MS = 5_000;
const memory = new Map<Provider, { map: CooldownMap; loadedAt: number }>();
const redisKey = (p: Provider) => `ai:cooldowns:${p}`;
const pair = (keyIndex: number, model: string) => `${keyIndex}:${model}`;

/** Test hook: forget the per-instance cache (simulates a fresh serverless instance). */
export function __resetCooldownMemory(): void { memory.clear(); }

function coerce(raw: unknown): CooldownMap {
    if (!raw) return {};
    if (typeof raw === 'string') {
        try { return JSON.parse(raw) as CooldownMap; } catch { return {}; }
    }
    if (typeof raw === 'object') return raw as CooldownMap;
    return {};
}

export async function loadCooldowns(provider: Provider): Promise<CooldownMap> {
    const cached = memory.get(provider);
    if (cached && Date.now() - cached.loadedAt < MEMORY_TTL_MS) return cached.map;
    let map: CooldownMap = { ...(cached?.map ?? {}) };
    try {
        map = { ...map, ...coerce(await redisGet(redisKey(provider))) };
    } catch { /* Redis down → memory only */ }
    const now = Date.now();
    for (const [k, until] of Object.entries(map)) if (Number(until) <= now) delete map[k];
    memory.set(provider, { map, loadedAt: now });
    return map;
}

export function isCooling(map: CooldownMap, keyIndex: number, model: string, now = Date.now()): boolean {
    return Number(map[pair(keyIndex, model)] ?? 0) > now;
}

export async function markCooldown(provider: Provider, keyIndex: number, model: string, seconds: number): Promise<void> {
    const s = Math.min(Math.max(1, Math.ceil(seconds)), MAX_COOLDOWN_S);
    const map = await loadCooldowns(provider);
    map[pair(keyIndex, model)] = Date.now() + s * 1000;
    memory.set(provider, { map, loadedAt: Date.now() });
    try {
        await redisSet(redisKey(provider), JSON.stringify(map), MAX_COOLDOWN_S);
    } catch { /* best effort */ }
    console.warn(`[PIPE][AI] cooldown ${provider} key#${keyIndex} ${model} for ${s}s`);
}

/** Groq 429s carry `retry-after` (s) and text like "Please try again in 7m12.5s". */
export function parseRetryAfterSeconds(headers: Headers, bodyText: string): number {
    const h = Number(headers.get('retry-after'));
    if (Number.isFinite(h) && h > 0) return h;
    const m = /try again in\s*(?:(\d+)h)?(?:(\d+)m)?(?:([\d.]+)s)?/i.exec(bodyText ?? '');
    if (m && (m[1] || m[2] || m[3])) return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
    return 60;
}

/** Models that must never serve a conversation (classifiers, guards, speech). */
export function isChatModel(modelId: string): boolean {
    return !/(safeguard|prompt-guard|llama-guard|whisper|orpheus|tts)/i.test(modelId);
}
