import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST as postCreateOrder } from '@/app/api/payment/create-order/route';
import { POST as postVerify } from '@/app/api/payment/verify/route';
import { POST } from '@/app/api/payment/webhook/route';
import { createServerSupabase } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';
import { getUserSubscriptionStatus } from '@/lib/supabase/user-preferences';
import { invalidateStudentContext } from '@/lib/kai-context';
import crypto from 'crypto';

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: vi.fn(),
}));

vi.mock('@/lib/supabase/service', () => ({
  getServiceClient: vi.fn(),
}));

vi.mock('@/lib/supabase/user-preferences', () => ({
  getUserSubscriptionStatus: vi.fn(),
}));

vi.mock('@/lib/kai-context', () => ({
  invalidateStudentContext: vi.fn(),
}));

vi.mock('razorpay', () => ({
  default: vi.fn().mockImplementation(function MockRazorpay() {
    return {
    subscriptions: {
      create: vi.fn().mockResolvedValue({
        id: 'sub_test123',
        plan_id: 'plan_premium_monthly_499',
        status: 'created',
      }),
    },
    };
  }),
}));

const createRequest = (body: any, method = 'POST') => {
  const req = new Request('http://localhost:3000/api/payment/verify', {
    method,
    body: JSON.stringify(body),
    headers: new Headers({
      'content-type': 'application/json',
    }),
  });
  req.json = Object.assign(vi.fn().mockResolvedValue(body), req.json);
  return req;
};

