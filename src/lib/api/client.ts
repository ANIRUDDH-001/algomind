import { parseApiError } from '@/lib/api/parse-error';

export class ApiClientError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
  }
}

function toQueryString(query?: Record<string, string | number | boolean | undefined | null>): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    params.set(key, String(value));
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

async function ensureOk(response: Response): Promise<void> {
  if (response.ok) return;
  const parsed = await parseApiError(response);
  throw new ApiClientError(parsed.error || `HTTP ${response.status}`, response.status, parsed.code);
}

export async function requestJson<T>(
  path: string,
  options?: RequestInit,
  query?: Record<string, string | number | boolean | undefined | null>
): Promise<T> {
  const response = await fetch(`${path}${toQueryString(query)}`, options);
  await ensureOk(response);
  return (await response.json()) as T;
}

export async function requestBlob(
  path: string,
  options?: RequestInit,
  query?: Record<string, string | number | boolean | undefined | null>
): Promise<{ blob: Blob; response: Response }> {
  const response = await fetch(`${path}${toQueryString(query)}`, options);
  await ensureOk(response);
  return { blob: await response.blob(), response };
}

export async function requestVoid(
  path: string,
  options?: RequestInit,
  query?: Record<string, string | number | boolean | undefined | null>
): Promise<void> {
  const response = await fetch(`${path}${toQueryString(query)}`, options);
  await ensureOk(response);
}
