import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequireAuth } from '../auth/guards';
import { loadSession } from '../auth/session';
import { adminUser, jsonResponse, loginAs, mockFetch, renderRoutes } from '../test/utils';
import { LoginPage } from './LoginPage';

const routes = [
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <p>Área privada</p>
      </RequireAuth>
    ),
  },
];

afterEach(() => vi.unstubAllGlobals());

describe('LoginPage', () => {
  it('redirects to the login when there is no session', async () => {
    const { router } = renderRoutes(routes, '/');
    expect(await screen.findByRole('heading', { name: 'Inicia sesión' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });

  it('validates the form before calling the API', async () => {
    const fetchMock = mockFetch();
    renderRoutes(routes, '/login');

    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'no-es-un-correo');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByText('Correo no válido')).toBeInTheDocument();
    expect(screen.getByText('Ingresa tu contraseña')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows a clear message for wrong credentials', async () => {
    mockFetch().mockResolvedValue(
      jsonResponse(401, { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } }),
    );
    renderRoutes(routes, '/login');

    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'admin@mining-repairs.local');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'Wrong123');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByText('Correo o contraseña incorrectos.')).toBeInTheDocument();
    expect(loadSession()).toBeNull();
  });

  it('stores the session and enters the app after a successful login', async () => {
    mockFetch().mockResolvedValue(
      jsonResponse(200, {
        data: { accessToken: 'jwt-token', tokenType: 'Bearer', expiresIn: 3600, user: adminUser },
      }),
    );
    renderRoutes(routes, '/login');

    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'admin@mining-repairs.local');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'Admin1234');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByText('Área privada')).toBeInTheDocument();
    await waitFor(() => expect(loadSession()?.token).toBe('jwt-token'));
  });

  it('skips the login page when a session already exists', async () => {
    loginAs();
    renderRoutes(routes, '/login');
    expect(await screen.findByText('Área privada')).toBeInTheDocument();
  });
});
