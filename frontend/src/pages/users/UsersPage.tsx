import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { usersApi } from '../../api/endpoints';
import { getErrorMessage } from '../../api/errors';
import type { User } from '../../api/types';
import { useAuth } from '../../auth/useAuth';
import { useToast } from '../../components/toast/context';
import { Button } from '../../components/ui/Button';
import { EmptyState, ErrorState, Spinner } from '../../components/ui/feedback';
import { SearchInput } from '../../components/ui/filters';
import { Select } from '../../components/ui/form';
import { ActiveBadge, Card, PageHeader, Pagination } from '../../components/ui/layout';
import { Modal } from '../../components/ui/Modal';
import { Table, type Column } from '../../components/ui/Table';
import { formatDateTime } from '../../lib/format';
import { ROLE_LABELS } from '../../lib/labels';
import { useDebounce } from '../../lib/useDebounce';
import { UserForm } from './UserForm';

export function UsersPage() {
  const { user: me } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<User | 'new' | null>(null);
  const debouncedSearch = useDebounce(search);

  const query = useQuery({
    queryKey: ['users', 'list', { search: debouncedSearch, role, page }],
    queryFn: () => usersApi.list({ search: debouncedSearch, role, page, limit: 10 }),
    placeholderData: keepPreviousData,
  });

  const toggleActive = useMutation({
    mutationFn: (user: User) =>
      user.isActive ? usersApi.deactivate(user.id) : usersApi.update(user.id, { isActive: true }),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(saved.isActive ? 'Usuario activado.' : 'Usuario desactivado.');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const columns: Column<User>[] = [
    {
      header: 'Nombre',
      cell: (u) => (
        <span>
          <span className="font-medium text-slate-900">
            {u.firstName} {u.lastName}
          </span>
          <span className="block text-xs text-slate-500">{u.email}</span>
        </span>
      ),
    },
    { header: 'Rol', cell: (u) => ROLE_LABELS[u.role] },
    { header: 'Estado', cell: (u) => <ActiveBadge active={u.isActive} /> },
    { header: 'Último ingreso', cell: (u) => formatDateTime(u.lastLoginAt) },
    {
      header: 'Acciones',
      className: 'text-right',
      cell: (u) =>
        u.id === me?.id ? (
          <span className="text-xs text-slate-400">Tu cuenta</span>
        ) : (
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" icon={<Pencil className="size-4" />} onClick={() => setEditing(u)}>
              Editar
            </Button>
            <Button
              size="sm"
              variant={u.isActive ? 'ghost' : 'secondary'}
              className={u.isActive ? 'text-red-600 hover:bg-red-50 hover:text-red-700' : undefined}
              loading={toggleActive.isPending && toggleActive.variables?.id === u.id}
              onClick={() => toggleActive.mutate(u)}
            >
              {u.isActive ? 'Desactivar' : 'Activar'}
            </Button>
          </div>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Usuarios"
        description="Cuentas con acceso a la plataforma. Solo visible para administradores."
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
            Nuevo usuario
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
            placeholder="Buscar por nombre o correo"
          />
          <Select
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setPage(1);
            }}
            aria-label="Filtrar por rol"
            className="sm:w-48"
          >
            <option value="">Todos los roles</option>
            <option value="admin">Administradores</option>
            <option value="operator">Operativos</option>
          </Select>
        </div>

        {query.isPending ? (
          <Spinner />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : query.data.data.length === 0 ? (
          <EmptyState title="Sin resultados" />
        ) : (
          <>
            <Table columns={columns} rows={query.data.data} />
            <Pagination
              page={query.data.meta.page}
              totalPages={query.data.meta.totalPages}
              total={query.data.meta.total}
              onChange={setPage}
            />
          </>
        )}
      </Card>

      <Modal
        open={editing !== null}
        title={editing === 'new' ? 'Nuevo usuario' : 'Editar usuario'}
        onClose={() => setEditing(null)}
      >
        {editing !== null && (
          <UserForm
            user={editing === 'new' ? undefined : editing}
            onCancel={() => setEditing(null)}
            onDone={() => setEditing(null)}
          />
        )}
      </Modal>
    </>
  );
}
