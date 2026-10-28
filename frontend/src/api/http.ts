import { getToken } from '../auth/session';

export interface ApiErrorDetail {
  path: string;
  message: string;
}

/** Error returned by either API: { error: { code, message, details?, requestId? } } */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ApiErrorDetail[];
  readonly requestId?: string;

  constructor(
    status: number,
    code: string,
    message: string,
    details: ApiErrorDetail[] = [],
    requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;

/** The auth provider registers here what to do when a token is rejected (log out). */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  onUnauthorized = handler;
}

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: QueryParams;
  /** false for the login request: a 401 there means wrong credentials, not an expired session. */
  auth?: boolean;
}

export function buildUrl(baseUrl: string, path: string, query?: QueryParams): string {
  const url = new URL(`${baseUrl}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export async function request<T>(
  baseUrl: string,
  path: string,
  { method = 'GET', body, query, auth = true }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const token = auth ? getToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(buildUrl(baseUrl, path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Network error');
  }

  if (response.status === 204) return undefined as T;

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error = (payload as { error?: Partial<ApiError> & { details?: ApiErrorDetail[] } } | null)
      ?.error;
    const apiError = new ApiError(
      response.status,
      error?.code ?? 'HTTP_ERROR',
      error?.message ?? response.statusText,
      error?.details ?? [],
      error?.requestId,
    );
    if (response.status === 401 && auth && onUnauthorized) onUnauthorized();
    throw apiError;
  }

  return payload as T;
}
