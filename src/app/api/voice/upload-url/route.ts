import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getAudioUploadUrl } from '@/lib/aws/s3';

export const dynamic = 'force-dynamic';

/**
 * POST /api/voice/upload-url
 * Returns a presigned S3 URL for direct audio upload from browser.
 */
export async function POST(request: NextRequest) {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { sessionId } = await request.json();
        if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 });

        const { url, key } = await getAudioUploadUrl(sessionId);
        return NextResponse.json({ url, key });
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown';
        if (msg === 'AWS_S3_DISABLED') return NextResponse.json({ error: 'S3 disabled' }, { status: 503 });
        if (msg === 'AWS_S3_NOT_CONFIGURED') return NextResponse.json({ error: 'S3 not configured' }, { status: 503 });
        console.error('[upload-url] Error:', err);
        return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 });
    }
}
