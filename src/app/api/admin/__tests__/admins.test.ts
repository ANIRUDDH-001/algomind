import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST, DELETE } from '../admins/route';
import { requireAdminForApi } from '@/lib/auth/requireAdminForApi';
import { getServiceClient } from '@/lib/supabase/service';
import { NextResponse } from 'next/server';

vi.mock('@/lib/auth/requireAdminForApi');
vi.mock('@/lib/supabase/service');

describe('Admin Admins Route (/api/admin/admins)', () => {
    let mockSupabase: any;

    beforeEach(() => {
        vi.resetAllMocks();

        mockSupabase = {
            from: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            rpc: vi.fn(),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
            maybeSingle: vi.fn().mockReturnThis(),
            insert: vi.fn().mockReturnThis(),
            delete: vi.fn().mockReturnThis(),
        };

        vi.mocked(getServiceClient).mockReturnValue(mockSupabase);
    });

    describe('GET /api/admin/admins', () => {
        it('1. Admin user -> 200 with list of admins', async () => {
            vi.mocked(requireAdminForApi).mockResolvedValue({
                user: { email: 'admin@test.com' } as any,
                errorResponse: null
            });

            const mockAdmins = [{ id: '1', email: 'admin1@test.com', added_at: '2023-01-01' }];
            mockSupabase.order.mockResolvedValue({ data: mockAdmins, error: null });

            const response = await GET();
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data).toEqual(mockAdmins);
        });

        it('2. Non-admin -> 403', async () => {
            const forbiddenResponse = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            vi.mocked(requireAdminForApi).mockResolvedValue({
                user: null,
                errorResponse: forbiddenResponse
            });

            const response = await GET();
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data).toMatchObject({ error: 'Forbidden' });
        });

        it('3. Unauthenticated -> 401', async () => {
            const unauthorizedResponse = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            vi.mocked(requireAdminForApi).mockResolvedValue({
                user: null,
                errorResponse: unauthorizedResponse
            });

            const response = await GET();
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data).toMatchObject({ error: 'Unauthorized' });
        });

        it('4. DB query fails -> 500', async () => {
            vi.mocked(requireAdminForApi).mockResolvedValue({
                user: { email: 'admin@test.com' } as any,
                errorResponse: null
            });
            mockSupabase.order.mockResolvedValue({ data: null, error: new Error('DB Error') });

            const response = await GET();
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data).toMatchObject({ error: 'Internal server error' });
        });
    });

    describe('POST /api/admin/admins', () => {
        const createRequest = (body: any) => new Request('http://localhost:3000/api/admin/admins', {
            method: 'POST',
            body: JSON.stringify(body),
        });

        it('1. Valid email, admin user -> 200 { success: true }', async () => {
            vi.mocked(requireAdminForApi).mockResolvedValue({
                user: { email: 'admin@test.com' } as any,
                errorResponse: null
            });
            mockSupabase.maybeSingle.mockResolvedValue({ data: null }); // user does not exist
            mockSupabase.insert.mockResolvedValue({ error: null });

            const req = createRequest({ email: 'newadmin@test.com' });
            const response = await POST(req);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data).toEqual({ success: true, email: 'newadmin@test.com' });
        });

        it('2. Invalid email format -> 400', async () => {
            vi.mocked(requireAdminForApi).mockResolvedValue({
                user: { email: 'admin@test.com' } as any,
                errorResponse: null
            });

            const req = createRequest({ email: 'invalid-email-format' });
            const response = await POST(req);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data).toMatchObject({ error: 'Invalid email format' });
        });

        it('3. Email already admin -> 409', async () => {
            vi.mocked(requireAdminForApi).mockResolvedValue({
                user: { email: 'admin@test.com' } as any,
                errorResponse: null
            });
            mockSupabase.maybeSingle.mockResolvedValue({ data: { id: '1' } }); // user exists

            const req = createRequest({ email: 'alreadyadmin@test.com' });
            const response = await POST(req);
            const data = await response.json();

            expect(response.status).toBe(409);
            expect(data).toMatchObject({ error: 'Already an admin' });
        });

        it('4. Non-admin trying to add -> 403', async () => {
            const forbiddenResponse = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            vi.mocked(requireAdminForApi).mockResolvedValue({
                user: null,
                errorResponse: forbiddenResponse
            });

            const req = createRequest({ email: 'newadmin@test.com' });
            const response = await POST(req);
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data).toMatchObject({ error: 'Forbidden' });
        });
    });

    describe('DELETE /api/admin/admins', () => {
        const createRequest = (email?: string) => {
            const url = email
                ? `http://localhost:3000/api/admin/admins?email=${encodeURIComponent(email)}`
                : 'http://localhost:3000/api/admin/admins';
            return new Request(url, { method: 'DELETE' });
        };

        it('1. Remove non-self admin -> 200', async () => {
            vi.mocked(requireAdminForApi).mockResolvedValue({
                user: { email: 'admin@test.com' } as any,
                errorResponse: null
            });

            mockSupabase.rpc.mockResolvedValue({ data: { success: true }, error: null });

            const req = createRequest('otheradmin@test.com');
            const response = await DELETE(req);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data).toEqual({ success: true });
            expect(mockSupabase.rpc).toHaveBeenCalledWith('safe_delete_admin', {
                p_email: 'otheradmin@test.com',
            });
        });

        it('2. Last admin tries to remove self -> 400 "Cannot remove the last admin"', async () => {
            vi.mocked(requireAdminForApi).mockResolvedValue({
                user: { email: 'admin@test.com' } as any,
                errorResponse: null
            });

            mockSupabase.rpc.mockResolvedValue({
                data: { success: false, error: 'Cannot remove the last admin' },
                error: null,
            });

            const req = createRequest('admin@test.com');
            const response = await DELETE(req);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data).toMatchObject({ error: 'Cannot remove the last admin' });
        });

        it('3. Missing email in query -> 400', async () => {
            vi.mocked(requireAdminForApi).mockResolvedValue({
                user: { email: 'admin@test.com' } as any,
                errorResponse: null
            });

            const req = createRequest();
            const response = await DELETE(req);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data).toMatchObject({ error: 'Email is required' });
        });

        it('4. Non-admin -> 403', async () => {
            const forbiddenResponse = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            vi.mocked(requireAdminForApi).mockResolvedValue({
                user: null,
                errorResponse: forbiddenResponse
            });

            const req = createRequest('otheradmin@test.com');
            const response = await DELETE(req);
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data).toMatchObject({ error: 'Forbidden' });
        });

        it('5. Master admin deletion rejected by RPC -> 403', async () => {
            vi.mocked(requireAdminForApi).mockResolvedValue({
                user: { email: 'admin@test.com' } as any,
                errorResponse: null,
            });

            mockSupabase.rpc.mockResolvedValue({
                data: { success: false, error: 'Cannot delete master admin' },
                error: null,
            });

            const req = createRequest('master@test.com');
            const response = await DELETE(req);
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data).toMatchObject({ error: 'Cannot delete master admin' });
        });

        it('6. RPC transport failure -> 500', async () => {
            vi.mocked(requireAdminForApi).mockResolvedValue({
                user: { email: 'admin@test.com' } as any,
                errorResponse: null,
            });

            mockSupabase.rpc.mockResolvedValue({
                data: null,
                error: new Error('RPC failed'),
            });

            const req = createRequest('otheradmin@test.com');
            const response = await DELETE(req);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data).toMatchObject({ error: 'Failed to delete admin' });
        });
    });
});
