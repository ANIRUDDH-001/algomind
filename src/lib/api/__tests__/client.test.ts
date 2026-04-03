import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { ApiClientError, requestBlob, requestJson, requestVoid } from '@/lib/api/client';

describe('api client helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requestJson appends query params and returns parsed body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ ok: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await requestJson<{ ok: boolean }>('/api/test', undefined, { q: 'hello', page: 2 });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith('/api/test?q=hello&page=2', undefined);
  });

  it('throws ApiClientError for non-ok json response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: vi.fn().mockResolvedValue({ error: 'Forbidden', code: 'forbidden', retryable: false }),
      })
    );

    await expect(requestVoid('/api/test', { method: 'DELETE' })).rejects.toEqual(
      expect.objectContaining<ApiClientError>({
        name: 'ApiClientError',
        status: 403,
        code: 'forbidden',
        message: 'Forbidden',
      })
    );
  });

  it('requestBlob returns blob and response', async () => {
    const blob = new Blob(['csv-data'], { type: 'text/csv' });
    const response = {
      ok: true,
      blob: vi.fn().mockResolvedValue(blob),
      headers: new Headers({ 'Content-Disposition': 'attachment; filename="file.csv"' }),
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));

    const result = await requestBlob('/api/test/blob');

    expect(result.blob).toBe(blob);
    expect(result.response).toBe(response as unknown as Response);
  });
});
