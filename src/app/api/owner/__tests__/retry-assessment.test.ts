import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

vi.mock('@/lib/auth/requireOwnerForApi');
vi.mock('@/lib/supabase/service');
vi.mock('@/lib/monitoring/events', () => ({ logSystemEvent: vi.fn() }));

import { POST } from '@/app/api/owner/retry-assessment/route';
import { requireOwnerForApi } from '@/lib/auth/requireOwnerForApi';
import { getServiceClient } from '@/lib/supabase/service';
import { logSystemEvent } from '@/lib/monitoring/events';

describe('POST /api/owner/retry-assessment', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('returns the owner guard response when unauthorized', async () => {
        const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        vi.mocked(requireOwnerForApi).mockResolvedValue({ user: null, errorResponse: response });

        const result = await POST(new Request('http://localhost:3000/api/owner/retry-assessment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ submissionId: 'sub-1' }),
        }) as any);

        expect(result.status).toBe(401);
        expect(await result.json()).toEqual({ error: 'Unauthorized' });
    });

    it('re-invokes assessment for owner users and emits an audit event', async () => {
        vi.mocked(requireOwnerForApi).mockResolvedValue({
            user: { id: 'owner-1', email: 'owner@example.com' },
            errorResponse: null,
        });

        const previousSecret = process.env.INTERNAL_API_SECRET;
        process.env.INTERNAL_API_SECRET = 'test-secret';
        try {
            const invoke = vi.fn().mockResolvedValue({ error: null });
            const chain = {
                from: vi.fn().mockReturnThis(),
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({
                    data: { question_states: [{ id: 'q1' }], integrity_flags: ['flag-a'] },
                    error: null,
                }),
                update: vi.fn().mockReturnThis(),
                functions: { invoke },
            };
            vi.mocked(getServiceClient).mockReturnValue(chain as any);

            const result = await POST(new Request('http://localhost:3000/api/owner/retry-assessment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ submissionId: 'sub-123' }),
            }) as any);

            expect(result.status).toBe(200);
            expect(await result.json()).toEqual({ success: true });
            expect(logSystemEvent).toHaveBeenCalledWith(expect.objectContaining({
                type: 'admin_action',
                userId: 'owner-1',
                metadata: expect.objectContaining({
                    route: 'owner/retry-assessment',
                    action: 'retry_assessment',
                    submissionId: 'sub-123',
                }),
            }));
            expect(invoke).toHaveBeenCalledWith('run-assessment', expect.objectContaining({
                body: expect.objectContaining({
                    submissionId: 'sub-123',
                }),
            }));
        } finally {
            process.env.INTERNAL_API_SECRET = previousSecret;
        }
    });
});