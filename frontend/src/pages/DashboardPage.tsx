import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Clock3, Cog, TrendingDown, TrendingUp } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { ordersApi } from '../api/endpoints';
import { ORDER_STATUSES, type OrderListItem, type OrdersSummary } from '../api/types';
import { useAuth } from '../auth/useAuth';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState, ErrorState, Spinner } from '../components/ui/feedback';
import { Card, PageHeader } from '../components/ui/layout';
import { Table, type Column } from '../components/ui/Table';
import { cn } from '../lib/cn';
import { formatDate, formatLongDay, greeting, isOverdue, todayIso } from '../lib/format';
import { STATUS_SHORT_LABELS } from '../lib/labels';

/** Stages that happen inside the workshop (everything except "Entregado"). */
const WORKSHOP_STATUSES = ORDER_STATUSES.filter((status) => status !== 'DELIVERED');

const recentColumns: Column<OrderListItem>[] = [
  { header: 'Orden', cell: (o) => <span className="font-semibold text-navy-950">{o.order_number}</span> },
  { header: 'Cliente', cell: (o) => o.client.name },
  { header: 'Motor', cell: (o) => `${o.engine.manufacturer} ${o.engine.model}` },
  { header: 'Estado', cell: (o) => <StatusBadge status={o.status} /> },
  {
    header: 'Entrega est.',
    cell: (o) => (
      <span className={cn(isOverdue(o.estimated_delivery_date, o.actual_delivery_date) && 'font-medium text-red-600')}>
        {formatDate(o.estimated_delivery_date)}
      </span>
    ),
  },
];

function StatIcon({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <div
      className={cn(
        'flex size-11 items-center justify-center rounded-xl',
        dark ? 'bg-navy-700 text-slate-200' : 'bg-brand-100 text-brand-700',
      )}
    >
      {children}
    </div>
  );
}

/** Dark hero card: active orders + orders received per day (last 7 days). */
function ActiveOrdersCard({ summary }: { summary: OrdersSummary }) {
  const max = Math.max(1, ...summary.received_by_day.map((day) => day.count));
  return (
    <div className="relative overflow-hidden rounded-2xl bg-navy-900 p-6 text-white lg:col-span-2">
      <div className="flex gap-4">
        <StatIcon dark>
          <Cog className="size-5" />
        </StatIcon>
        <div>
          <p className="text-sm text-slate-300">Órdenes activas en taller</p>
          <p className="mt-1 text-4xl font-bold tracking-tight">{summary.active}</p>
          <p className="mt-2 text-xs text-slate-400">
            <span className="font-semibold text-brand-400">+{summary.received_last_7_days}</span>{' '}
            recibidas en los últimos 7 días
          </p>
        </div>
      </div>
      <div
        className="absolute bottom-6 right-6 flex h-14 items-end gap-1.5"
        role="img"
        aria-label={`Órdenes recibidas por día: ${summary.received_by_day.map((d) => d.count).join(', ')}`}
      >
        {summary.received_by_day.map((day) => (
          <span
            key={day.date}
            title={`${formatDate(day.date)}: ${day.count}`}
            className="w-2 rounded-t-sm bg-linear-to-t from-brand-700 to-brand-400"
            style={{ height: `${Math.max(12, (day.count / max) * 100)}%`, opacity: day.count ? 1 : 0.35 }}
          />
        ))}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  footer,
  to,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  footer: ReactNode;
  to?: string;
}) {
  return (
    <div className="relative rounded-2xl bg-white p-6 ring-1 ring-slate-200/80">
      <div className="flex gap-4">
        <StatIcon>{icon}</StatIcon>
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-1 text-4xl font-bold tracking-tight text-navy-950">{value}</p>
          <div className="mt-2 text-xs text-slate-500">{footer}</div>
        </div>
      </div>
      {to && (
        <Link
          to={to}
          aria-label={`Ver ${label.toLowerCase()}`}
          className="absolute right-5 top-5 flex size-8 items-center justify-center rounded-lg ring-1 ring-slate-200 text-slate-500 transition hover:bg-brand-500 hover:text-navy-950 hover:ring-brand-500"
        >
          <ChevronRight className="size-4" />
        </Link>
      )}
    </div>
  );
}

/** "+12%" vs last month, or a neutral text when there is nothing to compare with. */
function MonthTrend({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) {
    return <span>{current > 0 ? 'Sin entregas el mes anterior' : 'Aún sin entregas este mes'}</span>;
  }
  const change = Math.round(((current - previous) / previous) * 100);
  const up = change >= 0;
  return (
    <span className="inline-flex items-center gap-1">
      {up ? (
        <TrendingUp className="size-3.5 text-brand-600" aria-hidden />
      ) : (
        <TrendingDown className="size-3.5 text-red-500" aria-hidden />
      )}
      <span className={cn('font-semibold', up ? 'text-brand-700' : 'text-red-600')}>
        {up ? '+' : ''}
        {change}%
      </span>
      vs. mes anterior
    </span>
  );
}

