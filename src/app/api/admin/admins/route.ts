/**
 * @codesage
 * @file      src/app/api/admin/admins/route.ts
 * @purpose   Manages admin users (listing, adding, and safely deleting) via Supabase API endpoints.
 * @tech      Next.js, Supabase, TypeScript
 * @connects  @/lib/auth/requireAdminForApi, @/lib/supabase/service, @/lib/monitoring/events, @/lib/api/error-response
 * @apis      none
 * @db        admin_users, system_config (via RPC safe_delete_admin)
 * @state     none
 * @env       none
 * @issues    Removed console.error in DELETE catch block.
 * @audit     CODESAGE-v1
 */
import { NextResponse } from "next/server";
import { requireAdminForApi } from '@/lib/auth/requireAdminForApi';
import { getServiceClient } from '@/lib/supabase/service';
import { logSystemEvent } from '@/lib/monitoring/events';
import { ApiErrors, apiError, ErrorCodes } from '@/lib/api/error-response';

async function getMasterAdminEmail(): Promise<string> {
    const { data } = await getServiceClient()
        .from('system_config')
        .select('value')
        .eq('key', 'primary_owner_email')
        .single();
    return data?.value ?? '';
}

export async function GET() {
    try {
        const { errorResponse } = await requireAdminForApi();
        if (errorResponse) return errorResponse;

        const supabaseAdmin = getServiceClient();
        const { data: admins, error } = await supabaseAdmin
            .from('admin_users') // ← FIXED: was 'adminusers'
            .select('id, email, name, added_at, added_by')
            .order('added_at', { ascending: false });

        if (error) throw error;
        return NextResponse.json(admins || []);
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        await logSystemEvent({ type: 'route_error', errorMessage: errMsg, metadata: { route: 'admin/admins' } });
        return ApiErrors.serverError('Internal server error');
    }
}

export async function POST(request: Request) {
    try {
        const { user, errorResponse } = await requireAdminForApi();
        if (errorResponse) return errorResponse;

        const body = await request.json();
        const { email } = body as { email?: string };

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return ApiErrors.badRequest('Invalid email format');
        }

        const supabaseAdmin = getServiceClient();

        const { data: existing } = await supabaseAdmin
            .from('admin_users') // ← FIXED
            .select('id')
            .eq('email', email)
            .maybeSingle();

        if (existing) {
            return apiError(409, ErrorCodes.INVALID_INPUT, 'Already an admin');
        }

        const { error } = await supabaseAdmin
            .from('admin_users') // ← FIXED
            .insert({ email, added_by: user!.email });

        if (error) throw error;
        return NextResponse.json({ success: true, email });
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        await logSystemEvent({ type: 'route_error', errorMessage: errMsg, metadata: { route: 'admin/admins' } });
        return ApiErrors.serverError('Internal server error');
    }
}

export async function DELETE(request: Request) {
    try {
        const { errorResponse } = await requireAdminForApi();
        if (errorResponse) return errorResponse;

        const { searchParams } = new URL(request.url);
        const email = searchParams.get('email');

        if (!email) {
            return apiError(400, ErrorCodes.MISSING_FIELD, 'Email is required');
        }

        const masterEmail = await getMasterAdminEmail();
        if (masterEmail && email === masterEmail) {
            return ApiErrors.forbidden('Cannot delete master admin');
        }

        const supabaseAdmin = getServiceClient();

        // Atomic delete via RPC to prevent TOCTOU race conditions.
        const { data, error } = await supabaseAdmin.rpc('safe_delete_admin', {
            p_email: email,
        });

        if (error) {
            return ApiErrors.serverError('Failed to delete admin');
        }

        if (!data?.success) {
            const message = typeof data?.error === 'string' ? data.error : 'Delete failed';
            const lowered = message.toLowerCase();
            if (lowered.includes('master')) {
                return ApiErrors.forbidden(message);
            }
            if (lowered.includes('not found')) {
                return ApiErrors.notFound(message);
            }
            if (lowered.includes('last admin')) {
                return apiError(400, ErrorCodes.ALREADY_COMPLETED, message);
            }
            return ApiErrors.badRequest(message);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        await logSystemEvent({ type: 'route_error', errorMessage: errMsg, metadata: { route: 'admin/admins' } });
        return ApiErrors.serverError('Internal server error');
    }
}
