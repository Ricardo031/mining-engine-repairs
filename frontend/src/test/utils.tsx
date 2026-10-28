import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router';
import { vi } from 'vitest';
import type { User } from '../api/types';
import { AuthProvider } from '../auth/AuthContext';
import { saveSession } from '../auth/session';
import { ToastProvider } from '../components/toast/ToastProvider';

export const adminUser: User = {
  id: 'u-1',
  email: 'admin@mining-repairs.local',
  firstName: 'Ana',
  lastName: 'Admin',
  role: 'admin',
  isActive: true,
  lastLoginAt: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

export function loginAs(user: User = adminUser, token = 'test-token'): void {
  saveSession({ token, user, expiresAt: Date.now() + 3_600_000 });
}

/** Renders routes with every provider the app uses, starting at `path`. */
export function renderRoutes(routes: RouteObject[], path = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { ...result, router };
}

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Replaces global fetch with a mock and returns it. */
export function mockFetch() {
  const fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
