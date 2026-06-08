import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getUserSubscriptionStatus } from '@/lib/supabase/user-preferences';
import { validateEnv } from '@/lib/startup/validateEnv';
import { logSystemEvent } from '@/lib/monitoring/events';

// Razorpay plan ID for monthly ₹499 subscription (created once, reused)
const RAZORPAY_PLAN_ID = 'plan_premium_monthly_499';

export async function POST() {
  try {
    validateEnv();
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is already premium
    const { status: subscriptionStatus } = await getUserSubscriptionStatus(user.id);
    if (subscriptionStatus !== 'free') {
      return NextResponse.json({ error: 'Already subscribed' }, { status: 400 });
    }

    // Create Razorpay subscription using dynamic import for CJS
    const Razorpay = (await import('razorpay')).default;
    const instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    // Create subscription with explicit amount (monthly recurring, 30 days)
    const subscription = await instance.subscriptions.create({
      plan_id: RAZORPAY_PLAN_ID,
      customer_notify: 1, // Send notification to customer
      quantity: 1,
      total_count: 0, // 0 = infinite recurrence
      notes: {
        user_id: user.id,
        plan_type: 'premium_monthly',
      },
    });

    // Log subscription creation
    await logSystemEvent({
      type: 'payment.subscription_created',
      user_id: user.id,
      metadata: {
        component: 'payment.create-order',
        operation: 'subscription_create',
      },
    });

    return NextResponse.json({
      subscriptionId: subscription.id,
      planId: subscription.plan_id,
      status: subscription.status,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error('Error creating Razorpay subscription:', error);
    
    await logSystemEvent({
      type: 'payment.order_created',
      errorMessage: error instanceof Error ? error.message : String(error),
      metadata: {
        component: 'payment.create-order',
        operation: 'subscription_create_failed',
      },
    });

    return NextResponse.json(
      { error: 'Failed to create payment subscription' },
      { status: 500 }
    );
  }
}
