import { enableDemoMode, isDemoMode } from '@/lib/demoMode';
import { getDemoResponse } from '@/lib/demoData';

export type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace(/\/$/, '');
let refreshing: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = fetch(`${apiBase}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then((response) => response.ok)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  canRefresh = true,
): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const pathname = new URL(path, apiBase).pathname.replace(/^\/api/, '');
  const isAuthFlow = ['/auth/login', '/auth/register', '/auth/logout'].includes(pathname);
  if (isDemoMode() && method !== 'GET' && !isAuthFlow) {
    throw new ApiError('Demo mode is read-only. Sign in or exit demo mode to make changes.', 403);
  }
  if (isDemoMode() && method === 'GET') {
    const demoResponse = getDemoResponse(path);
    if (demoResponse !== undefined) return demoResponse as T;
  }

  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  let response: Response;
  try {
    response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    });
  } catch (error) {
    if (method === 'GET') {
      const demoResponse = getDemoResponse(path);
      if (demoResponse !== undefined) {
        enableDemoMode('offline');
        return demoResponse as T;
      }
    }
    throw error;
  }
  if (method === 'GET' && response.status >= 500 && response.status < 600) {
    const demoResponse = getDemoResponse(path);
    if (demoResponse !== undefined) {
      enableDemoMode('offline');
      return demoResponse as T;
    }
  }
  if (response.status === 401 && canRefresh && path !== '/auth/refresh' && !['/auth/login', '/auth/register', '/auth/logout'].includes(path)) {
    if (await refreshSession()) {
      response = await fetch(`${apiBase}${path}`, {
        ...options,
        headers,
        credentials: 'include',
      });
    }
  }

  const payload = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;
  if (!response.ok) {
    throw new ApiError(payload.error || `Request failed (${response.status})`, response.status);
  }
  return payload.data as T;
}

export const api = {
  get: <T>(path: string) => apiRequest<T>(path),
  post: <T>(path: string, body?: unknown) =>
    apiRequest<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    apiRequest<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
};
