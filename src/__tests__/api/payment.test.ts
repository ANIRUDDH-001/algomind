import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as postCreateOrder } from '@/app/api/payment/create-order/route';
import { POST as postVerify } from '@/app/api/payment/verify/route';
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
    orders: {
      create: vi.fn().mockResolvedValue({
        id: 'order_test123',
        amount: 49900,
        currency: 'INR',
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
    process.env.RAZORPAY_KEY_ID = 'rzp_test_key';
    process.env.RAZORPAY_KEY_SECRET = 'test_secret';
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = 'rzp_test_key';
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

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Already subscribed');
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
        orderId: 'order_test123',
        amount: 49900,
        currency: 'INR',
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
      const update = vi.fn().mockResolvedValue({ error: null });

      vi.mocked(getServiceClient).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'subscriptions') {
            return { insert };
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
      expect(invalidateStudentContext).toHaveBeenCalledWith('user-1');
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
});
