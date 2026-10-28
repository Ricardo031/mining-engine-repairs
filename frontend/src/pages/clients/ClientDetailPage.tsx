import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { clientsApi, enginesApi, ordersApi } from '../../api/endpoints';
import { getErrorMessage } from '../../api/errors';
import type { Engine, OrderListItem } from '../../api/types';
import { useAuth } from '../../auth/useAuth';
import { StatusBadge } from '../../components/StatusBadge';
import { useToast } from '../../components/toast/context';
import { Button, ButtonLink } from '../../components/ui/Button';
import { EmptyState, ErrorState, Spinner } from '../../components/ui/feedback';
import { ActiveBadge, Card, DetailList, PageHeader } from '../../components/ui/layout';
import { Modal } from '../../components/ui/Modal';
import { Table, type Column } from '../../components/ui/Table';
import { formatDate, formatDateTime } from '../../lib/format';
import { IDENTIFICATION_LABELS } from '../../lib/labels';
import { EngineForm } from '../engines/EngineForm';
import { ClientForm } from './ClientForm';

const engineColumns: Column<Engine>[] = [
  { header: 'Serie', cell: (e) => <span className="font-semibold text-navy-950">{e.serial_number}</span> },
  { header: 'Fabricante', cell: (e) => e.manufacturer },
  { header: 'Modelo', cell: (e) => e.model },
  { header: 'Potencia', cell: (e) => e.power },
  { header: 'Estado', cell: (e) => <ActiveBadge active={e.is_active} /> },
];

const orderColumns: Column<OrderListItem>[] = [
  { header: 'Orden', cell: (o) => <span className="font-semibold text-navy-950">{o.order_number}</span> },
  { header: 'Motor', cell: (o) => o.engine.serial_number },
  { header: 'Estado', cell: (o) => <StatusBadge status={o.status} /> },
  { header: 'Recepción', cell: (o) => formatDate(o.received_at) },
];

export function ClientDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [addingEngine, setAddingEngine] = useState(false);

  const client = useQuery({ queryKey: ['clients', id], queryFn: () => clientsApi.get(id) });
  const engines = useQuery({
    queryKey: ['engines', 'list', { client: id }],
    queryFn: () => enginesApi.list({ client_id: id, limit: 100 }),
  });
  const orders = useQuery({
    queryKey: ['orders', 'list', { client: id }],
    queryFn: () => ordersApi.list({ client_id: id, limit: 20 }),
  });

  const toggleActive = useMutation({
    mutationFn: (isActive: boolean) => clientsApi.update(id, { is_active: isActive }),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success(saved.is_active ? 'Cliente activado.' : 'Cliente desactivado.');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (client.isPending) return <Spinner />;
  if (client.isError) return <ErrorState error={client.error} onRetry={() => client.refetch()} />;

  const c = client.data;

  return (
    <>
      <PageHeader
        back={
          <Link to="/clients" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
            <ArrowLeft className="size-4" /> Clientes
          </Link>
        }
        title={
          <span className="flex items-center gap-3">
            {c.name} <ActiveBadge active={c.is_active} />
          </span>
        }
        description={`${IDENTIFICATION_LABELS[c.identification_type]} ${c.identification_number}`}
        actions={
          <>
            {isAdmin && (
              <Button
                variant={c.is_active ? 'danger' : 'secondary'}
                loading={toggleActive.isPending}
                onClick={() => toggleActive.mutate(!c.is_active)}
              >
                {c.is_active ? 'Desactivar' : 'Activar'}
              </Button>
            )}
            <Button variant="secondary" icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>
              Editar
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Datos del cliente" className="lg:col-span-1">
          <DetailList
            items={[
              { label: 'Correo', value: c.email },
              { label: 'Tipo de identificación', value: IDENTIFICATION_LABELS[c.identification_type] },
              { label: 'Número', value: c.identification_number },
              { label: 'Registrado', value: formatDateTime(c.created_at) },
            ]}
          />
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card
            title="Motores"
            bodyClassName="p-0"
            actions={
              c.is_active && (
                <Button size="sm" variant="secondary" icon={<Plus className="size-4" />} onClick={() => setAddingEngine(true)}>
                  Agregar motor
                </Button>
              )
            }
          >
            {engines.isPending ? (
              <Spinner />
            ) : engines.isError ? (
              <ErrorState error={engines.error} onRetry={() => engines.refetch()} />
            ) : engines.data.data.length === 0 ? (
              <EmptyState title="Sin motores registrados" />
            ) : (
              <Table columns={engineColumns} rows={engines.data.data} onRowClick={(e) => navigate(`/engines/${e.id}`)} />
            )}
          </Card>

          <Card
            title="Órdenes de reparación"
            bodyClassName="p-0"
            actions={
              <ButtonLink size="sm" variant="ghost" to={`/orders?client_id=${id}`}>
                Ver todas
              </ButtonLink>
            }
          >
            {orders.isPending ? (
              <Spinner />
            ) : orders.isError ? (
              <ErrorState error={orders.error} onRetry={() => orders.refetch()} />
            ) : orders.data.data.length === 0 ? (
              <EmptyState title="Sin órdenes" />
            ) : (
              <Table columns={orderColumns} rows={orders.data.data} onRowClick={(o) => navigate(`/orders/${o.id}`)} />
            )}
          </Card>
        </div>
      </div>

      <Modal open={editing} title="Editar cliente" onClose={() => setEditing(false)}>
        <ClientForm client={c} onCancel={() => setEditing(false)} onDone={() => setEditing(false)} />
      </Modal>

      <Modal open={addingEngine} title="Nuevo motor" onClose={() => setAddingEngine(false)}>
        <EngineForm
          defaultClientId={c.id}
          onCancel={() => setAddingEngine(false)}
          onDone={() => setAddingEngine(false)}
        />
      </Modal>
    </>
  );
}
