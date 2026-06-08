// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { requireOwnerForApi } from '@/lib/auth/requireOwnerForApi';
import { logSystemEvent } from '@/lib/monitoring/events';
import { SYSTEM_CONFIG_KEYS } from '@/lib/config/system-config-keys';

export const dynamic = 'force-dynamic';

export async function GET() {
    const { errorResponse } = await requireOwnerForApi();
    if (errorResponse) return errorResponse;

    try {
        const svc = getServiceClient();
        const { data, error } = await svc
            .from('system_config')
            .select('key, value')
            .order('key', { ascending: true });

        if (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            await logSystemEvent({
                type: 'db_error',
                errorMessage: errMsg,
                metadata: { context: 'owner_system_config.get' },
            });
            return NextResponse.json({ error: 'Failed to load config' }, { status: 500 });
        }

        return NextResponse.json({ config: data ?? [] });
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        await logSystemEvent({
            type: 'db_error',
            errorMessage: errMsg,
            metadata: { context: 'owner_system_config.get' },
        });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const { errorResponse } = await requireOwnerForApi();
    if (errorResponse) return errorResponse;

    try {
        const body = await req.json();
        const { updates } = body;

        if (!Array.isArray(updates) || updates.length === 0) {
            return NextResponse.json({ error: 'updates must be a non-empty array' }, { status: 400 });
        }

        const validKeys = new Set(Object.values(SYSTEM_CONFIG_KEYS));
        for (const item of updates) {
            if (typeof item?.key !== 'string' || typeof item?.value !== 'string') {
                return NextResponse.json({ error: 'Each update must have string key and value' }, { status: 400 });
            }
            if (!validKeys.has(item.key)) {
                return NextResponse.json({ error: `Unknown config key: ${item.key}` }, { status: 400 });
            }
            if (item.value.trim() === '') {
                return NextResponse.json({ error: `Value for key "${item.key}" cannot be empty` }, { status: 400 });
            }
        }

        const svc = getServiceClient();
        const { error } = await svc
            .from('system_config')
            .upsert(
                updates.map(({ key, value }: { key: string; value: string }) => ({ key, value })),
                { onConflict: 'key' }
            );

        if (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            await logSystemEvent({
                type: 'db_error',
                errorMessage: errMsg,
                metadata: { context: 'owner_system_config.post' },
            });
            return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
        }

        try {
            const { getRedis } = await import('@/lib/upstash/client');
            const redis = getRedis();
            if (redis) {
                await Promise.allSettled(
                    updates.map(({ key }: { key: string }) => redis.del(`system_config:${key}`))
                );
            }
        } catch {
            // Cache invalidation failure is non-fatal
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        await logSystemEvent({
            type: 'db_error',
            errorMessage: errMsg,
            metadata: { context: 'owner_system_config.post' },
        });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}