import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Order } from '../../api/types';
import { jsonResponse, loginAs, mockFetch, renderRoutes } from '../../test/utils';
import { StatusChangePanel } from './StatusChangePanel';

const baseOrder: Order = {
  id: 'o-1',
  order_number: 'OR-2026-000001',
  status: 'IN_TESTING',
  engine: {
    id: 'e-1',
    serial_number: 'CAT-1',
    manufacturer: 'Caterpillar',
    model: '3516',
    engine_type: 'Diesel',
    power: '2000 HP',
  },
  client: { id: 'c-1', name: 'Minera', identification_type: 'NIT', identification_number: '900' },
  technician: 'Ana',
  received_at: '2026-10-01',
  estimated_delivery_date: '2026-10-20',
  actual_delivery_date: null,
  created_at: '2026-10-01T10:00:00Z',
  updated_at: '2026-10-01T10:00:00Z',
  reported_problem: 'Overheating',
  diagnosis: 'Broken pump',
  work_performed: null,
  observations: null,
  created_by: 'u-1',
  created_by_email: 'admin@mining-repairs.local',
  status_history: [],
  allowed_next_statuses: ['COMPLETED', 'IN_REPAIR'],
};

function renderPanel(order: Order) {
  loginAs();
  return renderRoutes([{ path: '/', element: <StatusChangePanel order={order} /> }]);
}

afterEach(() => vi.unstubAllGlobals());

describe('StatusChangePanel', () => {
  it('only offers the statuses allowed by the API', async () => {
    renderPanel(baseOrder);

    expect(await screen.findByRole('button', { name: 'Finalizado' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'En reparación' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Entregado' })).not.toBeInTheDocument();
  });

  it('sends the new status with the note and only the changed details', async () => {
    const fetchMock = mockFetch().mockResolvedValue(
      jsonResponse(200, { data: { ...baseOrder, status: 'COMPLETED', allowed_next_statuses: ['DELIVERED'] } }),
    );
    renderPanel(baseOrder);

    await userEvent.click(await screen.findByRole('button', { name: 'Finalizado' }));
    await userEvent.type(screen.getByLabelText('Trabajo realizado'), 'Pump replaced');
    await userEvent.type(screen.getByLabelText('Nota del cambio'), 'All tests passed');
    await userEvent.click(screen.getByRole('button', { name: /Pasar a/ }));

    expect(await screen.findByText('Orden actualizada a "Finalizado".')).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toMatch(/\/orders\/o-1\/status$/);
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(String(init?.body))).toEqual({
      status: 'COMPLETED',
      note: 'All tests passed',
      work_performed: 'Pump replaced',
    });
  });

  it('asks for the delivery date when delivering', async () => {
    renderPanel({ ...baseOrder, status: 'COMPLETED', allowed_next_statuses: ['DELIVERED'] });

    await userEvent.click(await screen.findByRole('button', { name: 'Entregado' }));
    expect(screen.getByLabelText(/Fecha real de entrega/)).toBeInTheDocument();
  });

  it('explains that delivered orders are closed', async () => {
    renderPanel({ ...baseOrder, status: 'DELIVERED', allowed_next_statuses: [] });
    expect(await screen.findByText(/Ya no admite cambios de estado/)).toBeInTheDocument();
  });
});
