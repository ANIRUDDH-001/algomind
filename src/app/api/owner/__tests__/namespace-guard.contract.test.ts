import { describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

vi.mock('@/lib/auth/requireOwnerForApi');
vi.mock('@/lib/supabase/server');
vi.mock('@/lib/supabase/service');
vi.mock('@/lib/monitoring/events', () => ({ logSystemEvent: vi.fn() }));

import { requireOwnerForApi } from '@/lib/auth/requireOwnerForApi';
import { GET as getUsers, PATCH as patchUsers } from '@/app/api/owner/users/route';
import { GET as getModelRouting, POST as postModelRouting, PATCH as patchModelRouting, DELETE as deleteModelRouting } from '@/app/api/owner/model-routing/route';
import { PATCH as patchFlags } from '@/app/api/owner/flags/route';
import { GET as getAwsUsage } from '@/app/api/owner/aws-usage/route';
import { POST as postRetryAssessment } from '@/app/api/owner/retry-assessment/route';

function deny(status: 401 | 403) {
    const response = NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status });
    vi.mocked(requireOwnerForApi).mockResolvedValue({ user: null, errorResponse: response });
    return response;
}

function makeRequest(url: string, method: string, body?: Record<string, unknown>) {
    return new Request(`http://localhost:3000${url}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
    });
}

describe('owner namespace guard contract', () => {
    it('GET /api/owner/users returns the shared owner auth response', async () => {
        const response = deny(401);
        const result = await getUsers(makeRequest('/api/owner/users', 'GET') as any);

        expect(result.status).toBe(401);
        expect(result).toBe(response);
    });

    it('PATCH /api/owner/users returns the shared owner auth response', async () => {
        const response = deny(403);
        const result = await patchUsers(makeRequest('/api/owner/users', 'PATCH', { userId: 'u1' }) as any);

        expect(result.status).toBe(403);
        expect(result).toBe(response);
    });

    it('GET /api/owner/model-routing returns the shared owner auth response', async () => {
        const response = deny(401);
        const result = await getModelRouting();

        expect(result.status).toBe(401);
        expect(result).toBe(response);
    });

    it('POST /api/owner/model-routing returns the shared owner auth response', async () => {
        deny(403);
        const result = await postModelRouting(makeRequest('/api/owner/model-routing', 'POST', { model_id: 'x', provider: 'y', use_case: 'chat' }) as any);

        expect(result.status).toBe(403);
    });

    it('PATCH /api/owner/model-routing returns the shared owner auth response', async () => {
        deny(403);
        const result = await patchModelRouting(makeRequest('/api/owner/model-routing', 'PATCH', { id: 'row-1' }) as any);

        expect(result.status).toBe(403);
    });

    it('DELETE /api/owner/model-routing returns the shared owner auth response', async () => {
        deny(401);
        const result = await deleteModelRouting(makeRequest('/api/owner/model-routing', 'DELETE', { id: 'r1' }) as any);

        expect(result.status).toBe(401);
    });

    it('PATCH /api/owner/flags returns the shared owner auth response', async () => {
        deny(403);
        const result = await patchFlags(makeRequest('/api/owner/flags', 'PATCH', { key: 'ENABLE_GUEST_MODE', isEnabled: true }) as any);

        expect(result.status).toBe(403);
    });

    it('GET /api/owner/aws-usage returns the shared owner auth response', async () => {
        deny(401);
        const result = await getAwsUsage(new Request('http://localhost:3000/api/owner/aws-usage') as any);

        expect(result.status).toBe(401);
    });

    it('POST /api/owner/retry-assessment returns the shared owner auth response', async () => {
        deny(403);
        const result = await postRetryAssessment(makeRequest('/api/owner/retry-assessment', 'POST', { submissionId: 'sub-1' }) as any);

        expect(result.status).toBe(403);
    });
});