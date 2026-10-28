import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { ordersApi, type StatusChangeInput } from '../../api/endpoints';
import { getErrorMessage } from '../../api/errors';
import type { Order, OrderStatus } from '../../api/types';
import { useToast } from '../../components/toast/context';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/feedback';
import { Field, Input, Textarea } from '../../components/ui/form';
import { Card } from '../../components/ui/layout';
import { cn } from '../../lib/cn';
import { todayIso } from '../../lib/format';
import { STATUS_LABELS, STATUS_STYLES } from '../../lib/labels';

/** Which technical field makes sense to fill when moving to each status. */
const SUGGESTED_FIELD: Partial<Record<OrderStatus, 'diagnosis' | 'work_performed'>> = {
  AWAITING_APPROVAL: 'diagnosis',
  IN_TESTING: 'work_performed',
  COMPLETED: 'work_performed',
};

/**
 * Status change for the order detail. The buttons come from
 * `allowed_next_statuses`, so the UI never offers a change the API would reject.
 */
export function StatusChangePanel({ order }: { order: Order }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [target, setTarget] = useState<OrderStatus | null>(null);
  const [note, setNote] = useState('');
  const [diagnosis, setDiagnosis] = useState(order.diagnosis ?? '');
  const [workPerformed, setWorkPerformed] = useState(order.work_performed ?? '');
  const [observations, setObservations] = useState(order.observations ?? '');
  const [deliveryDate, setDeliveryDate] = useState(todayIso());
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (body: StatusChangeInput) => ordersApi.changeStatus(order.id, body),
    onSuccess: (updated) => {
      queryClient.setQueryData(['orders', order.id], updated);
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success(`Orden actualizada a "${STATUS_LABELS[updated.status]}".`);
      setTarget(null);
      setNote('');
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  if (order.allowed_next_statuses.length === 0) {
    return (
      <Card title="Estado">
        <p className="text-sm text-slate-600">
          La orden fue entregada. Ya no admite cambios de estado.
        </p>
      </Card>
    );
  }

  const changed = (value: string, original: string | null) =>
    value.trim() && value.trim() !== (original ?? '') ? value.trim() : undefined;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!target) return;
    setError(null);
    if (target === 'DELIVERED' && deliveryDate < order.received_at) {
      setError('La fecha de entrega no puede ser anterior a la de recepción.');
      return;
    }
    mutation.mutate({
      status: target,
      note: note.trim() || undefined,
      // Only fields that actually changed are sent.
      diagnosis: changed(diagnosis, order.diagnosis),
      work_performed: changed(workPerformed, order.work_performed),
      observations: changed(observations, order.observations),
      actual_delivery_date: target === 'DELIVERED' ? deliveryDate : undefined,
    });
  };

  const suggested = target ? SUGGESTED_FIELD[target] : undefined;

  return (
    <Card title="Actualizar estado">
      <p className="mb-3 text-sm text-slate-500">Siguiente paso:</p>
      <div className="flex flex-wrap gap-2">
        {order.allowed_next_statuses.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => {
              setTarget(status);
              setError(null);
            }}
            aria-pressed={target === status}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ring-1 ring-inset transition',
              target === status
                ? 'bg-slate-900 text-white ring-slate-900'
                : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50',
            )}
          >
            <span className={cn('size-2 rounded-full', STATUS_STYLES[status].dot)} />
            {STATUS_LABELS[status]}
          </button>
        ))}
      </div>

      {target && (
        <form onSubmit={submit} className="mt-5 space-y-4 border-t border-slate-100 pt-5">
          {error && <Alert>{error}</Alert>}

          {target === 'DELIVERED' && (
            <Field label="Fecha real de entrega" required>
              {(id) => (
                <Input
                  id={id}
                  type="date"
                  value={deliveryDate}
                  min={order.received_at}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                />
              )}
            </Field>
          )}

          <Field
            label="Diagnóstico técnico"
            hint={suggested === 'diagnosis' ? 'Recomendado en este paso.' : undefined}
          >
            {(id, d) => (
              <Textarea id={id} aria-describedby={d} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
            )}
          </Field>
          <Field
            label="Trabajo realizado"
            hint={suggested === 'work_performed' ? 'Recomendado en este paso.' : undefined}
          >
            {(id, d) => (
              <Textarea
                id={id}
                aria-describedby={d}
                value={workPerformed}
                onChange={(e) => setWorkPerformed(e.target.value)}
              />
            )}
          </Field>
          <Field label="Observaciones">
            {(id) => (
              <Textarea id={id} rows={2} value={observations} onChange={(e) => setObservations(e.target.value)} />
            )}
          </Field>
          <Field label="Nota del cambio" hint="Queda registrada en el historial.">
            {(id, d) => (
              <Textarea id={id} rows={2} aria-describedby={d} value={note} onChange={(e) => setNote(e.target.value)} />
            )}
          </Field>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setTarget(null)}>
              Cancelar
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              Pasar a “{STATUS_LABELS[target]}”
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
