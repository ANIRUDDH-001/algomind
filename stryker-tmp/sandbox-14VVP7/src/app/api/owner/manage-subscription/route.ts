// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { logSystemEvent } from '@/lib/monitoring/events';
import { requireOwnerForApi } from '@/lib/auth/requireOwnerForApi';

export async function POST(req: NextRequest) {
  try {
    const { user, errorResponse } = await requireOwnerForApi();
    if (errorResponse) return errorResponse;

    const { email, subscription_status, expires_at } = await req.json();
    if (!email || !subscription_status) {
      return NextResponse.json({ error: 'email and subscription_status are required' }, { status: 400 });
    }

    const { data: targetProfile, error } = await getServiceClient()
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (error || !targetProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { error: updateError } = await getServiceClient()
      .from('profiles')
      .update({
        subscription_status,
        subscription_expires_at: expires_at ?? null,
      })
      .eq('id', targetProfile.id);

    if (updateError) {
      await logSystemEvent({
        type: 'db_error',
        userId: user.id,
        errorMessage: updateError.message,
        metadata: { context: 'owner_manage_subscription.update_profile' },
      });
      return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
    }

    const planTypeMap: Record<string, string> = {
      free: 'free',
      premium: 'student_monthly',
      college: 'college_annual',
    };

    await getServiceClient()
      .from('subscriptions')
      .upsert(
        {
          user_id: targetProfile.id,
          plan_type: planTypeMap[subscription_status] || 'free',
          status: subscription_status === 'free' ? 'expired' : 'active',
          provider: 'manual',
          current_period_end: expires_at ?? null,
        },
        { onConflict: 'user_id' }
      );

    return NextResponse.json({ message: `${email} updated to ${subscription_status}` });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logSystemEvent({
      type: 'db_error',
      errorMessage,
      metadata: { context: 'owner_manage_subscription.post' },
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
