// @ts-nocheck
import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { invalidateStudentContext } from '@/lib/kai-context';
import { validateEnv } from '@/lib/startup/validateEnv';
import { logSystemEvent } from '@/lib/monitoring/events';
import { getCorrelationId } from '@/lib/tracing/correlation';

/**
 * Razorpay Webhook Handler for Subscription Lifecycle Events
 * 
 * Handles:
 * - subscription.charged: When subscription payment is processed
 * - subscription.cancelled: When subscription is cancelled
 * - subscription.paused: When subscription is paused
 * - subscription.resumed: When subscription is resumed
 * - subscription.halted: When subscription is halted due to max attempts
 * - subscription.completed: When subscription reaches its end
 */
export async function POST(req: Request) {
  const correlationId = await getCorrelationId();
  
  try {
    validateEnv();

    // ── 1. Read raw body BEFORE any parsing ────────────────────────────────
    const rawBody = await req.text();
    const signature = req.headers.get('x-razorpay-signature');
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    // ── 2. Reject immediately if secret not configured ─────────────────────
    if (!webhookSecret) {
      console.error('[Webhook] RAZORPAY_WEBHOOK_SECRET is not set — rejecting all webhook events');
      void logSystemEvent({
        type: 'payment.webhook_failed',
        correlationId,
        metadata: { component: 'payment.webhook', operation: 'webhook_rejected', reason: 'secret_not_configured' },
      });
      return NextResponse.json({ error: 'Misconfigured' }, { status: 500 });
    }

    // ── 3. Reject if signature header is missing ───────────────────────────
    if (!signature) {
      void logSystemEvent({
        type: 'payment.webhook_failed',
        correlationId,
        metadata: { component: 'payment.webhook', operation: 'webhook_rejected', reason: 'missing_signature_header' },
      });
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    // ── 4. HMAC verification (timing-safe) ─────────────────────────────────
    const expectedHex = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    let signatureValid = false;
    try {
      signatureValid = crypto.timingSafeEqual(
        Buffer.from(expectedHex, 'hex'),
        Buffer.from(signature, 'hex')
      );
    } catch {
      // Buffer lengths differ → invalid signature (don't throw, just reject)
      signatureValid = false;
    }

    if (!signatureValid) {
      void logSystemEvent({
        type: 'payment.webhook_failed',
        correlationId,
        metadata: { component: 'payment.webhook', operation: 'webhook_rejected', reason: 'invalid_signature' },
      });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // ── 5. Parse body only after signature is verified ─────────────────────
    let body: {
      event?: string;
      payload?: {
        subscription?: {
          id?: string;
          entity?: string;
          status?: string;
          current_start?: number;
          current_end?: number;
          ended_at?: number | null;
          quantity?: number;
          notes?: Record<string, unknown>;
          customer_id?: string;
        };
        payment?: {
          id?: string;
          entity?: string;
          amount?: number;
        };
      };
      created_at?: number;
    };
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const webhookEvent = body.event;
    const payload = body.payload;

    if (!webhookEvent || !payload) {
      return NextResponse.json(
        { error: 'Invalid webhook payload' },
        { status: 400 }
      );
    }

    // Log webhook receipt
    await logSystemEvent({
      type: 'payment.webhook_received',
      correlationId,
      metadata: {
        component: 'payment.webhook',
        operation: 'webhook_received',
      },
    });

    const subscription = payload.subscription;
    
    if (!subscription || !subscription.id) {
      return NextResponse.json(
        { error: 'Invalid subscription data' },
        { status: 400 }
      );
    }

    const serviceClient = getServiceClient();

    // Handle different subscription events
    switch (webhookEvent) {
      case 'subscription.charged': {
        // Extend subscription period when payment is processed
        const chargeDate = new Date(subscription.current_start! * 1000);
        const nextChargeDate = new Date(subscription.current_end! * 1000);

        const { data: existingSubscription } = await serviceClient
          .from('subscriptions')
          .select('user_id, id')
          .eq('provider', 'razorpay')
          .eq('provider_subscription_id', subscription.id)
          .maybeSingle();

        if (existingSubscription) {
          // Update subscription period
          const { error: updateError } = await serviceClient
            .from('subscriptions')
            .update({
              current_period_start: chargeDate.toISOString(),
              current_period_end: nextChargeDate.toISOString(),
              status: 'active',
            })
            .eq('id', existingSubscription.id);

          if (updateError) {
            console.error('Failed to update subscription on charge:', updateError);
            throw new Error(`Subscription update failed: ${updateError.message}`);
          }

          // Update profile subscription expiry
          const { error: profileError } = await serviceClient
            .from('profiles')
            .update({
              subscription_status: 'premium',
              subscription_expires_at: nextChargeDate.toISOString(),
            })
            .eq('id', existingSubscription.user_id);

          if (profileError) {
            console.error('Failed to update profile on charge:', profileError);
            throw new Error(`Profile update failed: ${profileError.message}`);
          }

          // Invalidate cache
          try {
            await invalidateStudentContext(existingSubscription.user_id);
          } catch (e) {
            console.warn('Failed to invalidate cache on charge:', e);
          }

          // Log success
          await logSystemEvent({
            type: 'payment.subscription_charged',
            user_id: existingSubscription.user_id,
            correlationId,
            metadata: {
              component: 'payment.webhook',
              operation: 'subscription_charged',
            },
          });
        }
        break;
      }

      case 'subscription.cancelled': {
        // Downgrade user on subscription cancellation
        const { data: existingSubscription } = await serviceClient
          .from('subscriptions')
          .select('user_id, id')
          .eq('provider', 'razorpay')
          .eq('provider_subscription_id', subscription.id)
          .maybeSingle();

        if (existingSubscription) {
          // Update subscription status
          const { error: updateError } = await serviceClient
            .from('subscriptions')
            .update({
              status: 'cancelled',
              ended_at: new Date().toISOString(),
            })
            .eq('id', existingSubscription.id);

          if (updateError) {
            console.error('Failed to update subscription on cancel:', updateError);
            throw new Error(`Subscription update failed: ${updateError.message}`);
          }

          // Downgrade profile to free
          const { error: profileError } = await serviceClient
            .from('profiles')
            .update({
              subscription_status: 'free',
              subscription_expires_at: null,
            })
            .eq('id', existingSubscription.user_id);

          if (profileError) {
            console.error('Failed to downgrade profile on cancel:', profileError);
            throw new Error(`Profile downgrade failed: ${profileError.message}`);
          }

          // Invalidate cache
          try {
            await invalidateStudentContext(existingSubscription.user_id);
          } catch (e) {
            console.warn('Failed to invalidate cache on cancel:', e);
          }

          // Log cancellation
          await logSystemEvent({
            type: 'payment.subscription_cancelled',
            user_id: existingSubscription.user_id,
            correlationId,
            metadata: {
              component: 'payment.webhook',
              operation: 'subscription_cancelled',
            },
          });
        }
        break;
      }

      case 'subscription.paused':
      case 'subscription.resumed':
      case 'subscription.halted':
      case 'subscription.completed': {
        // Log other subscription lifecycle events without taking action
        console.log(`Received subscription event: ${webhookEvent}`, { subscription });
        
        await logSystemEvent({
          type: 'payment.webhook_processed',
          correlationId,
          metadata: {
            component: 'payment.webhook',
            operation: `subscription_${webhookEvent.split('.')[1]}`,
          },
        });
        break;
      }

      default:
        console.log(`Received unhandled webhook event: ${webhookEvent}`);
        break;
    }

    // Log successful webhook processing
    await logSystemEvent({
      type: 'payment.webhook_processed',
      correlationId,
      metadata: {
        component: 'payment.webhook',
        operation: 'webhook_processed',
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing webhook:', error);

    // Log webhook failure
    await logSystemEvent({
      type: 'payment.webhook_failed',
      correlationId,
      errorMessage: error instanceof Error ? error.message : String(error),
      metadata: {
        component: 'payment.webhook',
        operation: 'webhook_processing_failed',
      },
    });

    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
