import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { enginesApi } from '../../api/endpoints';
import type { Engine } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { EmptyState, ErrorState, Spinner } from '../../components/ui/feedback';
import { ActiveFilter, SearchInput } from '../../components/ui/filters';
import { ActiveBadge, Card, PageHeader, Pagination } from '../../components/ui/layout';
import { Modal } from '../../components/ui/Modal';
import { Table, type Column } from '../../components/ui/Table';
import { formatDate } from '../../lib/format';
import { useDebounce } from '../../lib/useDebounce';
import { EngineForm } from './EngineForm';

const columns: Column<Engine>[] = [
  { header: 'Serie', cell: (e) => <span className="font-semibold text-navy-950">{e.serial_number}</span> },
  { header: 'Fabricante / modelo', cell: (e) => `${e.manufacturer} ${e.model}` },
  { header: 'Tipo', cell: (e) => e.engine_type },
  { header: 'Potencia', cell: (e) => e.power },
  { header: 'Cliente', cell: (e) => e.client.name },
  { header: 'Estado', cell: (e) => <ActiveBadge active={e.is_active} /> },
  { header: 'Registro', cell: (e) => formatDate(e.registered_at) },
];

export function EnginesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [active, setActive] = useState('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const debouncedSearch = useDebounce(search);

  const query = useQuery({
    queryKey: ['engines', 'list', { search: debouncedSearch, active, page }],
    queryFn: () => enginesApi.list({ search: debouncedSearch, is_active: active, page, limit: 10 }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader
        title="Motores"
        description="Motores de maquinaria registrados en el taller."
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
            Nuevo motor
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
            placeholder="Buscar por serie, fabricante o modelo"
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
            title={search || active ? 'Sin resultados' : 'Aún no hay motores'}
            description={search || active ? 'Prueba con otros filtros.' : 'Registra el primer motor.'}
          />
        ) : (
          <>
            <Table columns={columns} rows={query.data.data} onRowClick={(e) => navigate(`/engines/${e.id}`)} />
            <Pagination
              page={query.data.meta.page}
              totalPages={query.data.meta.total_pages}
              total={query.data.meta.total}
              onChange={setPage}
            />
          </>
        )}
      </Card>

      <Modal open={creating} title="Nuevo motor" onClose={() => setCreating(false)}>
        <EngineForm
          onCancel={() => setCreating(false)}
          onDone={(engine) => {
            setCreating(false);
            navigate(`/engines/${engine.id}`);
          }}
        />
      </Modal>
    </>
  );
}
