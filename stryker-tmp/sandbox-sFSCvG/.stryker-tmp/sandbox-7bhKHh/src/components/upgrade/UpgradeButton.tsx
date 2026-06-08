/**
 * @codesage
 * @file      src/components/upgrade/UpgradeButton.tsx
 * @purpose   Button to initiate Razorpay checkout flow for premium upgrade.
 * @tech      React, TailwindCSS, Razorpay
 * @connects  lucide-react, sonner, @/components/ui/button
 * @apis      POST /api/payment/create-order, POST /api/payment/verify
 * @db        None
 * @state     Local Component State
 * @env       None
 * @issues    No issues found
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export function UpgradeButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleUpgrade = async () => {
    setIsLoading(true);

    try {
      // Load Razorpay script if not already loaded
      if (!document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]')) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Razorpay'));
          document.body.appendChild(script);
        });
      }

      // Create order
      const createOrderRes = await fetch('/api/payment/create-order', {
        method: 'POST',
      });

      if (!createOrderRes.ok) {
        const error = await createOrderRes.json();
        toast.error(error.error || 'Failed to create payment order');
        setIsLoading(false);
        return;
      }

      const orderData = await createOrderRes.json();

      // Open Razorpay checkout
      const rzp = new (window as any).Razorpay({
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        order_id: orderData.orderId,
        name: 'AlgoMind Pro',
        description: 'Monthly Subscription — Unlimited Sessions',
        theme: { color: '#6366f1' },
        handler: async (response: any) => {
          try {
            const verifyRes = await fetch('/api/payment/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            if (verifyRes.ok) {
              toast.success('🎉 Welcome to AlgoMind Pro! Unlimited sessions unlocked.');
              setTimeout(() => {
                window.location.reload();
              }, 1500);
            } else {
              const error = await verifyRes.json();
              toast.error(error.error || 'Payment verification failed');
            }
          } catch (error) {
            console.error('Verification error:', error);
            toast.error('Payment verification failed. Please contact support.');
          }
        },
        prefill: {
          contact: '',
          email: '',
        },
        notes: {
          plan_type: 'premium_monthly',
        },
      });

      rzp.open();
    } catch (error) {
      console.error('Upgrade error:', error);
      toast.error('Failed to initiate payment. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleUpgrade}
      disabled={isLoading}
      className="w-full bg-linear-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isLoading ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          Processing...
        </>
      ) : (
        <>
          <Zap className="w-5 h-5" />
          Go Pro — ₹499/month
        </>
      )}
    </Button>
  );
}