function WorkflowCards({ summary }: { summary: OrdersSummary }) {
  const counts = new Map(summary.by_status.map((row) => [row.status, row.count]));
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
      {WORKSHOP_STATUSES.map((status) => {
        const count = counts.get(status) ?? 0;
        const share = summary.active ? (count / summary.active) * 100 : 0;
        return (
          <Link
            key={status}
            to={`/orders?status=${status}`}
            className="group relative overflow-hidden rounded-2xl bg-white p-4 ring-1 ring-slate-200/80 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-brand-400"
          >
            {/* Decorative quarter circle */}
            <span
              className="pointer-events-none absolute -right-7 -top-7 size-20 rounded-full bg-brand-100/70 transition group-hover:bg-brand-200/80"
              aria-hidden
            />
            <p className="relative text-sm font-semibold text-navy-950">{STATUS_SHORT_LABELS[status]}</p>
            <p className="relative mt-3 text-3xl font-bold text-navy-950">{count}</p>
            <div className="mt-4 h-1 rounded-full bg-slate-100">
              <div
                className="h-1 rounded-full bg-brand-500"
                style={{ width: `${share}%` }}
                role="progressbar"
                aria-valuenow={Math.round(share)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${Math.round(share)}% de las órdenes activas`}
              />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const today = todayIso();

  const summary = useQuery({
    queryKey: ['orders', 'summary', today],
    queryFn: () => ordersApi.summary(today),
  });
  const recent = useQuery({
    queryKey: ['orders', 'list', { recent: true }],
    queryFn: () => ordersApi.list({ limit: 5 }),
  });

  const overdue = summary.data?.overdue ?? 0;

  return (
    <>
      <PageHeader
        eyebrow={formatLongDay()}
        title={
          <>
            {greeting()}, <span className="text-brand-600">{user?.firstName}</span>
          </>
        }
        description={
          overdue > 0
            ? `Hay ${overdue} ${overdue === 1 ? 'orden' : 'órdenes'} con la entrega vencida.`
            : 'Todo bajo control. Este es el estado actual de tu taller.'
        }
        actions={
          <span
            className={cn(
              'inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-xs font-semibold ring-1 ring-slate-200',
              summary.isError ? 'text-red-600' : 'text-navy-950',
            )}
          >
            <span className="relative flex size-2">
              {!summary.isError && (
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-400 opacity-60" />
              )}
              <span
                className={cn('relative inline-flex size-2 rounded-full', summary.isError ? 'bg-red-500' : 'bg-brand-500')}
              />
            </span>
            {summary.isError ? 'Sin conexión' : 'Operación activa'}
          </span>
        }
      />

      {summary.isPending ? (
        <Spinner />
      ) : summary.isError ? (
        <ErrorState error={summary.error} onRetry={() => summary.refetch()} />
      ) : (
        <>
          <div className="grid gap-5 lg:grid-cols-4">
            <ActiveOrdersCard summary={summary.data} />
            <StatCard
              icon={<Clock3 className="size-5" />}
              label="Entregas próximas"
              value={summary.data.due_soon}
              to="/orders"
              footer={
                <>
                  En los próximos 7 días
                  {overdue > 0 && <span className="font-semibold text-red-600"> · {overdue} vencidas</span>}
                </>
              }
            />
            <StatCard
              icon={<TrendingUp className="size-5" />}
              label="Entregadas este mes"
              value={summary.data.delivered_this_month}
              footer={
                <MonthTrend
                  current={summary.data.delivered_this_month}
                  previous={summary.data.delivered_last_month}
                />
              }
            />
          </div>

          <div className="mb-4 mt-10 flex items-end justify-between">
            <div>
              <h2 className="text-lg font-semibold text-navy-950">Flujo de trabajo</h2>
              <p className="text-xs text-slate-500">Distribución de las órdenes activas por etapa</p>
            </div>
            <p className="text-xs text-slate-500">{summary.data.total} órdenes totales</p>
          </div>
          <WorkflowCards summary={summary.data} />
        </>
      )}

      <Card
        className="mt-8"
        title="Órdenes recientes"
        description="Últimas órdenes registradas en el taller"
        bodyClassName="p-0"
        actions={
          <Link
            to="/orders"
            className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-600"
          >
            Ver todas <ChevronRight className="size-4" />
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
            rowLabel={(order) => `Ver orden ${order.order_number}`}
          />
        )}
      </Card>
    </>
  );
}