describe('Payment API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    process.env.SUPABASE_JWT_SECRET = 'test-jwt-secret';
    process.env.INTERNAL_API_SECRET = 'test-internal-api-secret';
    process.env.ASSESSMENT_JWT_SECRET = 'test-assessment-jwt-secret';
    process.env.RAZORPAY_KEY_ID = 'rzp_test_key';
    process.env.RAZORPAY_KEY_SECRET = 'test_secret';
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = 'rzp_test_key';
    process.env.RAZORPAY_WEBHOOK_SECRET = 'test-webhook-secret';
  });

  describe('POST /api/payment/create-order', () => {
    it('returns 401 for unauthenticated requests', async () => {
      vi.mocked(createServerSupabase).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
      } as any);

      const res = await postCreateOrder();

      expect(res.status).toBe(401);
    });

    it('returns 400 if user is already premium', async () => {
      vi.mocked(getUserSubscriptionStatus).mockResolvedValue({
        status: 'premium',
        expiresAt: new Date().toISOString(),
      });

      vi.mocked(createServerSupabase).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
        },
      } as any);

      const res = await postCreateOrder();

      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error).toBe('SUBSCRIPTION_EXISTS');
    });

    it('creates a Razorpay order for free users', async () => {
      vi.mocked(getUserSubscriptionStatus).mockResolvedValue({
        status: 'free',
        expiresAt: null,
      });

      vi.mocked(createServerSupabase).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
        },
      } as any);

      const res = await postCreateOrder();

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({
        subscriptionId: 'sub_test123',
        planId: 'plan_premium_monthly_499',
        status: 'created',
        keyId: 'rzp_test_key',
      });
    });
  });

  describe('POST /api/payment/verify', () => {
    it('returns 400 for invalid signature', async () => {
      vi.mocked(createServerSupabase).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
        },
      } as any);

      const res = await postVerify(createRequest({
        razorpay_order_id: 'order_1',
        razorpay_payment_id: 'pay_1',
        razorpay_signature: 'invalid_signature',
      }));

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Invalid signature');
    });

    it('returns 200 and updates subscription on valid signature', async () => {
      const orderId = 'order_test123';
      const paymentId = 'pay_test123';

      // Create a valid signature
      const signature = crypto
        .createHmac('sha256', 'test_secret')
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const insert = vi.fn().mockResolvedValue({ error: null });
      const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });

      vi.mocked(getServiceClient).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'subscriptions') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle,
              insert,
            };
          }
          if (table === 'profiles') {
            return { update: () => ({ eq: () => ({ error: null }) }) };
          }
          return {};
        }),
      } as any);

      vi.mocked(createServerSupabase).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
        },
      } as any);

      vi.mocked(invalidateStudentContext).mockResolvedValue(undefined);

      const res = await postVerify(createRequest({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
      }));

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(insert).toHaveBeenCalledTimes(1);
      expect(invalidateStudentContext).toHaveBeenCalledWith('user-1');
    });

    it('returns success without inserting when subscription already exists', async () => {
      const orderId = 'order_replay';
      const paymentId = 'pay_replay';

      const signature = crypto
        .createHmac('sha256', 'test_secret')
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const insert = vi.fn();
      const maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'sub-existing' }, error: null });

      vi.mocked(getServiceClient).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'subscriptions') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle,
              insert,
            };
          }
          if (table === 'profiles') {
            return { update: () => ({ eq: () => ({ error: null }) }) };
          }
          return {};
        }),
      } as any);

      vi.mocked(createServerSupabase).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
        },
      } as any);

      const res = await postVerify(createRequest({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
      }));

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(insert).not.toHaveBeenCalled();
      expect(maybeSingle).toHaveBeenCalledTimes(1);
    });

    it('returns 401 for unauthenticated requests', async () => {
      vi.mocked(createServerSupabase).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
      } as any);

      const res = await postVerify(createRequest({
        razorpay_order_id: 'order_1',
        razorpay_payment_id: 'pay_1',
        razorpay_signature: 'sig',
      }));

      expect(res.status).toBe(401);
    });

    it('returns 400 for missing payment details', async () => {
      vi.mocked(createServerSupabase).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
        },
      } as any);

      const res = await postVerify(createRequest({
        razorpay_order_id: 'order_1',
        // missing payment_id and signature
      }));

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Missing payment details');
    });
  });

  describe('POST /api/payment/webhook', () => {
    const WEBHOOK_SECRET = 'test-webhook-secret';

    beforeEach(() => {
      process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
    });

    afterEach(() => {
      delete process.env.RAZORPAY_WEBHOOK_SECRET;
    });

    function makeSignature(body: string, secret: string): string {
      return crypto.createHmac('sha256', secret).update(body).digest('hex');
    }

    it('returns 400 when x-razorpay-signature header is missing', async () => {
      const body = JSON.stringify({ event: 'subscription.charged', payload: { subscription: { id: 'sub_test' } } });
      const req = new Request('http://localhost/api/payment/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Missing signature');
    });

    it('returns 400 when signature is wrong', async () => {
      const body = JSON.stringify({ event: 'subscription.charged', payload: { subscription: { id: 'sub_test' } } });
      const req = new Request('http://localhost/api/payment/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': 'deadbeef'.repeat(8), // wrong
        },
        body,
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Invalid signature');
    });

    it('returns 500 when RAZORPAY_WEBHOOK_SECRET is not set', async () => {
      delete process.env.RAZORPAY_WEBHOOK_SECRET;
      const body = JSON.stringify({ event: 'subscription.charged', payload: {} });
      const req = new Request('http://localhost/api/payment/webhook', {
        method: 'POST',
        body,
      });
      const res = await POST(req);
      expect(res.status).toBe(500);
    });

    it('processes subscription.charged with valid signature', async () => {
      const body = JSON.stringify({
        event: 'subscription.charged',
        payload: {
          subscription: {
            id: 'sub_valid',
            current_start: Math.floor(Date.now() / 1000),
            current_end: Math.floor(Date.now() / 1000) + 2592000,
          },
        },
      });
      const sig = makeSignature(body, WEBHOOK_SECRET);
      const req = new Request('http://localhost/api/payment/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': sig },
        body,
      });

      const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      vi.mocked(getServiceClient).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'subscriptions') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle,
            };
          }
          return {};
        }),
      } as any);

      const res = await POST(req);
      expect(res.status).toBe(200);
    });
  });
});
