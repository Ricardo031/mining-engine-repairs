import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { ordersApi } from '../api/endpoints';
import { ORDER_STATUSES, type OrderListItem } from '../api/types';
import { useAuth } from '../auth/useAuth';
import { StatusBadge } from '../components/StatusBadge';
import { ButtonLink } from '../components/ui/Button';
import { EmptyState, ErrorState, Spinner } from '../components/ui/feedback';
import { Card, PageHeader } from '../components/ui/layout';
import { Table, type Column } from '../components/ui/Table';
import { cn } from '../lib/cn';
import { formatDate, isOverdue } from '../lib/format';
import { STATUS_LABELS, STATUS_STYLES } from '../lib/labels';

const recentColumns: Column<OrderListItem>[] = [
  {
    header: 'Orden',
    cell: (o) => <span className="font-medium text-slate-900">{o.order_number}</span>,
  },
  { header: 'Cliente', cell: (o) => o.client.name },
  { header: 'Motor', cell: (o) => o.engine.serial_number },
  { header: 'Estado', cell: (o) => <StatusBadge status={o.status} /> },
  {
    header: 'Entrega estimada',
    cell: (o) => (
      <span
        className={cn(isOverdue(o.estimated_delivery_date, o.actual_delivery_date) && 'text-red-600')}
      >
        {formatDate(o.estimated_delivery_date)}
      </span>
    ),
  },
];

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const summary = useQuery({ queryKey: ['orders', 'summary'], queryFn: ordersApi.summary });
  const recent = useQuery({
    queryKey: ['orders', 'list', { recent: true }],
    queryFn: () => ordersApi.list({ limit: 6 }),
  });

  const counts = new Map(summary.data?.by_status.map((row) => [row.status, row.count]));
  const open = summary.data
    ? summary.data.total - (counts.get('DELIVERED') ?? 0)
    : undefined;

  return (
    <>
      <PageHeader
        title={`Hola, ${user?.firstName ?? ''}`}
        description="Resumen de las órdenes de reparación del taller."
        actions={
          <ButtonLink to="/orders/new" icon={<Plus className="size-4" />}>
            Nueva orden
          </ButtonLink>
        }
      />

      {summary.isPending ? (
        <Spinner />
      ) : summary.isError ? (
        <ErrorState error={summary.error} onRetry={() => summary.refetch()} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-900 p-5 text-white">
              <p className="text-sm text-slate-400">Órdenes en el taller</p>
              <p className="mt-2 text-4xl font-semibold">{open}</p>
              <p className="mt-1 text-xs text-slate-400">Todas las que aún no se entregan</p>
            </div>
            <div className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
              <p className="text-sm text-slate-500">Total histórico</p>
              <p className="mt-2 text-4xl font-semibold text-slate-900">{summary.data.total}</p>
              <p className="mt-1 text-xs text-slate-500">
                {counts.get('DELIVERED') ?? 0} entregadas
              </p>
            </div>
          </div>

          <h2 className="mb-3 mt-8 text-sm font-semibold text-slate-900">Órdenes por estado</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            {ORDER_STATUSES.map((status) => (
              <Link
                key={status}
                to={`/orders?status=${status}`}
                className="group rounded-xl bg-white p-4 ring-1 ring-slate-200 transition hover:ring-brand-500"
              >
                <div className="flex items-center gap-2">
                  <span className={cn('size-2 rounded-full', STATUS_STYLES[status].dot)} />
                  <span className="truncate text-xs font-medium text-slate-500">
                    {STATUS_LABELS[status]}
                  </span>
                </div>
                <p className="mt-3 text-2xl font-semibold text-slate-900">
                  {counts.get(status) ?? 0}
                </p>
              </Link>
            ))}
          </div>
        </>
      )}

      <Card
        className="mt-8"
        title="Órdenes recientes"
        bodyClassName="p-0"
        actions={
          <Link
            to="/orders"
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-600"
          >
            Ver todas <ArrowRight className="size-4" />
          </Link>
        }
      >
        {recent.isPending ? (
          <Spinner />
        ) : recent.isError ? (
          <ErrorState error={recent.error} onRetry={() => recent.refetch()} />
        ) : recent.data.data.length === 0 ? (
          <EmptyState
            title="Aún no hay órdenes"
            description="Registra un cliente y su motor, y luego crea la primera orden."
          />
        ) : (
          <Table
            columns={recentColumns}
            rows={recent.data.data}
            onRowClick={(order) => navigate(`/orders/${order.id}`)}
          />
        )}
      </Card>
    </>
  );
}
