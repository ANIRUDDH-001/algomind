/**
 * Supabase client mock for unit tests.
 * Avoids needing a real DB connection in unit tests.
 */
// @ts-nocheck

// 


import { vi } from 'vitest';

export function createSupabaseMock(data: Record<string, unknown[]> = {}) {
    return {
        from: vi.fn((table: string) => ({
            select: vi.fn().mockReturnThis(),
            insert: vi.fn().mockReturnThis(),
            upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            neq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: data[table]?.[0] ?? null, error: null }),
            single: vi.fn().mockResolvedValue({ data: data[table]?.[0] ?? null, error: null }),
        })),
        rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
        auth: {
            getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } }, error: null }),
        },
    };
}
