import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { clientsApi } from '../../api/endpoints';
import type { Client } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { EmptyState, ErrorState, Spinner } from '../../components/ui/feedback';
import { ActiveFilter, SearchInput } from '../../components/ui/filters';
import { ActiveBadge, Card, PageHeader, Pagination } from '../../components/ui/layout';
import { Modal } from '../../components/ui/Modal';
import { Table, type Column } from '../../components/ui/Table';
import { formatDate } from '../../lib/format';
import { useDebounce } from '../../lib/useDebounce';
import { ClientForm } from './ClientForm';

const columns: Column<Client>[] = [
  { header: 'Nombre', cell: (c) => <span className="font-semibold text-navy-950">{c.name}</span> },
  { header: 'Identificación', cell: (c) => `${c.identification_type} ${c.identification_number}` },
  { header: 'Correo', cell: (c) => c.email },
  { header: 'Estado', cell: (c) => <ActiveBadge active={c.is_active} /> },
  { header: 'Registrado', cell: (c) => formatDate(c.created_at) },
];

export function ClientsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [active, setActive] = useState('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const debouncedSearch = useDebounce(search);

  const query = useQuery({
    queryKey: ['clients', 'list', { search: debouncedSearch, active, page }],
    queryFn: () => clientsApi.list({ search: debouncedSearch, is_active: active, page, limit: 10 }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Empresas y personas propietarias de los motores."
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
            Nuevo cliente
          </Button>
        }
      />

      <Card bodyClassName="p-0">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Buscar por nombre, identificación o correo"
          />
          <ActiveFilter
            value={active}
            onChange={(value) => {
              setActive(value);
              setPage(1);
            }}
          />
        </div>

        {query.isPending ? (
          <Spinner />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : query.data.data.length === 0 ? (
          <EmptyState
            title={search || active ? 'Sin resultados' : 'Aún no hay clientes'}
            description={
              search || active ? 'Prueba con otros filtros.' : 'Registra el primer cliente del taller.'
            }
          />
        ) : (
          <>
            <Table
              columns={columns}
              rows={query.data.data}
              onRowClick={(client) => navigate(`/clients/${client.id}`)}
            />
            <Pagination
              page={query.data.meta.page}
              totalPages={query.data.meta.total_pages}
              total={query.data.meta.total}
              onChange={setPage}
            />
          </>
        )}
      </Card>

      <Modal open={creating} title="Nuevo cliente" onClose={() => setCreating(false)}>
        <ClientForm
          onCancel={() => setCreating(false)}
          onDone={(client) => {
            setCreating(false);
            navigate(`/clients/${client.id}`);
          }}
        />
      </Modal>
    </>
  );
}
