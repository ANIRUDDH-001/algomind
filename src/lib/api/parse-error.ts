import type { ApiErrorBody } from './error-response';

/**
 * Parses both canonical and legacy API error responses.
 */
export async function parseApiError(response: Response): Promise<ApiErrorBody> {
  try {
    const body = await response.json();

    if (body && typeof body === 'object' && body.code && body.error) {
      return body as ApiErrorBody;
    }

    return {
      error: body?.error || body?.message || 'Unknown error',
      code: body?.code || 'unknown',
      retryable: body?.retryable ?? response.status >= 500,
      degraded_mode: body?.degraded_mode || body?.fallback,
      user_action: body?.user_action,
    };
  } catch {
    return {
      error: `HTTP ${response.status}`,
      code: 'unknown',
      retryable: response.status >= 500,
    };
  }
}
