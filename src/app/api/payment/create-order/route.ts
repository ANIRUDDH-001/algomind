import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';
import { getUserSubscriptionStatus } from '@/lib/supabase/user-preferences';
import { validateEnv } from '@/lib/startup/validateEnv';

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

    // Create Razorpay order using dynamic import for CJS
    const Razorpay = (await import('razorpay')).default;
    const instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const order = await instance.orders.create({
      amount: 49900, // ₹499 in paise
      currency: 'INR',
      receipt: `sub_${user.id}_${Date.now()}`,
      notes: {
        user_id: user.id,
        plan_type: 'premium_monthly',
      },
    });

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    return NextResponse.json(
      { error: 'Failed to create payment order' },
      { status: 500 }
    );
  }
}
