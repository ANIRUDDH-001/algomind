import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { logSystemEvent } from '@/lib/monitoring/events';
import { requireOwnerForApi } from '@/lib/auth/requireOwnerForApi';

export const dynamic = 'force-dynamic';

/** GET — return all routing entries grouped by use_case */
export async function GET() {
    const { errorResponse } = await requireOwnerForApi();
    if (errorResponse) return errorResponse;

    try {
        const svc = getServiceClient();
        const { data, error } = await svc
            .from('model_routing')
            .select('*')
            .order('priority', { ascending: true });

        if (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            void logSystemEvent({ type: 'route_error', errorMessage: errMsg, metadata: { route: 'owner/model-routing' } });
            return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
        }

        const chat = (data ?? []).filter((r) => r.use_case === 'chat');
        const analysis = (data ?? []).filter((r) => r.use_case === 'analysis');

        return NextResponse.json({ chat, analysis });
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        void logSystemEvent({ type: 'route_error', errorMessage: errMsg, metadata: { route: 'owner/model-routing' } });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/** POST — add a new routing entry */
export async function POST(req: NextRequest) {
    const { errorResponse } = await requireOwnerForApi();
    if (errorResponse) return errorResponse;

    try {
        const body = await req.json();
        const { model_id, provider, use_case, priority, max_tokens_override, notes } = body;

        if (!model_id || !provider || !use_case) {
            return NextResponse.json({ error: 'model_id, provider, and use_case are required' }, { status: 400 });
        }
        if (!['chat', 'analysis'].includes(use_case)) {
            return NextResponse.json({ error: 'use_case must be chat or analysis' }, { status: 400 });
        }

        const svc = getServiceClient();
        const { data, error } = await svc
            .from('model_routing')
            .insert({
                model_id,
                provider,
                use_case,
                priority: priority ?? 100,
                max_tokens_override: max_tokens_override ?? null,
                notes: notes ?? null,
            })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                return NextResponse.json({ error: 'Model already exists for this use case' }, { status: 409 });
            }
            const errMsg = error instanceof Error ? error.message : String(error);
            void logSystemEvent({ type: 'route_error', errorMessage: errMsg, metadata: { route: 'owner/model-routing' } });
            return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
        }

        return NextResponse.json({ success: true, entry: data });
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        void logSystemEvent({ type: 'route_error', errorMessage: errMsg, metadata: { route: 'owner/model-routing' } });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/** PATCH — update priorities (batch) or toggle active */
export async function PATCH(req: NextRequest) {
    const { errorResponse } = await requireOwnerForApi();
    if (errorResponse) return errorResponse;

    try {
        const body = await req.json();
        const svc = getServiceClient();

        // Batch priority update: { updates: [{ id, priority?, is_active? }] }
        if (body.updates && Array.isArray(body.updates)) {
            const errors: string[] = [];
            for (const item of body.updates) {
                const updateFields: Record<string, unknown> = { updated_at: new Date().toISOString() };
                if (typeof item.priority === 'number') updateFields.priority = item.priority;
                if (typeof item.is_active === 'boolean') updateFields.is_active = item.is_active;

                const { error } = await svc
                    .from('model_routing')
                    .update(updateFields)
                    .eq('id', item.id);

                if (error) errors.push(`${item.id}: ${error instanceof Error ? error.message : String(error)}`);
            }
            if (errors.length > 0) {
                const errMsg = errors.join('; ');
                void logSystemEvent({ type: 'route_error', errorMessage: errMsg, metadata: { route: 'owner/model-routing' } });
                return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
            }
            return NextResponse.json({ success: true });
        }

        // Single update: { id, priority?, is_active? }
        if (body.id) {
            const updateFields: Record<string, unknown> = { updated_at: new Date().toISOString() };
            if (typeof body.priority === 'number') updateFields.priority = body.priority;
            if (typeof body.is_active === 'boolean') updateFields.is_active = body.is_active;
            if (typeof body.max_tokens_override === 'number') updateFields.max_tokens_override = body.max_tokens_override;
            if (body.notes !== undefined) updateFields.notes = body.notes;

            const { error } = await svc
                .from('model_routing')
                .update(updateFields)
                .eq('id', body.id);

            if (error) {
                const errMsg = error instanceof Error ? error.message : String(error);
                void logSystemEvent({ type: 'route_error', errorMessage: errMsg, metadata: { route: 'owner/model-routing' } });
                return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
            }
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Missing id or updates array' }, { status: 400 });
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        void logSystemEvent({ type: 'route_error', errorMessage: errMsg, metadata: { route: 'owner/model-routing' } });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/** DELETE — remove a routing entry */
export async function DELETE(req: NextRequest) {
    const { errorResponse } = await requireOwnerForApi();
    if (errorResponse) return errorResponse;

    try {
        const { id } = await req.json();
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

        const svc = getServiceClient();
        const { error } = await svc
            .from('model_routing')
            .delete()
            .eq('id', id);

        if (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            void logSystemEvent({ type: 'route_error', errorMessage: errMsg, metadata: { route: 'owner/model-routing' } });
            return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        void logSystemEvent({ type: 'route_error', errorMessage: errMsg, metadata: { route: 'owner/model-routing' } });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
