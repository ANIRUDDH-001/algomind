import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: caller } = await getServiceClient()
    .from('profiles')
    .select('account_type')
    .eq('id', user.id)
    .single();

  if (!['owner', 'admin'].includes(caller?.account_type ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { email, subscription_status, expires_at } = await req.json();

  // Find the profile by email
  const { data: targetProfile, error } = await getServiceClient()
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single();

  if (error || !targetProfile) {
    return NextResponse.json({ error: `User not found: ${email}` }, { status: 404 });
  }

  // Update subscription
  const { error: updateError } = await getServiceClient()
    .from('profiles')
    .update({
      subscription_status,
      subscription_expires_at: expires_at ?? null,
    })
    .eq('id', targetProfile.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Also update subscriptions table
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
}
