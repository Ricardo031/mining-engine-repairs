import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { enginesApi, ordersApi } from '../../api/endpoints';
import { getErrorMessage } from '../../api/errors';
import type { OrderListItem } from '../../api/types';
import { useAuth } from '../../auth/useAuth';
import { StatusBadge } from '../../components/StatusBadge';
import { useToast } from '../../components/toast/context';
import { Button, ButtonLink } from '../../components/ui/Button';
import { EmptyState, ErrorState, Spinner } from '../../components/ui/feedback';
import { ActiveBadge, Card, DetailList, PageHeader } from '../../components/ui/layout';
import { Modal } from '../../components/ui/Modal';
import { Table, type Column } from '../../components/ui/Table';
import { formatDate, formatDateTime } from '../../lib/format';
import { EngineForm } from './EngineForm';

const orderColumns: Column<OrderListItem>[] = [
  { header: 'Orden', cell: (o) => <span className="font-medium text-slate-900">{o.order_number}</span> },
  { header: 'Estado', cell: (o) => <StatusBadge status={o.status} /> },
  { header: 'Técnico', cell: (o) => o.technician },
  { header: 'Recepción', cell: (o) => formatDate(o.received_at) },
  { header: 'Entrega', cell: (o) => formatDate(o.actual_delivery_date ?? o.estimated_delivery_date) },
];

export function EngineDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const engine = useQuery({ queryKey: ['engines', id], queryFn: () => enginesApi.get(id) });
  const orders = useQuery({
    queryKey: ['orders', 'list', { engine: id }],
    queryFn: () => ordersApi.list({ engine_id: id, limit: 50 }),
  });

  const toggleActive = useMutation({
    mutationFn: (isActive: boolean) => enginesApi.update(id, { is_active: isActive }),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ['engines'] });
      toast.success(saved.is_active ? 'Motor activado.' : 'Motor desactivado.');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (engine.isPending) return <Spinner />;
  if (engine.isError) return <ErrorState error={engine.error} onRetry={() => engine.refetch()} />;

  const e = engine.data;
  const hasOpenOrder = orders.data?.data.some((o) => o.status !== 'DELIVERED') ?? false;

  return (
    <>
      <PageHeader
        back={
          <Link to="/engines" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
            <ArrowLeft className="size-4" /> Motores
          </Link>
        }
        title={
          <span className="flex items-center gap-3">
            {e.serial_number} <ActiveBadge active={e.is_active} />
          </span>
        }
        description={`${e.manufacturer} ${e.model} · ${e.engine_type}`}
        actions={
          <>
            {isAdmin && (
              <Button
                variant={e.is_active ? 'danger' : 'secondary'}
                loading={toggleActive.isPending}
                onClick={() => toggleActive.mutate(!e.is_active)}
              >
                {e.is_active ? 'Desactivar' : 'Activar'}
              </Button>
            )}
            <Button variant="secondary" icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>
              Editar
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Datos del motor">
          <DetailList
            items={[
              {
                label: 'Cliente propietario',
                value: (
                  <Link to={`/clients/${e.client.id}`} className="font-medium text-brand-700 hover:underline">
                    {e.client.name}
                  </Link>
                ),
              },
              { label: 'Fabricante', value: e.manufacturer },
              { label: 'Modelo', value: e.model },
              { label: 'Tipo', value: e.engine_type },
              { label: 'Potencia', value: e.power },
              { label: 'Fecha de registro', value: formatDateTime(e.registered_at) },
            ]}
          />
        </Card>

        <Card
          title="Historial de reparaciones"
          className="lg:col-span-2"
          bodyClassName="p-0"
          actions={
            e.is_active &&
            !hasOpenOrder && (
              <ButtonLink size="sm" variant="secondary" to={`/orders/new?engine_id=${e.id}`} icon={<Plus className="size-4" />}>
                Nueva orden
              </ButtonLink>
            )
          }
        >
          {orders.isPending ? (
            <Spinner />
          ) : orders.isError ? (
            <ErrorState error={orders.error} onRetry={() => orders.refetch()} />
          ) : orders.data.data.length === 0 ? (
            <EmptyState title="Este motor no tiene órdenes" />
          ) : (
            <Table columns={orderColumns} rows={orders.data.data} onRowClick={(o) => navigate(`/orders/${o.id}`)} />
          )}
        </Card>
      </div>

      <Modal open={editing} title="Editar motor" onClose={() => setEditing(false)}>
        <EngineForm engine={e} onCancel={() => setEditing(false)} onDone={() => setEditing(false)} />
      </Modal>
    </>
  );
}
