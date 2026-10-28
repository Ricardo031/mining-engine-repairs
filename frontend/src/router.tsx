import { createBrowserRouter, type RouteObject } from 'react-router';
import { RequireAdmin, RequireAuth } from './auth/guards';
import { AppLayout } from './components/layout/AppLayout';
import { Spinner } from './components/ui/feedback';
import { LoginPage } from './pages/LoginPage';
import { RouteErrorPage } from './pages/RouteErrorPage';

/** Each page is loaded on demand, so the first load only downloads what it needs. */
export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage />, errorElement: <RouteErrorPage /> },
  {
    // Everything else requires a session and shares the sidebar layout.
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    hydrateFallbackElement: <Spinner />,
    // A page that crashes shows a friendly message (the sidebar stays usable).
    children: [
      {
        errorElement: <RouteErrorPage />,
        children: [
          {
            index: true,
            lazy: async () => ({
              Component: (await import('./pages/DashboardPage')).DashboardPage,
            }),
          },
          {
            path: 'orders',
            lazy: async () => ({
              Component: (await import('./pages/orders/OrdersPage')).OrdersPage,
            }),
          },
          {
            path: 'orders/new',
            lazy: async () => ({
              Component: (await import('./pages/orders/NewOrderPage')).NewOrderPage,
            }),
          },
          {
            path: 'orders/:id',
            lazy: async () => ({
              Component: (await import('./pages/orders/OrderDetailPage')).OrderDetailPage,
            }),
          },
          {
            path: 'clients',
            lazy: async () => ({
              Component: (await import('./pages/clients/ClientsPage')).ClientsPage,
            }),
          },
          {
            path: 'clients/:id',
            lazy: async () => ({
              Component: (await import('./pages/clients/ClientDetailPage')).ClientDetailPage,
            }),
          },
          {
            path: 'engines',
            lazy: async () => ({
              Component: (await import('./pages/engines/EnginesPage')).EnginesPage,
            }),
          },
          {
            path: 'engines/:id',
            lazy: async () => ({
              Component: (await import('./pages/engines/EngineDetailPage')).EngineDetailPage,
            }),
          },
          {
            path: 'users',
            lazy: async () => {
              const { UsersPage } = await import('./pages/users/UsersPage');
              return {
                Component: () => (
                  <RequireAdmin>
                    <UsersPage />
                  </RequireAdmin>
                ),
              };
            },
          },
          {
            path: '*',
            lazy: async () => ({ Component: (await import('./pages/NotFoundPage')).NotFoundPage }),
          },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
