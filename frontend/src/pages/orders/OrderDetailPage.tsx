import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CalendarClock, Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { ordersApi } from '../../api/endpoints';
import { ORDER_STATUSES, type Order, type OrderStatus } from '../../api/types';
import { StatusBadge } from '../../components/StatusBadge';
import { ErrorState, Spinner } from '../../components/ui/feedback';
import { Card, DetailList, PageHeader } from '../../components/ui/layout';
import { cn } from '../../lib/cn';
import { formatDate, formatDateTime, isOverdue } from '../../lib/format';
import { STATUS_LABELS, STATUS_STYLES } from '../../lib/labels';
import { StatusChangePanel } from './StatusChangePanel';

/** Main path of the workflow, shown as a progress bar. */
function ProgressSteps({ status }: { status: OrderStatus }) {
  const currentIndex = ORDER_STATUSES.indexOf(status);
  return (
    <ol className="grid grid-cols-7 gap-1" aria-label="Progreso de la orden">
      {ORDER_STATUSES.map((step, index) => {
        const done = index < currentIndex || status === 'DELIVERED';
        const current = index === currentIndex && status !== 'DELIVERED';
        return (
          <li key={step} className="flex flex-col gap-2" aria-current={current ? 'step' : undefined}>
            <span
              className={cn(
                'h-1.5 rounded-full',
                done ? 'bg-emerald-500' : current ? 'bg-brand-500' : 'bg-slate-200',
              )}
            />
            <span
              className={cn(
                'hidden text-xs md:block',
                current ? 'font-semibold text-slate-900' : done ? 'text-slate-600' : 'text-slate-400',
              )}
            >
              {STATUS_LABELS[step]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function TextBlock({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</h3>
      {value ? (
        <p className="mt-1 whitespace-pre-line text-sm text-slate-800">{value}</p>
      ) : (
        <p className="mt-1 text-sm italic text-slate-400">Sin registrar</p>
      )}
    </div>
  );
}

function History({ order }: { order: Order }) {
  const entries = [...order.status_history].reverse();
  return (
    <ol className="space-y-5">
      {entries.map((entry, index) => (
        <li key={entry.id} className="relative flex gap-3">
          {index < entries.length - 1 && (
            <span className="absolute left-[11px] top-7 h-[calc(100%-4px)] w-px bg-slate-200" aria-hidden />
          )}
          <span
            className={cn(
              'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ring-4 ring-white',
              STATUS_STYLES[entry.to_status].dot,
            )}
          >
            <Check className="size-3.5 text-white" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-900">
              {entry.from_status
                ? `${STATUS_LABELS[entry.from_status]} → ${STATUS_LABELS[entry.to_status]}`
                : `Orden creada · ${STATUS_LABELS[entry.to_status]}`}
            </p>
            <p className="text-xs text-slate-500">
              {formatDateTime(entry.changed_at)} · {entry.changed_by_email}
            </p>
            {entry.note && entry.note !== 'Order created' && (
              <p className="mt-1.5 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{entry.note}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function OrderDetailPage() {
  const { id = '' } = useParams();
  const query = useQuery({ queryKey: ['orders', id], queryFn: () => ordersApi.get(id) });

  if (query.isPending) return <Spinner />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  const order = query.data;
  const overdue = isOverdue(order.estimated_delivery_date, order.actual_delivery_date);

  const deliveryValue: ReactNode = order.actual_delivery_date ? (
    <span className="font-medium text-teal-700">{formatDate(order.actual_delivery_date)}</span>
  ) : (
    <span className="text-slate-400">Pendiente</span>
  );

  return (
    <>
      <PageHeader
        back={
          <Link to="/orders" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
            <ArrowLeft className="size-4" /> Órdenes
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            {order.order_number} <StatusBadge status={order.status} />
          </span>
        }
        description={`Creada el ${formatDateTime(order.created_at)} por ${order.created_by_email}`}
      />

      <Card className="mb-6">
        <ProgressSteps status={order.status} />
        {overdue && (
          <p className="mt-4 flex items-center gap-2 text-sm font-medium text-red-600">
            <CalendarClock className="size-4" /> La fecha estimada de entrega ya pasó.
          </p>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Datos de la orden">
            <DetailList
              items={[
                {
                  label: 'Cliente',
                  value: (
                    <Link to={`/clients/${order.client.id}`} className="font-medium text-brand-700 hover:underline">
                      {order.client.name}
                    </Link>
                  ),
                },
                {
                  label: 'Motor',
                  value: (
                    <Link to={`/engines/${order.engine.id}`} className="font-medium text-brand-700 hover:underline">
                      {order.engine.serial_number}
                      <span className="block font-normal text-slate-500">
                        {order.engine.manufacturer} {order.engine.model} · {order.engine.power}
                      </span>
                    </Link>
                  ),
                },
                { label: 'Técnico responsable', value: order.technician },
                { label: 'Fecha de recepción', value: formatDate(order.received_at) },
                {
                  label: 'Entrega estimada',
                  value: (
                    <span className={cn(overdue && 'font-medium text-red-600')}>
                      {formatDate(order.estimated_delivery_date)}
                    </span>
                  ),
                },
                { label: 'Entrega real', value: deliveryValue },
                { label: 'Última actualización', value: formatDateTime(order.updated_at) },
              ]}
            />
          </Card>

          <Card title="Reparación">
            <div className="space-y-5">
              <TextBlock label="Problema reportado" value={order.reported_problem} />
              <TextBlock label="Diagnóstico técnico" value={order.diagnosis} />
              <TextBlock label="Trabajo realizado o reparación requerida" value={order.work_performed} />
              <TextBlock label="Observaciones" value={order.observations} />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          {/* key: resets the form after each update */}
          <StatusChangePanel key={order.updated_at} order={order} />
          <Card title="Historial de estados">
            <History order={order} />
          </Card>
        </div>
      </div>
    </>
  );
}
