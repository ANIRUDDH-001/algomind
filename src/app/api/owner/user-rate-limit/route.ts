import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { requireOwnerForApi } from '@/lib/auth/requireOwnerForApi';

export async function POST(req: NextRequest) {
  // 1. Auth: owner only
  const { errorResponse } = await requireOwnerForApi();
  if (errorResponse) return errorResponse;

  // 2. Parse body
  const body = await req.json();
  const { email, limit } = body as { email?: string; limit?: number | null };

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'email is required' }, { status: 400 });
  }
  if (limit !== null && limit !== undefined && (typeof limit !== 'number' || limit < 0)) {
    return NextResponse.json({ error: 'limit must be a non-negative number or null' }, { status: 400 });
  }

  // 3. Find user by email
  const service = getServiceClient();
  const { data: profile, error: lookupError } = await service
    .from('profiles')
    .select('id')
    .eq('email', email.trim())
    .single();

  if (lookupError || !profile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // 4. Update rate_limit_override
  const { error: updateError } = await service
    .from('profiles')
    .update({ rate_limit_override: limit ?? null })
    .eq('id', profile.id);

  if (updateError) {
    return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    email,
    limit: limit ?? null,
    message: `Rate limit override set: ${limit === null ? 'system default' : limit === 0 ? 'unlimited' : `${limit}/week`}`,
  });
}
