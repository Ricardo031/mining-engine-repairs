import { afterEach, describe, expect, it, vi } from 'vitest';
import { adminUser, jsonResponse, loginAs, mockFetch } from '../test/utils';
import { getErrorMessage } from './errors';
import { ApiError, buildUrl, request, setUnauthorizedHandler } from './http';

const BASE = 'http://api.test/api/v1';

afterEach(() => {
  vi.unstubAllGlobals();
  setUnauthorizedHandler(null);
});

describe('buildUrl', () => {
  it('skips empty query values', () => {
    expect(buildUrl(BASE, '/orders', { status: 'RECEIVED', search: '', client_id: undefined, page: 2 })).toBe(
      `${BASE}/orders?status=RECEIVED&page=2`,
    );
  });
});

describe('request', () => {
  it('sends the session token as a Bearer header', async () => {
    loginAs(adminUser, 'abc.def.ghi');
    const fetchMock = mockFetch().mockResolvedValue(jsonResponse(200, { data: [] }));

    await request(BASE, '/clients');

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer abc.def.ghi');
  });

  it('turns the API error body into an ApiError', async () => {
    mockFetch().mockResolvedValue(
      jsonResponse(409, {
        error: { code: 'CONFLICT', message: 'An engine with serial number X already exists', requestId: 'r1' },
      }),
    );

    const error = await request(BASE, '/engines', { method: 'POST', body: {} }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: 'CONFLICT', requestId: 'r1' });
    expect(getErrorMessage(error)).toBe('Ya existe un motor con ese número de serie.');
  });

  it('ends the session on 401 for authenticated requests', async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    mockFetch().mockResolvedValue(jsonResponse(401, { error: { code: 'TOKEN_EXPIRED', message: 'expired' } }));

    await expect(request(BASE, '/orders')).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it('does not end the session when the login itself fails', async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    mockFetch().mockResolvedValue(
      jsonResponse(401, { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } }),
    );

    await expect(request(BASE, '/auth/login', { method: 'POST', auth: false })).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('reports network failures with a friendly message', async () => {
    mockFetch().mockRejectedValue(new TypeError('Failed to fetch'));

    const error = await request(BASE, '/orders').catch((e: unknown) => e);

    expect(error).toMatchObject({ code: 'NETWORK_ERROR' });
    expect(getErrorMessage(error)).toMatch(/No hay conexión/);
  });
});
