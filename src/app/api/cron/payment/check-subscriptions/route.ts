/**
 * @codesage
 * @file      src/app/api/cron/payment/check-subscriptions/route.ts
 * @purpose   Nightly cron endpoint to downgrade users with expired subscriptions via Supabase backstop function.
 * @tech      Next.js, TypeScript
 * @connects  @/lib/supabase/service, @/lib/monitoring/events, @/lib/tracing/correlation
 * @apis      none
 * @db        RPC check_and_downgrade_expired_subscriptions
 * @state     none
 * @env       CRON_SECRET
 * @issues    Removed console logs.
 * @audit     CODESAGE-v1
 */
import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { logSystemEvent } from '@/lib/monitoring/events';
import { getCorrelationId } from '@/lib/tracing/correlation';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/payment/check-subscriptions
 * 
 * Nightly cron endpoint to downgrade users with expired subscriptions.
 * Protected by CRON_SECRET to prevent unauthorized invocation.
 * 
 * Calls the Supabase backstop function: check_and_downgrade_expired_subscriptions()
 */
export async function GET(req: Request) {
  const correlationId = await getCorrelationId();
  
  try {
    // Verify cron secret
    const cronSecret = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized - invalid CRON_SECRET' },
        { status: 401 }
      );
    }

    const serviceClient = getServiceClient();

    // Log cron trigger
    await logSystemEvent({
      type: 'cron.triggered',
      correlationId,
      metadata: {
        component: 'payment.subscription_expiry_cron',
        operation: 'check_subscriptions_triggered',
      },
    });

    // Call the Supabase backstop function
    const { data: downgradedUsers, error: rpcError } = await serviceClient
      .rpc('check_and_downgrade_expired_subscriptions');

    if (rpcError) {
      
      await logSystemEvent({
        type: 'cron.failed',
        correlationId,
        errorMessage: rpcError.message,
        metadata: {
          component: 'payment.subscription_expiry_cron',
          operation: 'check_subscriptions_failed',
        },
      });

      return NextResponse.json(
        { error: 'Failed to check subscriptions', details: rpcError.message },
        { status: 500 }
      );
    }

    const downgradedCount = Array.isArray(downgradedUsers) ? downgradedUsers.length : 0;

    // Log successful completion
    await logSystemEvent({
      type: 'cron.completed',
      correlationId,
      metadata: {
        component: 'payment.subscription_expiry_cron',
        operation: 'check_subscriptions_completed',
        records_processed: downgradedCount,
      },
    });

    return NextResponse.json({
      success: true,
      downgradedCount,
      downgradedUsers: downgradedUsers || [],
      message: `Successfully downgraded ${downgradedCount} user(s) with expired subscriptions`,
    });
  } catch (error) {

      await logSystemEvent({
      type: 'cron.failed',
      correlationId,
      errorMessage: error instanceof Error ? error.message : String(error),
      metadata: {
        component: 'payment.subscription_expiry_cron',
        operation: 'check_subscriptions_error',
      },
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
