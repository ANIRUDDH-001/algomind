// @ts-nocheck
// 
import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';
import { invalidateStudentContext } from '@/lib/kai-context';
import { validateEnv } from '@/lib/startup/validateEnv';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    validateEnv();
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json() as {
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
    };

    const orderId = body.razorpay_order_id;
    const paymentId = body.razorpay_payment_id;
    const signature = body.razorpay_signature;

    if (!orderId || !paymentId || !signature) {
      return NextResponse.json(
        { error: 'Missing payment details' },
        { status: 400 }
      );
    }

    // Verify Razorpay signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    if (expectedSignature !== signature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const serviceClient = getServiceClient();
    const { data: existingSubscription, error: existingSubscriptionError } = await serviceClient
      .from('subscriptions')
      .select('id')
      .eq('provider', 'razorpay')
      .eq('provider_subscription_id', orderId)
      .maybeSingle();

    if (existingSubscriptionError) {
      console.error('Failed to check existing subscription:', existingSubscriptionError);
      return NextResponse.json(
        { error: 'Failed to process subscription' },
        { status: 500 }
      );
    }

    if (existingSubscription) {
      return NextResponse.json({ success: true });
    }

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Insert into subscriptions table
    const { error: subError } = await serviceClient
      .from('subscriptions')
      .insert({
        user_id: user.id,
        plan_type: 'premium_monthly',
        status: 'active',
        provider: 'razorpay',
        provider_customer_id: paymentId,
        provider_subscription_id: orderId,
        current_period_start: now.toISOString(),
        current_period_end: thirtyDaysFromNow.toISOString(),
        weekly_session_limit: null, // null = unlimited
      });

    if (subError) {
      console.error('Failed to insert subscription:', subError);
      return NextResponse.json(
        { error: 'Failed to process subscription' },
        { status: 500 }
      );
    }

    // Update profiles table
    const { error: profileError } = await getServiceClient()
      .from('profiles')
      .update({
        subscription_status: 'premium',
        subscription_expires_at: thirtyDaysFromNow.toISOString(),
      })
      .eq('id', user.id);

    if (profileError) {
      console.error('Failed to update profile:', profileError);
      return NextResponse.json(
        { error: 'Failed to update subscription status' },
        { status: 500 }
      );
    }

    // Invalidate StudentContext cache
    try {
      await invalidateStudentContext(user.id);
    } catch (cacheError) {
      console.warn('Failed to invalidate cache:', cacheError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error verifying payment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
