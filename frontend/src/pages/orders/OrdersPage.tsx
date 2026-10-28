import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { clientsApi, enginesApi, ordersApi } from '../../api/endpoints';
import { ORDER_STATUSES, type OrderListItem } from '../../api/types';
import { StatusBadge } from '../../components/StatusBadge';
import { Button, ButtonLink } from '../../components/ui/Button';
import { EmptyState, ErrorState, Spinner } from '../../components/ui/feedback';
import { SearchInput } from '../../components/ui/filters';
import { Select } from '../../components/ui/form';
import { Card, PageHeader, Pagination } from '../../components/ui/layout';
import { Table, type Column } from '../../components/ui/Table';
import { cn } from '../../lib/cn';
import { formatDate, isOverdue } from '../../lib/format';
import { STATUS_LABELS } from '../../lib/labels';
import { useDebounce } from '../../lib/useDebounce';

const columns: Column<OrderListItem>[] = [
  { header: 'Orden', cell: (o) => <span className="font-medium text-slate-900">{o.order_number}</span> },
  { header: 'Cliente', cell: (o) => o.client.name },
  {
    header: 'Motor',
    cell: (o) => (
      <span>
        {o.engine.serial_number}
        <span className="block text-xs text-slate-500">
          {o.engine.manufacturer} {o.engine.model}
        </span>
      </span>
    ),
  },
  { header: 'Estado', cell: (o) => <StatusBadge status={o.status} /> },
  { header: 'Técnico', cell: (o) => o.technician },
  { header: 'Recepción', cell: (o) => formatDate(o.received_at) },
  {
    header: 'Entrega',
    cell: (o) =>
      o.actual_delivery_date ? (
        <span className="text-teal-700">{formatDate(o.actual_delivery_date)}</span>
      ) : (
        <span className={cn(isOverdue(o.estimated_delivery_date, null) && 'font-medium text-red-600')}>
          {formatDate(o.estimated_delivery_date)}
          <span className="block text-xs font-normal text-slate-500">estimada</span>
        </span>
      ),
  },
];

/**
 * Status, client, engine and page live in the URL so they survive reloads and can be
 * linked (e.g. from the dashboard). The free-text search is local and debounced.
 */
export function OrdersPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const clientId = params.get('client_id') ?? '';
  const engineId = params.get('engine_id') ?? '';
  const page = Number(params.get('page') ?? '1') || 1;

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);

  const update = (changes: Record<string, string>) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        if (!('page' in changes)) next.delete('page');
        return next;
      },
      { replace: true },
    );
  };


  const clients = useQuery({
    queryKey: ['clients', 'options', 'all'],
    queryFn: () => clientsApi.list({ limit: 100 }),
  });
  const engines = useQuery({
    queryKey: ['engines', 'options', { client: clientId }],
    queryFn: () => enginesApi.list({ client_id: clientId, limit: 100 }),
  });

  const query = useQuery({
    queryKey: ['orders', 'list', { status, clientId, engineId, search: debouncedSearch, page }],
    queryFn: () =>
      ordersApi.list({
        status,
        client_id: clientId,
        engine_id: engineId,
        search: debouncedSearch,
        page,
        limit: 10,
      }),
    placeholderData: keepPreviousData,
  });

  const hasFilters = Boolean(status || clientId || engineId || debouncedSearch);

  return (
    <>
      <PageHeader
        title="Órdenes de reparación"
        description="Seguimiento de cada servicio desde la recepción hasta la entrega."
        actions={
          <ButtonLink to="/orders/new" icon={<Plus className="size-4" />}>
            Nueva orden
          </ButtonLink>
        }
      />

      <Card bodyClassName="p-0">
        <div className="grid gap-3 border-b border-slate-100 p-4 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr_auto]">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              update({ page: '' });
            }}
            placeholder="Buscar por número, serie, cliente o técnico"
          />
          <Select value={status} onChange={(e) => update({ status: e.target.value })} aria-label="Estado">
            <option value="">Todos los estados</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
          <Select
            value={clientId}
            onChange={(e) => update({ client_id: e.target.value, engine_id: '' })}
            aria-label="Cliente"
          >
            <option value="">Todos los clientes</option>
            {clients.data?.data.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select value={engineId} onChange={(e) => update({ engine_id: e.target.value })} aria-label="Motor">
            <option value="">Todos los motores</option>
            {engines.data?.data.map((e) => (
              <option key={e.id} value={e.id}>
                {e.serial_number}
              </option>
            ))}
          </Select>
          {hasFilters && (
            <Button
              variant="ghost"
              icon={<X className="size-4" />}
              onClick={() => {
                setSearch('');
                setParams({}, { replace: true });
              }}
            >
              Limpiar
            </Button>
          )}
        </div>

        {query.isPending ? (
          <Spinner />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : query.data.data.length === 0 ? (
          <EmptyState
            title={hasFilters ? 'Sin resultados' : 'Aún no hay órdenes'}
            description={hasFilters ? 'Prueba con otros filtros.' : 'Crea la primera orden de reparación.'}
          />
        ) : (
          <>
            <Table columns={columns} rows={query.data.data} onRowClick={(o) => navigate(`/orders/${o.id}`)} />
            <Pagination
              page={query.data.meta.page}
              totalPages={query.data.meta.total_pages}
              total={query.data.meta.total}
              onChange={(next) => update({ page: String(next) })}
            />
          </>
        )}
      </Card>
    </>
  );
}
