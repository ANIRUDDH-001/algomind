import { NextResponse } from 'next/server';

/**
 * Canonical API error shape used by API routes.
 */
export interface ApiErrorBody {
  error: string;
  code: string;
  retryable: boolean;
  degraded_mode?: string;
  user_action?: string;
  details?: string;
}

export const ErrorCodes = {
  // Auth
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  SESSION_EXPIRED: 'session_expired',

  // Rate limiting
  RATE_LIMITED: 'rate_limited',
  MESSAGE_LIMIT: 'message_limit_reached',
  DAILY_LIMIT: 'daily_limit_reached',
  WEEKLY_LIMIT: 'weekly_limit_reached',

  // Validation
  INVALID_INPUT: 'invalid_input',
  MISSING_FIELD: 'missing_field',

  // Server
  INTERNAL_ERROR: 'internal_error',
  SERVICE_UNAVAILABLE: 'service_unavailable',
  PROVIDER_ERROR: 'provider_error',
  TIMEOUT: 'timeout',

  // Domain
  NOT_FOUND: 'not_found',
  ALREADY_COMPLETED: 'already_completed',
  SESSION_NOT_ACTIVE: 'session_not_active',
  ANALYSIS_STARTED: 'analysis_started',
  CAMPAIGN_EXPIRED: 'campaign_expired',
  FEATURE_DISABLED: 'feature_disabled',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

const isDev = process.env.NODE_ENV === 'development';

export function apiError(
  status: number,
  code: ErrorCode,
  message: string,
  options?: {
    retryable?: boolean;
    degraded_mode?: string;
    user_action?: string;
    details?: string;
    headers?: Record<string, string>;
  }
): NextResponse {
  const body: ApiErrorBody = {
    error: message,
    code,
    retryable: options?.retryable ?? false,
    ...(options?.degraded_mode && { degraded_mode: options.degraded_mode }),
    ...(options?.user_action && { user_action: options.user_action }),
    ...(isDev && options?.details && { details: options.details }),
  };

  return NextResponse.json(body, {
    status,
    headers: options?.headers,
  });
}

export const ApiErrors = {
  unauthorized: (msg = 'Authentication required') =>
    apiError(401, ErrorCodes.UNAUTHORIZED, msg, { user_action: 'refresh' }),

  forbidden: (msg = 'Access denied') =>
    apiError(403, ErrorCodes.FORBIDDEN, msg),

  notFound: (msg = 'Resource not found') =>
    apiError(404, ErrorCodes.NOT_FOUND, msg),

  badRequest: (msg: string, details?: string) =>
    apiError(400, ErrorCodes.INVALID_INPUT, msg, { details }),

  rateLimited: (msg: string, headers?: Record<string, string>) =>
    apiError(429, ErrorCodes.RATE_LIMITED, msg, {
      retryable: true,
      user_action: 'retry',
      headers,
    }),

  serverError: (msg = 'Internal server error', details?: string) =>
    apiError(500, ErrorCodes.INTERNAL_ERROR, msg, { retryable: true, details }),

  serviceUnavailable: (msg: string, degraded_mode?: string) =>
    apiError(503, ErrorCodes.SERVICE_UNAVAILABLE, msg, {
      retryable: true,
      degraded_mode,
    }),
};
