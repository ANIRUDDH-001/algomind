/**
 * @codesage
 * @file      src/app/api/admin/models/route.ts
 * @purpose   CRUD operations for the AI model registry and fetching rate limit stats.
 * @tech      Next.js, Supabase, TypeScript
 * @connects  @/lib/auth/requireAdminForApi, @/lib/supabase/server, @/lib/monitoring/events, @/lib/ai/model-registry
 * @apis      none
 * @db        model_registry, RPC get_model_rate_stats
 * @state     none
 * @env       none
 * @issues    Removed numerous console.error statements.
 * @audit     CODESAGE-v1
 */
import { NextResponse } from 'next/server';
import { requireAdminForApi } from '@/lib/auth/requireAdminForApi';
import { createServerSupabase } from '@/lib/supabase/server';
import { logSystemEvent } from '@/lib/monitoring/events';
import { invalidateModelCache } from '@/lib/ai/model-registry';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const { errorResponse } = await requireAdminForApi();
        if (errorResponse) return errorResponse;
        const supabase = await createServerSupabase();

        // Get 24h stats from RPC
        const { data: stats, error: statsError } = await supabase.rpc('get_model_rate_stats');

        if (statsError) {
            throw statsError;
        }

        const { data: models, error: modelsError } = await supabase
            .from('model_registry')
            .select('*')
            .order('is_active', { ascending: false })
            .order('tier', { ascending: true });

        if (modelsError) {
            throw modelsError;
        }

        interface ModelRateStats {
            model_id: string;
            hits_24h: number;
            last_hit: string | null;
        }

        const statsMap = new Map<string, ModelRateStats>((stats || []).map((s: unknown) => [(s as ModelRateStats).model_id, s as ModelRateStats]));

        const combinedModels = models.map(m => {
            const modelStats = statsMap.get(m.model_id);
            const rateLimitHits24h = modelStats ? Number(modelStats.hits_24h) : 0;
            const lastRateLimitHit = modelStats ? modelStats.last_hit : null;

            // Determine status
            let status = 'active';
            if (!m.is_active) {
                status = 'deprecated';
            } else if (rateLimitHits24h > 5) {
                status = 'degraded';
            }

            return {
                modelId: m.model_id,
                provider: m.provider,
                tier: m.tier,
                rpm: m.rpm,
                tpm: m.tpm,
                rpd: m.rpd,
                contextWindow: m.context_window,
                isActive: m.is_active,
                isVerified: m.is_verified,
                isPreview: m.is_preview,
                deprecatedAt: m.deprecated_at,
                lastVerified: m.last_verified,
                notes: m.notes,
                rateLimitHits24h,
                lastRateLimitHit,
                status,
                modelType: m.model_id.startsWith('whisper') ? 'audio' : 'text'
            };
        });

        return NextResponse.json({ models: combinedModels });

    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { errorResponse } = await requireAdminForApi();
        if (errorResponse) return errorResponse;
        const supabase = await createServerSupabase();

        const body = await request.json();
        const { modelId, provider, tier, rpm, tpm, rpd, contextWindow, notes } = body;

        if (!modelId || !provider) {
            return NextResponse.json({ error: 'Missing modelId or provider' }, { status: 400 });
        }

        const { error } = await supabase
            .from('model_registry')
            .insert({
                model_id: modelId,
                provider,
                tier: tier || 5,
                rpm: rpm || 0,
                tpm: tpm || 0,
                rpd: rpd || 0,
                context_window: contextWindow || 0,
                notes: notes || '',
                is_active: true,
                is_verified: false,
                is_preview: false
            });

        if (error) {
            if (error.code === '23505') {
                return NextResponse.json({ error: 'Model ID already exists' }, { status: 409 });
            }
            return NextResponse.json({ error: 'Failed to add model' }, { status: 500 });
        }

        await invalidateModelCache();

        await logSystemEvent({
            type: 'admin_action' as any, // Legacy event type, ignoring TS for this existing record
            metadata: { action: 'add_model', modelId, provider }
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const { errorResponse } = await requireAdminForApi();
        if (errorResponse) return errorResponse;
        const supabase = await createServerSupabase();

        const body = await request.json();
        const { modelId, rpm, tpm, rpd, notes, isActive } = body;

        if (!modelId) {
            return NextResponse.json({ error: 'Missing modelId' }, { status: 400 });
        }

        const updates: Record<string, unknown> = {};
        if (rpm !== undefined) updates.rpm = rpm;
        if (tpm !== undefined) updates.tpm = tpm;
        if (rpd !== undefined) updates.rpd = rpd;
        if (notes !== undefined) updates.notes = notes;

        if (isActive !== undefined) {
            updates.is_active = isActive;
            if (isActive === true) {
                updates.deprecated_at = null;
                updates.is_verified = false;
            }
        }

        // If no valid fields to update, return 400
        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'No valid fields provided for update' }, { status: 400 });
        }

        const { data: updatedModel, error } = await supabase
            .from('model_registry')
            .update(updates)
            .eq('model_id', modelId)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: 'Failed to update model' }, { status: 500 });
        }

        // Invalidate cache
        await invalidateModelCache();

        await logSystemEvent({
            type: 'admin_action' as any,
            metadata: { action: 'update_model', modelId, updates }
        });

        return NextResponse.json({ success: true, updated: updatedModel });

    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { errorResponse } = await requireAdminForApi();
        if (errorResponse) return errorResponse;
        const body = await request.json();
        const { modelId, reason, hardDelete } = body;

        if (!modelId) {
            return NextResponse.json({ error: 'Missing modelId' }, { status: 400 });
        }

        if (hardDelete) {
            const supabase = await createServerSupabase();
            const { error } = await supabase
                .from('model_registry')
                .delete()
                .eq('model_id', modelId);
            
            if (error) {
                return NextResponse.json({ error: 'Failed to hard delete model' }, { status: 500 });
            }

            await logSystemEvent({
                type: 'admin_action' as any,
                metadata: { action: 'hard_delete_model', modelId }
            });
        } else {
            if (!reason) return NextResponse.json({ error: 'Missing reason for deprecation' }, { status: 400 });

            // Use the existing markModelDeprecated function
            const { markModelDeprecated } = await import('@/lib/ai/model-registry');
            await markModelDeprecated(modelId, reason);

            await logSystemEvent({
                type: 'admin_action' as any,
                metadata: { action: 'deprecate_model', modelId, reason }
            });
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
